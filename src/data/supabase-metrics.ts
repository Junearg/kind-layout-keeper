import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TierKey = "Champion" | "Healthy" | "At Risk" | "Critical";

export type SupabaseMetrics = {
  period: string;
  cuentasActivas: number;
  bajasMes: { motivo_baja: string | null; pais: string | null }[];
  bajasTotal: number;
  bajasPorMotivo: { motivo: string; n: number }[];
  bajasPorPais: { pais: string; n: number }[];
  nps: { promotores: number; pasivos: number; detractores: number; total: number; score: number };
  tierDist: { tier: TierKey; n: number; pct: number }[];
};

const ETAPAS_BAJA = ["Bajas", "Bajas clientes"] as const;

function endOfMonthISO(period: string): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  // Day 0 of next month = last day of this month
  const last = new Date(Date.UTC(y, m, 0));
  return last.toISOString().split("T")[0];
}

// Health score 0-100 sobre campos de actividad y voz del cliente.
// Pesos: NPS 25, CSAT 15, Adopción 30, Volumen ventas 20, Recencia contacto 10.
type ScoreRow = {
  nps_score: number | null;
  csat_cs_promedio: number | null;
  csat_onb_promedio: number | null;
  productos: number | null;
  ingredientes: number | null;
  ing_en_recetas: number | null;
  v_salon: number | null;
  v_delivery: number | null;
  v_mostrador: number | null;
  v_menu_online: number | null;
  ultima_fecha_contacto: string | null;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function normalizeNps(v: number | null): number | null {
  if (v == null) return null;
  return v > 10 ? v / 10 : v;
}

function scoreCuenta(r: ScoreRow): number {
  // NPS normalizado a 0-10, luego escalado a 0-100
  const npsNorm = normalizeNps(r.nps_score);
  const nps = npsNorm == null ? 50 : clamp((npsNorm / 10) * 100);
  // CSAT prom (0..5) → 0..100
  const csatVals = [r.csat_cs_promedio, r.csat_onb_promedio].filter((v): v is number => v != null);
  const csat = csatVals.length ? clamp((csatVals.reduce((a, b) => a + b, 0) / csatVals.length / 5) * 100) : 50;
  // Adopción: productos+ingredientes+recetas (heurística log-saturada)
  const adop = clamp(
    Math.log10(1 + (r.productos ?? 0) + (r.ingredientes ?? 0) + (r.ing_en_recetas ?? 0)) * 33,
  );
  // Volumen: suma canales (log)
  const vol = clamp(
    Math.log10(1 + (r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0) + (r.v_menu_online ?? 0)) * 20,
  );
  // Recencia contacto: días desde último contacto
  let rec = 50;
  if (r.ultima_fecha_contacto) {
    const days = (Date.now() - new Date(r.ultima_fecha_contacto).getTime()) / (1000 * 60 * 60 * 24);
    rec = clamp(100 - days * 1.5);
  }
  return Math.round(nps * 0.25 + csat * 0.15 + adop * 0.30 + vol * 0.20 + rec * 0.10);
}

function tierFromScore(s: number): TierKey {
  if (s >= 80) return "Champion";
  if (s >= 55) return "Healthy";
  if (s >= 30) return "At Risk";
  return "Critical";
}

async function fetchMetrics(period: string): Promise<SupabaseMetrics> {
  const mesInicio = `${period}-01`;
  const mesFin = endOfMonthISO(period);

  const [activasRes, bajasRes, npsRes, scoreRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("mes_exportacion", period)
      .eq("estado_dash", "Activo"),
    supabase
      .from("clientes")
      .select("motivo_baja, pais")
      .eq("mes_exportacion", period)
      .in("etapa", ETAPAS_BAJA),
    supabase
      .from("clientes")
      .select("nps_score")
      .eq("mes_exportacion", period)
      .not("nps_score", "is", null),
    supabase
      .from("clientes")
      .select(
        "nps_score, csat_cs_promedio, csat_onb_promedio, productos, ingredientes, ing_en_recetas, v_salon, v_delivery, v_mostrador, v_menu_online, ultima_fecha_contacto",
      )
      .eq("mes_exportacion", period)
      .eq("estado_dash", "Activo"),
  ]);

  if (activasRes.error) throw activasRes.error;
  if (bajasRes.error) throw bajasRes.error;
  if (npsRes.error) throw npsRes.error;
  if (scoreRes.error) throw scoreRes.error;

  // NPS
  const scores = (npsRes.data ?? []).map((r) => Number(r.nps_score)).filter((n) => Number.isFinite(n));
  const promotores = scores.filter((s) => s >= 9).length;
  const detractores = scores.filter((s) => s <= 6).length;
  const pasivos = scores.length - promotores - detractores;
  const total = scores.length;
  const score = total ? ((promotores - detractores) / total) * 100 : 0;

  // Bajas agregadas — excluyendo motivos operacionales (no son churn real).
  const OPERATIONAL_MOTIVOS = new Set(["CHANGE_METHOD", "CHANGE_FREQUENCY"]);
  const bajasMes = ((bajasRes.data ?? []) as { motivo_baja: string | null; pais: string | null }[])
    .filter((b) => !(b.motivo_baja && OPERATIONAL_MOTIVOS.has(b.motivo_baja.trim().toUpperCase())));
  const motivoMap = new Map<string, number>();
  const paisMap = new Map<string, number>();
  for (const b of bajasMes) {
    const mk = b.motivo_baja ?? "Sin especificar";
    motivoMap.set(mk, (motivoMap.get(mk) ?? 0) + 1);
    const pk = b.pais ?? "Sin país";
    paisMap.set(pk, (paisMap.get(pk) ?? 0) + 1);
  }

  // Tier dist
  const rows = (scoreRes.data ?? []) as ScoreRow[];
  const tierCount: Record<TierKey, number> = { Champion: 0, Healthy: 0, "At Risk": 0, Critical: 0 };
  for (const r of rows) tierCount[tierFromScore(scoreCuenta(r))]++;
  const totalScored = rows.length || 1;
  const tierDist = (Object.keys(tierCount) as TierKey[]).map((tier) => ({
    tier,
    n: tierCount[tier],
    pct: (tierCount[tier] / totalScored) * 100,
  }));

  return {
    period,
    cuentasActivas: activasRes.count ?? 0,
    bajasMes,
    bajasTotal: bajasMes.length,
    bajasPorMotivo: Array.from(motivoMap.entries())
      .map(([motivo, n]) => ({ motivo, n }))
      .sort((a, b) => b.n - a.n),
    bajasPorPais: Array.from(paisMap.entries())
      .map(([pais, n]) => ({ pais, n }))
      .sort((a, b) => b.n - a.n),
    nps: { promotores, pasivos, detractores, total, score },
    tierDist,
  };
}

export function useSupabaseMetrics(period: string) {
  return useQuery({
    queryKey: ["supabase-metrics", period],
    queryFn: () => fetchMetrics(period),
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}
