// NPS calculado desde Supabase (clientes con NPS Score respondido).
// Filtra a cuentas churneadas (estado_dash='Bloqueado') con nps_score != null.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPlanBase, type PlanBase } from "./supabase-segmentacion";

const COUNTRIES = ["Argentina", "Chile", "México", "Colombia", "Brasil"] as const;
const COUNTRY_SET = new Set<string>(COUNTRIES);

export type NpsPaisRow = {
  pais: string;
  n: number;
  promotores: number;
  pasivos: number;
  detractores: number;
  ltrAvg: number;
  promPct: number;
  pasPct: number;
  detPct: number;
  nps: number;
  alerta: boolean;
};

export type NpsMotivoRow = { motivo: string; n: number; pct: number };

export type NpsPlanRow = {
  plan: PlanBase | "Otro";
  n: number;
  promotores: number;
  detractores: number;
  nps: number;
};

export type NpsEjecutivoRow = {
  ejecutivo: string;
  n: number;
  promotores: number;
  detractores: number;
  nps: number;
  detPct: number;
};

export type NpsPeriodoRow = {
  periodo: string;
  n: number;
  promotores: number;
  detractores: number;
  nps: number;
};

export type NpsData = {
  total: number;
  promotores: number;
  pasivos: number;
  detractores: number;
  promPct: number;
  pasPct: number;
  detPct: number;
  npsGlobal: number;
  ltrAvg: number;
  npsPais: NpsPaisRow[];
  motivosDetraccion: NpsMotivoRow[];
  motivosPromocion: NpsMotivoRow[];
  npsPlan: NpsPlanRow[];
  npsEjecutivo: NpsEjecutivoRow[];
  npsPeriodos: NpsPeriodoRow[];
  // Paradoja promotor
  promotoresChurnPct: number;
  promotoresCerroNegocioPct: number;
  promotoresSinMotivoPct: number;
  promotoresMaxPorPrecio: number;
};

type RawNps = {
  pais: string | null;
  ejecutivo: string | null;
  plan: string | null;
  nps_score: number | string | null;
  nps_categoria: string | null;
  nps_periodo: string | null;
  nps_motivo: string | null;
  nps_submotivo: string | null;
  motivo_baja: string | null;
};

