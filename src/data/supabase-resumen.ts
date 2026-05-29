import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { scoreCliente, type Tier } from "@/lib/healthScore";

// Rebuild trigger — forces fresh bundle on deploy

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
  id_hubspot: string | null;
  productos: number | null; usuarios: number | null;
  v_salon: number | null; v_delivery: number | null; v_mostrador: number | null;
  cant_contactos: number | null; nps_score: number | null;
  motivo_baja: string | null; motivo_metabase: string | null;
  estado_dash: string | null; pais: string | null;
};

// Valores exactos del campo etapa en la BD (con mayúscula inicial).
const ETAPAS_BAJA = ["Bajas", "Bajas clientes"] as const;

type BajaRow = {
  id: number;
  fecha_baja: string | null;
  motivo_baja: string | null;
  submotivo_baja: string | null;
  motivo_metabase: string | null;
  comentarios_metabase: string | null;
  pais: string | null;
  mes_exportacion: string | null;
  etapa: string | null;
};

// ─── Normalización de motivos ────────────────────────────────────────────────
// Prioridad: J (motivo_baja) → K (submotivo_baja) → N (motivo_metabase) → O (comentarios, keywords)
// Si K y O están vacíos se respeta lo de J+N sin forzar nada.
export type MotivoCat =
  | "Precio"
  | "Producto / Funcionalidades"
  | "Cierre definitivo"
  | "Cierre temporal"
  | "Eligió otro sistema"
  | "Servicio"
  | "Problemas técnicos"
  | "Sin motivo"
  | "Otro";

function matchCat(text: string): MotivoCat | null {
  const t = text.trim();
  if (!t) return null;
  const u = t.toUpperCase();

  if (/^precio$/i.test(t)           || u === "PRICE")           return "Precio";
  if (/falta de funcionalidad/i.test(t) || u === "FUNCTIONALITIES") return "Producto / Funcionalidades";
  if (/cierre temporal/i.test(t)    || /contrató por evento/i.test(t) ||
      /local no inaugurado/i.test(t) || u === "TEMPORAL_CLOSED") return "Cierre temporal";
  if (/cierre definitivo/i.test(t)  || /negocio no gastronómico/i.test(t) ||
      /venta de comercio/i.test(t)  || u === "CLOSED")           return "Cierre definitivo";
  if (/eligió otro sistema/i.test(t) || /dejó de usar sistema/i.test(t)) return "Eligió otro sistema";
  if (/mal servicio/i.test(t)       || u === "SERVICE")          return "Servicio";
  if (/impresora|hardware|sin internet|problem[ao]s?\s+técnic|integraci/i.test(t)) return "Problemas técnicos";
  if (/sin respuesta/i.test(t)      || u === "OTHER")            return "Sin motivo";
  if (u === "CLOSED")                                             return "Cierre definitivo";
  return null;
}

/** Interpreta texto libre de comentarios buscando palabras clave. */
function matchComentario(texto: string): MotivoCat | null {
  const t = texto.toLowerCase();
  if (/\bpreci[o]?\b|caro|costoso|mensualidad|muy\s+alto|cobr[oa]|tarifa/i.test(t))      return "Precio";
  if (/funci[oó]n|funcionalidad|feature|m[oó]dulo|no\s+tiene|le\s+falta|necesita/i.test(t)) return "Producto / Funcionalidades";
  if (/cerr[oó]\s+(el\s+)?local|cerr[oó]\s+(el\s+)?negocio|vendi[oó]|quiebra|quebr[oó]|no\s+abr[ei]|no\s+sigui[oó]/i.test(t)) return "Cierre definitivo";
  if (/temporal|event[o]?|temporad|vacacion|reform|remodelac|mudanz|no\s+(está\s+)?inaug/i.test(t)) return "Cierre temporal";
  if (/otro\s+sistema|cambi[oó]\s+de\s+(sistema|software)|migraron|se\s+fue\s+a|compe(t|tenci)/i.test(t)) return "Eligió otro sistema";
  if (/atenci[oó]n|soporte|servicio|mal\s+trato|no\s+respond|demora|lento/i.test(t))      return "Servicio";
  if (/impresora|hardware|internet|integraci[oó]n|técnico|no\s+funciona|falla|error\s+de\s+sistem/i.test(t)) return "Problemas técnicos";
  return null;
}

