import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { scoreCliente, type Tier } from "@/lib/healthScore";

const TIER_COLORS: Record<Tier, string> = {
  Champion: "#F05A28",
  Healthy: "#1E5DBF",
  "At Risk": "#B5740F",
  Critical: "#B3261E",
};

const MES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// Motivos operacionales internos (no son churn real de cliente).
// Se excluyen de todos los conteos / tendencias / proyecciones de churn.
const OPERATIONAL_MOTIVOS = new Set(["CHANGE_METHOD", "CHANGE_FREQUENCY"]);
function isOperationalChurn(motivo: string | null | undefined): boolean {
  return motivo != null && OPERATIONAL_MOTIVOS.has(motivo.trim().toUpperCase());
}

type ScoreRow = {
  productos: number | null; usuarios: number | null;
  v_salon: number | null; v_delivery: number | null; v_mostrador: number | null;
  cant_contactos: number | null; nps_score: number | null;
  motivo_baja: string | null; motivo_metabase: string | null;
  estado_dash: string | null; pais: string | null;
};

type BajaRow = { id: number; fecha_baja: string | null; motivo_baja: string | null; pais: string | null; mes_exportacion: string | null };
type NpsRow = { nps_score: number | null; pais: string | null };
type CsatRow = { csat_cs_promedio: number | null; csat_onb_promedio: number | null };

async function pageAll<T>(builder: () => any): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await builder().range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/** Normaliza NPS guardado como 0-100 (factor x10) a 0-10. */
function normalizeNps(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 10 ? v / 10 : v;
}
/** Normaliza CSAT guardado como 0-500 (x100) a 0-5. */
function normalizeCsat(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (v > 50) return v / 100;
  if (v > 5) return v / 10;
  return v;
}

