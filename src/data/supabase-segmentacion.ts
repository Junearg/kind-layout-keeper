// Segmentación de churn calculada desde Supabase (clientes).
// Devuelve filas de bajas mapeadas (país agrupado, plan base, segmento GMV,
// ejecutivo) y bases activas por dimensión para cálculo de tasas.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mesCorto } from "./schema";

const COUNTRIES = ["Argentina", "Chile", "México", "Colombia", "Brasil"] as const;
const COUNTRY_SET = new Set<string>(COUNTRIES);

export type PaisSeg = (typeof COUNTRIES)[number] | "Otros";
export type PlanBase = "Inicial" | "Avanzado" | "Pro" | "Base";
export type GmvSeg = "Alto" | "Medio" | "Bajo";

export type BajaRow = {
  mesKey: string;          // "2026-04"
  mesLabel: string;        // "Abr"
  pais: PaisSeg;
  planBase: PlanBase | null;
  gmvSeg: GmvSeg | null;
  ejecutivo: string;       // "Sin asignar" si null o desactivado
};

export type SegmentacionData = {
  months: { key: string; label: string }[];
  rows: BajaRow[];
  activeBase: {
    pais: Record<string, number>;
    plan: Record<string, number>;
    gmv: Record<string, number>;
    ejecutivo: Record<string, number>;
  };
};

function mapPais(p: string | null): PaisSeg {
  if (!p) return "Otros";
  const t = p.trim();
  return COUNTRY_SET.has(t) ? (t as PaisSeg) : "Otros";
}

export function mapPlanBase(plan: string | null): PlanBase | null {
  if (!plan) return null;
  const first = plan.trim().toLowerCase().split("-")[0] ?? "";
  if (first === "ini" || first === "inicial") return "Inicial";
  if (first === "adv" || first === "avanzado") return "Avanzado";
  if (first === "pro") return "Pro";
  if (first === "base") return "Base";
  return null;
}

export function mapGmvSeg(gmv: number | string | null): GmvSeg | null {
  if (gmv == null) return null;
  const n = typeof gmv === "number" ? gmv : parseFloat(gmv);
  if (!isFinite(n)) return null;
  if (n >= 100_000) return "Alto";
  if (n >= 30_000) return "Medio";
  if (n >= 0) return "Bajo";
  return null;
}

function mapEjecutivo(e: string | null): string {
  if (!e) return "Sin asignar";
  const t = e.trim();
  if (!t) return "Sin asignar";
  if (/\(Deactivated User\)/i.test(t)) return "Sin asignar";
  return t;
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

function prevMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

async function fetchSegmentacion(mesActivo: string): Promise<SegmentacionData> {
  // Últimos 6 meses cerrados terminando en mesActivo (inclusive).
  const months: { key: string; label: string }[] = [];
  let k = mesActivo;
  for (let i = 0; i < 6; i++) {
    months.unshift({ key: k, label: mesCorto(k) });
    k = prevMonth(k);
  }
  const firstKey = months[0]!.key;
  const lastKey = months[months.length - 1]!.key;
  const [y, m] = lastKey.split("-").map(Number);
  const upperExclusive = `${m === 12 ? y! + 1 : y}-${String(m === 12 ? 1 : m! + 1).padStart(2, "0")}-01`;
  const lowerInclusive = `${firstKey}-01`;
  const monthSet = new Set(months.map((mm) => mm.key));

  type RawBaja = {
    pais: string | null;
    ejecutivo: string | null;
    plan: string | null;
    gmv: number | string | null;
    fecha_baja: string | null;
  };
  type RawActive = {
    pais: string | null;
    ejecutivo: string | null;
    plan: string | null;
    gmv: number | string | null;
  };

  const [bajasRaw, activosRaw] = await Promise.all([
    pageAll<RawBaja>(() => supabase
      .from("clientes")
      .select("pais,ejecutivo,plan,gmv,fecha_baja")
      .eq("mes_exportacion", mesActivo)
      .eq("estado_dash", "Bloqueado")
      .not("fecha_baja", "is", null)
      .gte("fecha_baja", lowerInclusive)
      .lt("fecha_baja", upperExclusive)),
    pageAll<RawActive>(() => supabase
      .from("clientes")
      .select("pais,ejecutivo,plan,gmv")
      .eq("mes_exportacion", mesActivo)
      .eq("estado_dash", "Activo")),
  ]);

  const rows: BajaRow[] = [];
  for (const b of bajasRaw) {
    if (!b.fecha_baja) continue;
    const mk = monthKey(new Date(b.fecha_baja));
    if (!monthSet.has(mk)) continue;
    rows.push({
      mesKey: mk,
      mesLabel: mesCorto(mk),
      pais: mapPais(b.pais),
      planBase: mapPlanBase(b.plan),
      gmvSeg: mapGmvSeg(b.gmv),
      ejecutivo: mapEjecutivo(b.ejecutivo),
    });
  }

  const activeBase = {
    pais: {} as Record<string, number>,
    plan: {} as Record<string, number>,
    gmv: {} as Record<string, number>,
    ejecutivo: {} as Record<string, number>,
  };
  for (const a of activosRaw) {
    const p = mapPais(a.pais);
    activeBase.pais[p] = (activeBase.pais[p] ?? 0) + 1;
    const pb = mapPlanBase(a.plan);
    if (pb) activeBase.plan[pb] = (activeBase.plan[pb] ?? 0) + 1;
    const gs = mapGmvSeg(a.gmv);
    if (gs) activeBase.gmv[gs] = (activeBase.gmv[gs] ?? 0) + 1;
    const e = mapEjecutivo(a.ejecutivo);
    activeBase.ejecutivo[e] = (activeBase.ejecutivo[e] ?? 0) + 1;
  }

  return { months, rows, activeBase };
}

export function useSupabaseSegmentacion(mesActivo: string) {
  return useQuery({
    queryKey: ["supabase-segmentacion", mesActivo],
    queryFn: () => fetchSegmentacion(mesActivo),
    enabled: Boolean(mesActivo),
    staleTime: 60_000,
  });
}

/** Lista los períodos MENSUALES disponibles en Supabase (formato YYYY-MM),
 *  ordenados de más reciente a más antiguo. */
async function fetchPeriodosDisponibles(): Promise<string[]> {
  const { data } = await supabase
    .from("clientes")
    .select("mes_exportacion")
    .order("mes_exportacion", { ascending: false });

  const all = (data ?? []).map((r: { mes_exportacion: string }) => r.mes_exportacion as string);
  // Solo mensuales: exactamente "YYYY-MM" (10 chars = diarios, 7 = mensuales)
  const monthly = Array.from(new Set(all.filter((m) => m && m.length === 7)));
  return monthly.sort().reverse();
}

export function usePeriodosDisponibles() {
  return useQuery({
    queryKey: ["periodos-disponibles"],
    queryFn:  fetchPeriodosDisponibles,
    staleTime: 5 * 60_000,
  });
}

export const PAISES_ORDER: PaisSeg[] = [...COUNTRIES, "Otros"];
export const PLANES_ORDER: PlanBase[] = ["Inicial", "Avanzado", "Pro", "Base"];
export const GMVS_ORDER: GmvSeg[] = ["Alto", "Medio", "Bajo"];
