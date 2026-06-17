// Métricas de retención calculadas desde Supabase.
// Incluye: A Recuperar, activas ≥10v, login, Churn Bruto/Neto vs Plan.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Pais } from "@/contexts/CountryContext";
import { PAISES_CONOCIDOS } from "@/contexts/CountryContext";
import { getChurnPlan } from "@/lib/churn-plan";

const ETAPAS_BAJA     = ["Bajas", "Bajas clientes"] as const;
const ETAPAS_RECUPERAR = ["Engagement", "Onboarding"] as const;

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

/** Aplica filtro de país a un query builder de Supabase. */
function applyPaisFilter(query: any, pais: Pais) {
  if (pais === "Región") return query;
  if (pais === "Others") {
    // "Others" = todos los que NO son los países conocidos
    return query.not("pais", "in", `(${PAISES_CONOCIDOS.join(",")})`);
  }
  return query.eq("pais", pais);
}

/** Clasifica último login por rango de días. */
function loginLabel(ultima: string | null): string {
  if (!ultima) return "Nunca login";
  const days = (Date.now() - new Date(ultima).getTime()) / 86_400_000;
  if (days < 7)   return "Menos de 7 días";
  if (days < 14)  return "Entre 7 y 13 días";
  if (days < 30)  return "Entre 14 y 29 días";
  if (days < 60)  return "Entre 30 y 59 días";
  return "Más de 60 días";
}

export type RetentionData = {
  period: string;
  pais: Pais;

  // Base
  mpcsMesPasado: number;        // activas del snapshot anterior
  activasHoy: number;           // activas del período seleccionado
  aRecuperar: number;           // etapa Engagement + Onboarding
  aRecuperarConVentas: number;  // de las anteriores, con ≥10 ventas/mes

  // Actividad
  activasConVentas: number;     // activas ≥10 ventas mensuales
  pctActivasConVentas: number;  // %
  loginMenos7: number;          // login < 7 días
  pctLoginMenos7: number;       // %
  loginDist: { label: string; n: number; pct: number }[];

  // Churn
  churnBruto: number;           // bajas / MPCs_mes_pasado (%)
  churnNeto: number;            // 1 - activas_hoy / MPCs_mes_pasado (%)
  churnPlan: number | null;     // target del plan (%)
  proyectadoVsPlan: number | null; // (churnNeto - churnPlan) / churnPlan × 100 (%)
  nRecuperar: number | null;    // cuentas a recuperar para estar on target
  mpcsMeta: number | null;      // (1 - churnPlan/100) × mpcsMesPasado
};

/** Retorna el primer día del mes siguiente como string "YYYY-MM-DD". */
function nextMonthStart(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return `${period}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

async function fetchRetention(period: string, pais: Pais): Promise<RetentionData> {
  // Período anterior
  const [y, m] = period.split("-").map(Number);
  const prevY = m === 1 ? y! - 1 : y!;
  const prevM = m === 1 ? 12 : m! - 1;
  const prevPeriod = `${prevY}-${String(prevM).padStart(2, "0")}`;

  type ActiveRow = {
    v_salon: number | null;
    v_delivery: number | null;
    v_mostrador: number | null;
    ultima_fecha_contacto: string | null;
  };

  const [activasRows, prevCount, bajasCount, recuperarRows] = await Promise.all([
    // Activas hoy
    pageAll<ActiveRow>(() => applyPaisFilter(
      supabase.from("clientes")
        .select("v_salon,v_delivery,v_mostrador,ultima_fecha_contacto")
        .eq("mes_exportacion", period)
        .eq("estado_dash", "Activo"),
      pais
    )),
    // MPCs mes pasado (count)
    applyPaisFilter(
      supabase.from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("mes_exportacion", prevPeriod)
        .eq("estado_dash", "Activo"),
      pais
    ),
    // Bajas brutas período actual — filtrar por fecha_baja dentro del mes
    // para no contar bajas históricas acumuladas en el snapshot.
    applyPaisFilter(
      supabase.from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("mes_exportacion", period)
        .in("etapa", ETAPAS_BAJA)
        .gte("fecha_baja", `${period}-01`)
        .lt("fecha_baja", nextMonthStart(period)),
      pais
    ),
    // A Recuperar (Engagement + Onboarding)
    pageAll<{ v_salon: number | null; v_delivery: number | null; v_mostrador: number | null }>(() =>
      applyPaisFilter(
        supabase.from("clientes")
          .select("v_salon,v_delivery,v_mostrador")
          .eq("mes_exportacion", period)
          .in("etapa", ETAPAS_RECUPERAR),
        pais
      )
    ),
  ]);

  const activasHoy = activasRows.length;
  const mpcsMesPasado = prevCount.count ?? 0;
  const bajasBrutas = bajasCount.count ?? 0;
  const aRecuperar = recuperarRows.length;

  // Activas con ≥10 ventas mensuales
  const activasConVentas = activasRows.filter(r =>
    ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10
  ).length;

  // A recuperar con ≥10 ventas
  const aRecuperarConVentas = recuperarRows.filter(r =>
    ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10
  ).length;

  // Login < 7 días
  const loginMenos7 = activasRows.filter(r => {
    if (!r.ultima_fecha_contacto) return false;
    return (Date.now() - new Date(r.ultima_fecha_contacto).getTime()) / 86_400_000 < 7;
  }).length;

  // Distribución login
  const loginMap = new Map<string, number>();
  for (const r of activasRows) {
    const label = loginLabel(r.ultima_fecha_contacto);
    loginMap.set(label, (loginMap.get(label) ?? 0) + 1);
  }
  const loginDist = Array.from(loginMap.entries())
    .map(([label, n]) => ({ label, n, pct: activasHoy ? (n / activasHoy) * 100 : 0 }))
    .sort((a, b) => b.n - a.n);

  // Churn
  const base = mpcsMesPasado || 1;
  const churnBruto = (bajasBrutas / base) * 100;
  const churnNeto  = mpcsMesPasado ? (1 - activasHoy / mpcsMesPasado) * 100 : 0;
  const churnPlan  = getChurnPlan(period, pais);
  const proyectadoVsPlan = churnPlan != null ? ((churnNeto - churnPlan) / churnPlan) * 100 : null;
  const mpcsMeta   = churnPlan != null ? Math.round((1 - churnPlan / 100) * mpcsMesPasado) : null;
  const nRecuperar = mpcsMeta != null ? Math.max(0, mpcsMeta - activasHoy) : null;

  return {
    period, pais,
    mpcsMesPasado, activasHoy, aRecuperar, aRecuperarConVentas,
    activasConVentas, pctActivasConVentas: activasHoy ? (activasConVentas / activasHoy) * 100 : 0,
    loginMenos7, pctLoginMenos7: activasHoy ? (loginMenos7 / activasHoy) * 100 : 0,
    loginDist,
    churnBruto, churnNeto, churnPlan, proyectadoVsPlan, nRecuperar, mpcsMeta,
  };
}

export function useRetention(period: string, pais: Pais) {
  return useQuery({
    queryKey: ["retention", period, pais],
    queryFn: () => fetchRetention(period, pais),
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}