function mapPais(p: string | null): string {
  if (!p) return "Otros";
  const t = p.trim();
  return COUNTRY_SET.has(t) ? t : "Otros";
}
function mapEjecutivo(e: string | null): string {
  if (!e) return "Sin asignar";
  const t = e.trim();
  if (!t || /\(Deactivated User\)/i.test(t)) return "Sin asignar";
  return t;
}
function catFromScore(s: number): "P" | "N" | "D" {
  if (s >= 9) return "P";
  if (s >= 7) return "N";
  return "D";
}
function npsFrom(prom: number, det: number, total: number) {
  if (!total) return 0;
  return ((prom - det) / total) * 100;
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

async function fetchNps(mesActivo: string): Promise<NpsData> {
  const raws = await pageAll<RawNps>(() => supabase
    .from("clientes")
    .select("pais,ejecutivo,plan,nps_score,nps_categoria,nps_periodo,nps_motivo,nps_submotivo,motivo_baja")
    .eq("mes_exportacion", mesActivo)
    .eq("estado_dash", "Bloqueado")
    .not("nps_score", "is", null));

  type Row = {
    pais: string; ejecutivo: string; plan: PlanBase | null;
    score: number; cat: "P" | "N" | "D"; periodo: string;
    motivo: string | null; motivoBaja: string | null;
  };
  const rows: Row[] = [];
  for (const r of raws) {
    const s = typeof r.nps_score === "number" ? r.nps_score : parseFloat(r.nps_score ?? "");
    if (!isFinite(s)) continue;
    rows.push({
      pais: mapPais(r.pais),
      ejecutivo: mapEjecutivo(r.ejecutivo),
      plan: mapPlanBase(r.plan),
      score: s,
      cat: catFromScore(s),
      periodo: (r.nps_periodo ?? "Sin período").trim() || "Sin período",
      motivo: r.nps_motivo?.trim() || null,
      motivoBaja: r.motivo_baja?.trim() || null,
    });
  }

  const total = rows.length;
  const promotores = rows.filter((r) => r.cat === "P").length;
  const pasivos = rows.filter((r) => r.cat === "N").length;
  const detractores = rows.filter((r) => r.cat === "D").length;
  const npsGlobal = npsFrom(promotores, detractores, total);
  const ltrAvg = total ? rows.reduce((s, r) => s + r.score, 0) / total : 0;

  // País
  const byPais = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byPais.get(r.pais) ?? [];
    arr.push(r);
    byPais.set(r.pais, arr);
  }
  const npsPais: NpsPaisRow[] = [...byPais.entries()]
    .map(([pais, arr]) => {
      const n = arr.length;
      const p = arr.filter((x) => x.cat === "P").length;
      const pa = arr.filter((x) => x.cat === "N").length;
      const d = arr.filter((x) => x.cat === "D").length;
      const ltr = n ? arr.reduce((s, x) => s + x.score, 0) / n : 0;
      const detPct = n ? (d / n) * 100 : 0;
      return {
        pais, n,
        promotores: p, pasivos: pa, detractores: d,
        ltrAvg: ltr,
        promPct: n ? (p / n) * 100 : 0,
        pasPct: n ? (pa / n) * 100 : 0,
        detPct,
        nps: npsFrom(p, d, n),
        alerta: false,
      };
    })
    .sort((a, b) => b.n - a.n);
  // Marcar alerta al país con mayor % detractores (mínimo n=10)
  const elig = npsPais.filter((p) => p.n >= 10);
  if (elig.length) {
    const worst = elig.reduce((m, p) => (p.detPct > m.detPct ? p : m));
    const row = npsPais.find((p) => p.pais === worst.pais);
    if (row) row.alerta = true;
  }

  // Motivos
  function topMotivos(filter: (r: Row) => boolean, baseN: number): NpsMotivoRow[] {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!filter(r)) continue;
      const m = r.motivo;
      if (!m) continue;
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([motivo, n]) => ({ motivo, n, pct: baseN ? (n / baseN) * 100 : 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }
  const motivosDetraccion = topMotivos((r) => r.cat === "D", detractores);
  const motivosPromocion = topMotivos((r) => r.cat === "P", promotores);

  // Plan
  const byPlan = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.plan ?? "Otro";
    const arr = byPlan.get(k) ?? [];
    arr.push(r);
    byPlan.set(k, arr);
  }
  const npsPlan: NpsPlanRow[] = [...byPlan.entries()]
    .map(([plan, arr]) => {
      const p = arr.filter((x) => x.cat === "P").length;
      const d = arr.filter((x) => x.cat === "D").length;
      return { plan: plan as PlanBase | "Otro", n: arr.length, promotores: p, detractores: d, nps: npsFrom(p, d, arr.length) };
    })
    .filter((x) => x.n >= 5)
    .sort((a, b) => b.nps - a.nps);

  // Ejecutivo
  const byEje = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byEje.get(r.ejecutivo) ?? [];
    arr.push(r);
    byEje.set(r.ejecutivo, arr);
  }
  const npsEjecutivo: NpsEjecutivoRow[] = [...byEje.entries()]
    .map(([ejecutivo, arr]) => {
      const n = arr.length;
      const p = arr.filter((x) => x.cat === "P").length;
      const d = arr.filter((x) => x.cat === "D").length;
      return {
        ejecutivo, n,
        promotores: p, detractores: d,
        nps: npsFrom(p, d, n),
        detPct: n ? (d / n) * 100 : 0,
      };
    })
    .filter((x) => x.n >= 10 && x.ejecutivo !== "Sin asignar")
    .sort((a, b) => b.nps - a.nps);

  // Periodos
  const byPer = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byPer.get(r.periodo) ?? [];
    arr.push(r);
    byPer.set(r.periodo, arr);
  }
  const npsPeriodos: NpsPeriodoRow[] = [...byPer.entries()]
    .map(([periodo, arr]) => {
      const p = arr.filter((x) => x.cat === "P").length;
      const d = arr.filter((x) => x.cat === "D").length;
      return { periodo, n: arr.length, promotores: p, detractores: d, nps: npsFrom(p, d, arr.length) };
    })
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  // Paradoja promotor
  const promRows = rows.filter((r) => r.cat === "P");
  const promCerro = promRows.filter((r) => (r.motivoBaja ?? "").toLowerCase().includes("cerr")).length;
  const promSinMotivo = promRows.filter((r) => !r.motivoBaja).length;
  const promotoresMaxPorPrecio = rows.filter((r) =>
    r.score === 10 && /precio|costo/i.test(r.motivoBaja ?? "")
  ).length;

  return {
    total, promotores, pasivos, detractores,
    promPct: total ? (promotores / total) * 100 : 0,
    pasPct: total ? (pasivos / total) * 100 : 0,
    detPct: total ? (detractores / total) * 100 : 0,
    npsGlobal, ltrAvg,
    npsPais, motivosDetraccion, motivosPromocion,
    npsPlan, npsEjecutivo, npsPeriodos,
    promotoresChurnPct: total ? (promotores / total) * 100 : 0,
    promotoresCerroNegocioPct: promotores ? (promCerro / promotores) * 100 : 0,
    promotoresSinMotivoPct: promotores ? (promSinMotivo / promotores) * 100 : 0,
    promotoresMaxPorPrecio,
  };
}

export function useSupabaseNps(mesActivo: string) {
  return useQuery({
    queryKey: ["supabase-nps", mesActivo],
    queryFn: () => fetchNps(mesActivo),
    enabled: Boolean(mesActivo),
    staleTime: 60_000,
  });
}
