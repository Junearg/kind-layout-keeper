// Tendencia + WMA forecast calculados desde Supabase (clientes) con el
// filtro de motivos operacionales aplicado a nivel de fila. Esta es la
// ÚNICA fuente de verdad para conteos de churn — no usar tendencia_mensual
// ni resumen_mensual del workbook (vienen pre-agregados con churn operacional).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mesCorto } from "./schema";
import { normalizarMotivo, type MotivoCat } from "@/lib/motivo-normalizer";

const OPERATIONAL_MOTIVOS = new Set(["CHANGE_METHOD", "CHANGE_FREQUENCY"]);
const ETAPAS_BAJA = ["Bajas", "Bajas clientes"] as const;
const WMA_WEIGHTS = [0.5, 0.3, 0.2] as const;

export const PLANES = ["Inicial", "Avanzado", "Pro"] as const;
export type Plan = (typeof PLANES)[number];

export type TrendRatePoint = {
  mes: string;
  key: string;
  bajas: number;
  activeBase: number;
  rate: number;       // churn bruto %
  rateNeto?: number | null;          // caída neta de activas %
  ratioRecuperadas?: number | null;  // bruto − neto (cuentas que volvieron)
  activasFinMes?: number | null;
  proyectado: boolean;
  bajasMin?: number;
  bajasMax?: number;
  rateMin?: number;
  rateMax?: number;
  bajasError?: [number, number];
  motivoBreakdown?: Partial<Record<MotivoCat, number>>;
  planBreakdown?: Partial<Record<Plan, number>>;
  planRates?: Partial<Record<Plan, number>>;
};

export type TrendRate = {
  points: TrendRatePoint[];
  closed: TrendRatePoint[];
  projected: TrendRatePoint[];
  latestRate: number | null;
  wmaRate: number | null;
  stdDev: number;
  ytdActualClosed: number;
  totalProjected: number;
  periodoEstimado: number;
};

function emptyTrend(): TrendRate {
  return {
    points: [], closed: [], projected: [],
    latestRate: null, wmaRate: null, stdDev: 0,
    ytdActualClosed: 0, totalProjected: 0, periodoEstimado: 0,
  };
}

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

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