export function normalizarMotivo(
  motivo: string | null | undefined,
  submotivo: string | null | undefined,
  motivoMetabase: string | null | undefined,
  comentarios: string | null | undefined,
): MotivoCat {
  // J: motivo HB
  const catJ = motivo?.trim() ? matchCat(motivo.trim()) : null;
  if (catJ && catJ !== "Sin motivo" && catJ !== "Otro") return catJ;

  // K: submotivo (solo si tiene valor)
  const catK = submotivo?.trim() ? matchCat(submotivo.trim()) : null;
  if (catK && catK !== "Sin motivo" && catK !== "Otro") return catK;

  // N: motivo metabase
  const catN = motivoMetabase?.trim() ? matchCat(motivoMetabase.trim()) : null;
  if (catN && catN !== "Sin motivo" && catN !== "Otro") return catN;

  // O: comentarios libre → keyword matching
  const catO = comentarios?.trim() ? matchComentario(comentarios.trim()) : null;
  if (catO) return catO;

  // Fallback a J/K/N aunque sean Otro o Sin motivo
  if (catJ) return catJ;
  if (catK) return catK;
  if (catN) return catN;

  // Sin ningún dato útil
  const hayTexto = !!(motivo?.trim() || submotivo?.trim() || motivoMetabase?.trim() || comentarios?.trim());
  return hayTexto ? "Otro" : "Sin motivo";
}
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
  sinFechaHist: number; // Bloqueados reales sin fecha_baja — no asignables a un mes
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
      .select("id_hubspot,productos,usuarios,v_salon,v_delivery,v_mostrador,cant_contactos,nps_score,motivo_baja,motivo_metabase,estado_dash,pais")
      .eq("mes_exportacion", period)
      .eq("estado_dash", "Activo")),
    pageAll<BajaRow>(() => supabase
      .from("clientes")
      .select("id,fecha_baja,motivo_baja,submotivo_baja,motivo_metabase,comentarios_metabase,pais,mes_exportacion,etapa")
      .eq("mes_exportacion", period)
      .in("etapa", ETAPAS_BAJA)),
    pageAll<BajaRow>(() => supabase
      .from("clientes")
      .select("id,fecha_baja,motivo_baja,submotivo_baja,motivo_metabase,comentarios_metabase,pais,mes_exportacion,etapa")
      .in("etapa", ETAPAS_BAJA)),
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


  // --- Dedup por id_hubspot: cada ID HubSpot es 1 cliente único.
  // id_cuenta_dash puede tener duplicados, id_hubspot no.
  const activosDedup = new Map<string, ScoreRow>();
  for (const r of activos) {
    const key = r.id_hubspot ?? `_no_hub_${activosDedup.size}`;
    if (!activosDedup.has(key)) activosDedup.set(key, r);
  }
  const activosUnicos = Array.from(activosDedup.values());

  // --- Tier dist (de activos únicos por HubSpot ID)
  const tierCount: Record<Tier, number> = { Champion: 0, Healthy: 0, "At Risk": 0, Critical: 0 };
  for (const r of activosUnicos) {
    const cli = { ...r, nps_score: normalizeNps(r.nps_score) };
    const { tier } = scoreCliente(cli);
    tierCount[tier]++;
  }
  const totalAct = activosUnicos.length || 1;
  const tierDist = (["Champion","Healthy","At Risk","Critical"] as Tier[]).map((tier) => ({
    tier, count: tierCount[tier], pct: (tierCount[tier] / totalAct) * 100, color: TIER_COLORS[tier],
  }));

  // --- Trend histórico: dedup por cliente, asignar mes por fecha_baja o por snapshot más antiguo.
  // Todo Bloqueado es una baja real. Si tiene fecha_baja la usamos como mes de la baja.
  // Si no tiene fecha_baja, el snapshot más antiguo donde aparece Bloqueado es el mejor proxy.
  const trendDedup = new Map<number, BajaRow>();
  for (const b of bajasAllRaw) {
    if (!b.id || !b.mes_exportacion) continue;
    const existing = trendDedup.get(b.id);
    // Nos quedamos con el snapshot más antiguo (primer mes en que apareció como Bloqueado)
    if (!existing || b.mes_exportacion < existing.mes_exportacion!) trendDedup.set(b.id, b);
  }
  const bajasAll = Array.from(trendDedup.values())
    .filter((b) => !isOperationalChurn(b.motivo_baja));
  // sinFechaHist: Bloqueados sin fecha_baja (bajas reales pero sin fecha asignable a un mes)
  let sinFechaHist = 0;
  const byMonthAll = new Map<string, { bajas: number; conMotivo: number }>();
  for (const b of bajasAll) {
    if (!b.fecha_baja) { sinFechaHist++; continue; } // real pero sin fecha → no asignable
    const k = monthKey(new Date(b.fecha_baja));
    if (k > period) continue;
    const slot = byMonthAll.get(k) ?? { bajas: 0, conMotivo: 0 };
    slot.bajas++;
    if (normalizarMotivo(b.motivo_baja, b.submotivo_baja, b.motivo_metabase, b.comentarios_metabase) !== "Sin motivo") slot.conMotivo++;
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
  // Bajas del mes: Bloqueados con fecha_baja en el período, más los sin fecha asignados
  // al primer snapshot en que aparecen como Bloqueado (proxy del mes real de baja).
  // Activos con fecha_baja nunca llegan aquí (filtrado por estado_dash = Bloqueado).
  const bajasMesActual = byMonthAll.get(latest)?.bajas ?? 0;
  const bajasMesPrev = prev ? (byMonthAll.get(prev)?.bajas ?? 0) : 0;
  const monthDeltaPct = bajasMesPrev ? ((bajasMesActual - bajasMesPrev) / bajasMesPrev) * 100 : null;


  // YTD (año del latest)
  const latestYear = latest ? Number(latest.split("-")[0]) : new Date().getUTCFullYear();
  const ytdClosed = Array.from(byMonthAll.entries())
    .filter(([k]) => Number(k.split("-")[0]) === latestYear)
    .reduce((s, [, v]) => s + v.bajas, 0);

  // Motivos baja — agrupados en categorías normalizadas
  const motivoMap = new Map<string, number>();
  for (const b of bajas) {
    const cat = normalizarMotivo(b.motivo_baja, b.submotivo_baja, b.motivo_metabase, b.comentarios_metabase);
    motivoMap.set(cat, (motivoMap.get(cat) ?? 0) + 1);
  }
  const motivosBaja = Array.from(motivoMap.entries())
    .map(([motivo, n]) => ({ motivo, n, pct: (n / (totalBajas || 1)) * 100 }))
    .sort((a, b) => b.n - a.n);
  const sin = motivosBaja.find((m) => m.motivo === "Sin motivo");
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

  // CVR mes actual — usa activos únicos por HubSpot ID
  const cvr = activosUnicos.length ? (bajasMesActual / (activosUnicos.length + bajasMesActual)) * 100 : 0;

  const criticalCount = tierCount.Critical;

  // Alertas
  const alertas: ResumenData["alertas"] = [];
  if (npsBest && npsWorst && npsGap >= 15) {
    alertas.push({ tone: "amber", titulo: `${npsWorst.pais} NPS ${npsWorst.nps.toFixed(2)} — gap ${npsGap.toFixed(1)} pts vs ${npsBest.pais}`, link: "/contactos" });
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
    activeAccounts: activosUnicos.length,
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
    sinFechaHist,
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