export type ResumenData = {
  period: string;
  activeAccounts: number;
  bajasMesActual: number;
  bajasMesPrev: number;
  monthDeltaPct: number | null;
  ytdClosed: number;
  latestClosedLabel: string;
  prevClosedLabel: string;
  cvr: number; // %
  npsResponses: number;
  npsScore: number; // -100..100
  npsAvgLtr: number; // 0..10
  npsPromotores: number; npsPasivos: number; npsDetractores: number;
  csatAvg: number | null; csatN: number;
  npsByPais: { pais: string; nps: number; n: number }[];
  npsBest: { pais: string; nps: number } | null;
  npsWorst: { pais: string; nps: number } | null;
  npsGap: number;
  tierDist: { tier: Tier; count: number; pct: number; color: string }[];
  churnTrend: { mes: string; key: string; bajas: number; pctMotivo: number | null; proyectado: boolean }[];
  motivosBaja: { motivo: string; n: number; pct: number }[];
  pctSinMotivo: number;
  totalBajasHist: number;
  criticalCount: number;
  alertas: { tone: "red" | "amber"; titulo: string; link: string }[];
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MES_CORTO[(m ?? 1) - 1]} ${String(y ?? 0).slice(2)}`;
}

async function fetchResumen(period: string): Promise<ResumenData> {
  const [activos, bajasRaw, bajasAllRaw, nps, csat] = await Promise.all([
    pageAll<ScoreRow>(() => supabase
      .from("clientes")
      .select("productos,usuarios,v_salon,v_delivery,v_mostrador,cant_contactos,nps_score,motivo_baja,motivo_metabase,estado_dash,pais")
      .eq("mes_exportacion", period)
      .eq("estado_dash", "Activo")),
    pageAll<BajaRow>(() => supabase
      .from("clientes")
      .select("id,fecha_baja,motivo_baja,pais,mes_exportacion")
      .eq("mes_exportacion", period)
      .eq("estado_dash", "Bloqueado")),
    pageAll<BajaRow>(() => supabase
      .from("clientes")
      .select("id,fecha_baja,motivo_baja,pais,mes_exportacion")
      .eq("estado_dash", "Bloqueado")),
    pageAll<NpsRow>(() => supabase
      .from("clientes")
      .select("nps_score,pais")
      .eq("mes_exportacion", period)
      .not("nps_score", "is", null)),
    pageAll<CsatRow>(() => supabase
      .from("clientes")
      .select("csat_cs_promedio,csat_onb_promedio")
      .eq("mes_exportacion", period)
      .or("csat_cs_promedio.not.is.null,csat_onb_promedio.not.is.null")),
  ]);

  // Excluir churn operacional (cambios de método/frecuencia de pago) de TODO
  // conteo, trend, motivos, YTD, CVR y proyecciones derivadas.
  const bajas = bajasRaw.filter((b) => !isOperationalChurn(b.motivo_baja));


  // --- Tier dist (de activos)
  const tierCount: Record<Tier, number> = { Champion: 0, Healthy: 0, "At Risk": 0, Critical: 0 };
  for (const r of activos) {
    // Normalizar nps_score (puede estar escalado x10)
    const cli = { ...r, nps_score: normalizeNps(r.nps_score) };
    const { tier } = scoreCliente(cli);
    tierCount[tier]++;
  }
  const totalAct = activos.length || 1;
  const tierDist = (["Champion","Healthy","At Risk","Critical"] as Tier[]).map((tier) => ({
    tier, count: tierCount[tier], pct: (tierCount[tier] / totalAct) * 100, color: TIER_COLORS[tier],
  }));

  // --- Trend histórico: dedup por cliente (cuenta cada baja una sola vez en su mes de fecha_baja)
  // Dedup: por cada cliente, quedarse con el snapshot más antiguo (primera vez como Bloqueado)
  const trendDedup = new Map<number, BajaRow>();
  for (const b of bajasAllRaw) {
    if (!b.id || !b.mes_exportacion) continue;
    const existing = trendDedup.get(b.id);
    if (!existing || b.mes_exportacion < existing.mes_exportacion!) trendDedup.set(b.id, b);
  }
  const bajasAll = Array.from(trendDedup.values());
  const byMonthAll = new Map<string, { bajas: number; conMotivo: number }>();
  for (const b of bajasAll) {
    const k = b.mes_exportacion!;
    const slot = byMonthAll.get(k) ?? { bajas: 0, conMotivo: 0 };
    slot.bajas++;
    if (b.motivo_baja) slot.conMotivo++;
    byMonthAll.set(k, slot);
  }

  // --- Métricas del período actual (byMonth = solo mes seleccionado)
  const byMonth = new Map<string, { bajas: number; conMotivo: number }>();
  let sinFecha = 0, totalBajas = 0;
  for (const b of bajas) {
    totalBajas++;
    if (!b.fecha_baja) { sinFecha++; continue; }
    const k = monthKey(new Date(b.fecha_baja));
    const slot = byMonth.get(k) ?? { bajas: 0, conMotivo: 0 };
    slot.bajas++;
    if (b.motivo_baja) slot.conMotivo++;
    byMonth.set(k, slot);
  }
  const sortedKeys = Array.from(byMonthAll.keys()).sort();
  const latest = period;
  const prev = (() => {
    const [y, m] = period.split("-").map(Number);
    if (!y || !m) return sortedKeys[sortedKeys.length - 2];
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}`;
  })();
  const churnTrend = sortedKeys.map((k) => {
    const s = byMonthAll.get(k)!;
    return {
      key: k, mes: monthLabel(k), bajas: s.bajas,
      pctMotivo: s.bajas ? (s.conMotivo / s.bajas) * 100 : null,
      proyectado: false,
    };
  });
  const bajasMesActual = byMonthAll.get(latest)?.bajas ?? 0;
  const bajasMesPrev = prev ? (byMonthAll.get(prev)?.bajas ?? 0) : 0;
  const monthDeltaPct = bajasMesPrev ? ((bajasMesActual - bajasMesPrev) / bajasMesPrev) * 100 : null;


  // YTD (año del latest)
  const latestYear = latest ? Number(latest.split("-")[0]) : new Date().getUTCFullYear();
  const ytdClosed = Array.from(byMonthAll.entries())
    .filter(([k]) => Number(k.split("-")[0]) === latestYear)
    .reduce((s, [, v]) => s + v.bajas, 0);

  // Motivos baja
  const motivoMap = new Map<string, number>();
  for (const b of bajas) {
    const k = (b.motivo_baja ?? "Sin motivo").trim() || "Sin motivo";
    motivoMap.set(k, (motivoMap.get(k) ?? 0) + 1);
  }
  const motivosBaja = Array.from(motivoMap.entries())
    .map(([motivo, n]) => ({ motivo, n, pct: (n / (totalBajas || 1)) * 100 }))
    .sort((a, b) => b.n - a.n);
  const sin = motivosBaja.find((m) => /sin motivo/i.test(m.motivo));
  const pctSinMotivo = sin ? sin.pct : 0;

  // NPS
  const npsValsRaw = nps.map((r) => normalizeNps(r.nps_score)).filter((v): v is number => v != null);
  const npsResponses = npsValsRaw.length;
  const promotores = npsValsRaw.filter((s) => s >= 9).length;
  const detractores = npsValsRaw.filter((s) => s <= 6).length;
  const pasivos = npsResponses - promotores - detractores;
  const npsScore = npsResponses ? ((promotores - detractores) / npsResponses) * 100 : 0;
  const npsAvgLtr = npsResponses ? npsValsRaw.reduce((a, b) => a + b, 0) / npsResponses : 0;

  // NPS por país
  const paisAgg = new Map<string, { sum: number; pos: number; neg: number; n: number }>();
  for (const r of nps) {
    const v = normalizeNps(r.nps_score);
    if (v == null) continue;
    const p = r.pais ?? "Sin país";
    const slot = paisAgg.get(p) ?? { sum: 0, pos: 0, neg: 0, n: 0 };
    slot.sum += v;
    if (v >= 9) slot.pos++;
    else if (v <= 6) slot.neg++;
    slot.n++;
    paisAgg.set(p, slot);
  }
  const npsByPais = Array.from(paisAgg.entries())
    .map(([pais, s]) => ({ pais, nps: ((s.pos - s.neg) / s.n) * 100, n: s.n }))
    .filter((p) => p.n >= 10)
    .sort((a, b) => a.nps - b.nps);
  const npsWorst = npsByPais[0] ?? null;
  const npsBest = npsByPais[npsByPais.length - 1] ?? null;
  const npsGap = npsBest && npsWorst ? npsBest.nps - npsWorst.nps : 0;

  // CSAT — promediamos cs y onb por cliente antes de agregar (1 valor por cliente)
  const csatVals: number[] = [];
  for (const r of csat) {
    const a = normalizeCsat(r.csat_cs_promedio);
    const b = normalizeCsat(r.csat_onb_promedio);
    const vals = [a, b].filter((v): v is number => v != null);
    if (vals.length) csatVals.push(vals.reduce((s, v) => s + v, 0) / vals.length);
  }
  const csatAvg = csatVals.length ? csatVals.reduce((a, b) => a + b, 0) / csatVals.length : null;

  // CVR mes actual
  const cvr = activos.length ? (bajasMesActual / (activos.length + bajasMesActual)) * 100 : 0;

  const criticalCount = tierCount.Critical;

  // Alertas
  const alertas: ResumenData["alertas"] = [];
  if (npsBest && npsWorst && npsGap >= 15) {
    alertas.push({ tone: "amber", titulo: `${npsWorst.pais} NPS ${npsWorst.nps.toFixed(2)} — gap ${npsGap.toFixed(1)} pts vs ${npsBest.pais}`, link: "/nps" });
  }
  if (pctSinMotivo >= 30) {
    alertas.push({ tone: "amber", titulo: `${pctSinMotivo.toFixed(1)}% de bajas sin motivo (${sin?.n ?? 0} cuentas)`, link: "/kpis" });
  }
  if (monthDeltaPct != null && monthDeltaPct >= 10) {
    alertas.push({ tone: "red", titulo: `Aceleración churn +${monthDeltaPct.toFixed(1)}% ${monthLabel(prev!)}→${monthLabel(latest!)}`, link: "/tendencia" });
  }
  if (criticalCount > 0) {
    alertas.push({ tone: "red", titulo: `${criticalCount} cuentas en tier Critical — intervención urgente`, link: "/health" });
  }

  return {
    period,
    activeAccounts: activos.length,
    bajasMesActual, bajasMesPrev, monthDeltaPct,
    ytdClosed,
    latestClosedLabel: latest ? monthLabel(latest) : "—",
    prevClosedLabel: prev ? monthLabel(prev) : "—",
    cvr,
    npsResponses, npsScore, npsAvgLtr,
    npsPromotores: promotores, npsPasivos: pasivos, npsDetractores: detractores,
    csatAvg, csatN: csatVals.length,
    npsByPais, npsBest, npsWorst, npsGap,
    tierDist,
    churnTrend,
    motivosBaja, pctSinMotivo,
    totalBajasHist: totalBajas - sinFecha,
    criticalCount,
    alertas,
  };
}

export function useSupabaseResumen(period: string) {
  return useQuery({
    queryKey: ["supabase-resumen", period],
    queryFn: () => fetchResumen(period),
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}