async function fetchTrendRate(mesActivo: string): Promise<TrendRate> {
  if (!mesActivo) return emptyTrend();

  // 1. Todas las bajas reales: etapa IN ("Bajas", "Bajas clientes").
  type BajaRow = {
    fecha_baja: string | null;
    motivo_baja: string | null;
    submotivo_baja: string | null;
    motivo_metabase: string | null;
    comentarios_metabase: string | null;
    plan: string | null;
  };
  const bajasRaw = await pageAll<BajaRow>(() => supabase
    .from("clientes")
    .select("fecha_baja,motivo_baja,submotivo_baja,motivo_metabase,comentarios_metabase,plan")
    .eq("mes_exportacion", mesActivo)
    .in("etapa", ETAPAS_BAJA));

  // Filtro: excluir motivos operacionales (no son churn real de cliente).
  const bajas = bajasRaw.filter(
    (b) => !(b.motivo_baja && OPERATIONAL_MOTIVOS.has(b.motivo_baja.trim().toUpperCase())),
  );

  // 2. Agrupar por mes calendario + breakdown por motivo y por plan.
  const byMonth = new Map<string, number>();
  const byMonthMotivo = new Map<string, Partial<Record<MotivoCat, number>>>();
  const byMonthPlan   = new Map<string, Partial<Record<Plan, number>>>();
  for (const b of bajas) {
    if (!b.fecha_baja) continue;
    const k = monthKey(new Date(b.fecha_baja));
    if (k > mesActivo) continue;
    byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    // motivo
    const cat = normalizarMotivo(b.motivo_baja, b.submotivo_baja, b.motivo_metabase, b.comentarios_metabase);
    const mb = byMonthMotivo.get(k) ?? {};
    mb[cat] = (mb[cat] ?? 0) + 1;
    byMonthMotivo.set(k, mb);
    // plan
    const plan = (b.plan ?? "") as Plan;
    if (PLANES.includes(plan)) {
      const pb = byMonthPlan.get(k) ?? {};
      pb[plan] = (pb[plan] ?? 0) + 1;
      byMonthPlan.set(k, pb);
    }
  }

  // Activas por plan del snapshot actual (denominador para tasas por plan)
  const activasPorPlan: Partial<Record<Plan, number>> = {};
  await Promise.all(PLANES.map(async (plan) => {
    const { count } = await supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("mes_exportacion", mesActivo)
      .eq("estado_dash", "Activo")
      .eq("plan", plan);
    activasPorPlan[plan] = count ?? 0;
  }));
  // Últimos 12 meses con bajas registradas (ascendente).
  const closedKeys = Array.from(byMonth.keys()).sort().slice(-12);
  if (closedKeys.length === 0) return emptyTrend();

  // 3. Cuentas activas (estado_dash=Activo) en CADA snapshot mes_exportacion
  //    correspondiente al fin de cada mes cerrado. Counts paralelos.
  const activeCounts = await Promise.all(
    closedKeys.map(async (k) => {
      const [totalRes, activeRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("*", { count: "exact", head: true })
          .eq("mes_exportacion", k),
        supabase
          .from("clientes")
          .select("*", { count: "exact", head: true })
          .eq("mes_exportacion", k)
          .eq("estado_dash", "Activo"),
      ]);
      if (totalRes.error || activeRes.error || !totalRes.count) return [k, null] as const;
      return [k, activeRes.count ?? 0] as const;
    }),
  );
  const activeByMonth = new Map<string, number | null>(activeCounts);

  // 4. Construir puntos cerrados con base activa al INICIO del mes.
  //    Estrategia: 1) usar end-of-prev-snapshot si existe; 2) si no, usar
  //    end-of-this-snapshot + bajas; 3) si tampoco existe ese snapshot,
  //    reconstruir hacia atrás (end-of-mes-k = activeBase[mes-k+1]).
  const activeBaseByKey = new Map<string, number>();
  // Pasada 1: directo desde snapshots disponibles.
  for (let i = 0; i < closedKeys.length; i++) {
    const k = closedKeys[i]!;
    const bajasMes = byMonth.get(k) ?? 0;
    const prevKey = i > 0 ? closedKeys[i - 1]! : null;
    const endPrev = prevKey ? activeByMonth.get(prevKey) ?? null : null;
    const endThis = activeByMonth.get(k) ?? null;
    if (endPrev != null) activeBaseByKey.set(k, endPrev);
    else if (endThis != null) activeBaseByKey.set(k, endThis + bajasMes);
  }
  // Pasada 2: reconstruir hacia atrás los que quedaron sin base.
  for (let i = closedKeys.length - 2; i >= 0; i--) {
    const k = closedKeys[i]!;
    if (activeBaseByKey.has(k)) continue;
    const nextKey = closedKeys[i + 1]!;
    const nextBase = activeBaseByKey.get(nextKey);
    if (nextBase == null) continue;
    // end-of-mes-k = activeBase del mes siguiente.
    // activeBase[k] = end-of-mes-k + bajas[k]
    activeBaseByKey.set(k, nextBase + (byMonth.get(k) ?? 0));
  }

  const closed: TrendRatePoint[] = closedKeys.map((k) => {
    const bajasMes = byMonth.get(k) ?? 0;
    const activeBase = activeBaseByKey.get(k) ?? 0;
    const rate = activeBase > 0 ? (bajasMes / activeBase) * 100 : 0;
    // Tasas por plan: bajas_plan / activas_plan_snapshot_actual (aproximación)
    const pb = byMonthPlan.get(k) ?? {};
    const planRates: Partial<Record<Plan, number>> = {};
    for (const plan of PLANES) {
      const b = pb[plan] ?? 0;
      const a = activasPorPlan[plan] ?? 0;
      planRates[plan] = a > 0 ? (b / a) * 100 : 0;
    }
    // Churn neto y recuperadas
    const activasFinMes = activeByMonth.get(k) ?? null;
    const rateNeto = activasFinMes != null && activeBase > 0
      ? ((activeBase - activasFinMes) / activeBase) * 100
      : null;
    const ratioRecuperadas = rateNeto != null ? Math.max(0, rate - rateNeto) : null;
    return {
      mes: mesCorto(k),
      key: k,
      bajas: bajasMes,
      activeBase,
      rate,
      rateNeto,
      ratioRecuperadas,
      activasFinMes,
      proyectado: false,
      motivoBreakdown: byMonthMotivo.get(k) ?? {},
      planBreakdown: pb,
      planRates,
    };
  });

  const latestClosed = closed[closed.length - 1] ?? null;
  const latestRate = latestClosed ? latestClosed.rate : null;

  // 5. WMA sobre últimas 3 tasas cerradas.
  const last3 = closed.slice(-3).map((p) => p.rate);
  let wmaRate: number | null = null;
  if (last3.length > 0) {
    const padded = [...Array(3 - last3.length).fill(0), ...last3];
    const reversed = [...padded].reverse();
    const totalW = WMA_WEIGHTS.slice(0, last3.length).reduce((s, w) => s + w, 0);
    wmaRate = reversed.reduce((s, v, idx) => s + v * (WMA_WEIGHTS[idx] ?? 0), 0) / (totalW || 1);
  }
  const sd = stdDev(last3);

  // 6. Proyectar meses restantes del año (compounding sobre base).
  const projected: TrendRatePoint[] = [];
  if (latestClosed && wmaRate !== null && latestClosed.activeBase > 0) {
    const year = Number(latestClosed.key.split("-")[0]);
    let baseAtStart =
      activeByMonth.get(latestClosed.key) ?? Math.max(0, latestClosed.activeBase - latestClosed.bajas);
    let curKey = nextMonth(latestClosed.key);
    while (Number(curKey.split("-")[0]) === year) {
      const safeBase = Math.max(0, baseAtStart);
      const bajas = Math.max(0, Math.round((safeBase * wmaRate) / 100));
      const rateLow = Math.max(0, wmaRate - sd);
      const rateHigh = wmaRate + sd;
      const bajasMin = Math.max(0, Math.round((safeBase * rateLow) / 100));
      const bajasMax = Math.max(0, Math.round((safeBase * rateHigh) / 100));
      projected.push({
        mes: mesCorto(curKey),
        key: curKey,
        bajas,
        activeBase: safeBase,
        rate: wmaRate,
        proyectado: true,
        bajasMin,
        bajasMax,
        rateMin: rateLow,
        rateMax: rateHigh,
        bajasError: [bajas - bajasMin, bajasMax - bajas],
      });
      baseAtStart = safeBase - bajas;
      curKey = nextMonth(curKey);
    }
  }

  const points = [...closed, ...projected];
  const activeYear = latestClosed ? latestClosed.key.split("-")[0] : mesActivo.split("-")[0];
  const ytdActualClosed = closed
    .filter((p) => p.key.startsWith(`${activeYear}-`))
    .reduce((s, p) => s + p.bajas, 0);
  const totalProjected = projected.reduce((s, p) => s + p.bajas, 0);

  return {
    points, closed, projected,
    latestRate, wmaRate, stdDev: sd,
    ytdActualClosed, totalProjected,
    periodoEstimado: ytdActualClosed + totalProjected,
  };
}

export function useSupabaseTrendRate(mesActivo: string) {
  return useQuery({
    queryKey: ["supabase-trend-rate", mesActivo],
    queryFn: () => fetchTrendRate(mesActivo),
    enabled: Boolean(mesActivo),
    staleTime: 60_000,
  });
}

export { emptyTrend };
