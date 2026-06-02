// KPIs diarios calculados desde los snapshots daily de la tabla clientes.
// Los snapshots daily tienen mes_exportacion en formato YYYY-MM-DD.
// Estructura replica columna J del GSheet de Retención: 25 métricas × N países.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Pais } from "@/contexts/CountryContext";
import { PAISES, PAISES_CONOCIDOS } from "@/contexts/CountryContext";
import { getChurnPlan } from "@/lib/churn-plan";

const ETAPAS_BAJA      = ["Bajas", "Bajas clientes"] as const;
const ETAPAS_RECUPERAR = ["Engagement", "Onboarding"] as const;

function applyPais(query: any, pais: Pais) {
  if (pais === "Región") return query;
  if (pais === "Others") return query.not("pais", "in", `(${PAISES_CONOCIDOS.join(",")})`);
  return query.eq("pais", pais);
}

export type KpiDiario = {
  fecha: string;           // YYYY-MM-DD
  pais: Pais;

  // Bloque 1 — Cuentas por estado
  activas: number;
  pagoPendiente: number;
  bajas: number;           // Bajas Confirmadas
  aRecuperar: number;      // Onboarding + Engagement
  onboarding: number;
  engagement: number;

  // Bloque 2 — Actividad
  activasConVentas: number;   // Activas ≥10 ventas mensuales
  recuperar10v: number;       // A Recuperar con ≥10 ventas
  sinVentas: number;          // Activas con 0 ventas
  loginMenos7: number;        // Login < 7 días (absoluto)
  loginPct: number;           // % Login < 7 días

  // Bloque 3 — Tasas
  pct10v: number;             // % Activas ≥10v mensual
  pctRetenido: number;        // activas / prevActivas × 100
  pctRetenido10v: number;     // activasConVentas / prevActivas × 100

  // Bloque 4 — Churn
  churnBruto: number;
  churnNeto: number;
  churnPlan: number | null;
  proyectadoVsPlan: number | null;  // (churnNeto - churnPlan) / churnPlan × 100

  // Bloque 5 — Plan
  mpcsMesPasado: number;
  nRecuperar: number | null;        // # cuentas para cumplir plan
  mpcsMeta: number | null;
  mpcsVsPlan: number | null;        // (activas - mpcsMeta) / mpcsMeta × 100
};

/** Calcula los 25 KPIs para un snapshot diario y país. */
export async function computeKpiDia(fecha: string, pais: Pais): Promise<KpiDiario> {
  type ActiveRow = {
    v_salon: number | null;
    v_delivery: number | null;
    v_mostrador: number | null;
    ultima_fecha_contacto: string | null;
  };
  type RecuperarRow = { v_salon: number | null; v_delivery: number | null; v_mostrador: number | null };

  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() - 1);
  const prevFecha = d.toISOString().slice(0, 10);

  const [
    activasRes, bajasRes, onboardingRes, engagementRes,
    pagoPendienteRes, prevActivasRes, recuperarRowsRes,
  ] = await Promise.all([
    applyPais(
      supabase.from("clientes")
        .select("v_salon,v_delivery,v_mostrador,ultima_fecha_contacto")
        .eq("mes_exportacion", fecha)
        .eq("estado_dash", "Activo"),
      pais
    ),
    applyPais(
      supabase.from("clientes").select("*", { count: "exact", head: true })
        .eq("mes_exportacion", fecha).in("etapa", ETAPAS_BAJA),
      pais
    ),
    applyPais(
      supabase.from("clientes").select("*", { count: "exact", head: true })
        .eq("mes_exportacion", fecha).eq("etapa", "Onboarding"),
      pais
    ),
    applyPais(
      supabase.from("clientes").select("*", { count: "exact", head: true })
        .eq("mes_exportacion", fecha).eq("etapa", "Engagement"),
      pais
    ),
    applyPais(
      supabase.from("clientes").select("*", { count: "exact", head: true })
        .eq("mes_exportacion", fecha).eq("estado_dash", "Pago Pendiente"),
      pais
    ),
    applyPais(
      supabase.from("clientes").select("*", { count: "exact", head: true })
        .eq("mes_exportacion", prevFecha).eq("estado_dash", "Activo"),
      pais
    ),
    // A Recuperar con datos de ventas (para recuperar10v)
    applyPais(
      supabase.from("clientes")
        .select("v_salon,v_delivery,v_mostrador")
        .eq("mes_exportacion", fecha)
        .in("etapa", ETAPAS_RECUPERAR),
      pais
    ),
  ]);

  const rows        = (activasRes.data ?? []) as ActiveRow[];
  const recRows     = (recuperarRowsRes.data ?? []) as RecuperarRow[];
  const activas     = rows.length;
  const bajas       = bajasRes.count ?? 0;
  const onboarding  = onboardingRes.count ?? 0;
  const engagement  = engagementRes.count ?? 0;
  const aRecuperar  = onboarding + engagement;
  const pagoPendiente = pagoPendienteRes.count ?? 0;
  const mpcsMesPasado = prevActivasRes.count ?? activas;

  const activasConVentas = rows.filter(r =>
    ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10
  ).length;

  const recuperar10v = recRows.filter(r =>
    ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10
  ).length;

  const sinVentas = rows.filter(r =>
    ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) === 0
  ).length;

  const loginMenos7 = rows.filter(r => {
    if (!r.ultima_fecha_contacto) return false;
    return (Date.now() - new Date(r.ultima_fecha_contacto).getTime()) / 86_400_000 < 7;
  }).length;

  const base          = mpcsMesPasado || 1;
  const pct10v        = activas > 0 ? (activasConVentas / activas) * 100 : 0;
  const loginPct      = activas > 0 ? (loginMenos7 / activas) * 100 : 0;
  const pctRetenido   = (activas / base) * 100;
  const pctRetenido10v = (activasConVentas / base) * 100;
  const churnNeto     = (1 - activas / base) * 100;
  const churnBruto    = (bajas / base) * 100;

  // Plan
  const mesKey = fecha.slice(0, 7);
  const churnPlan = getChurnPlan(mesKey, pais);
  const mpcsMeta  = churnPlan != null ? Math.round((1 - churnPlan / 100) * base) : null;
  const nRecuperar = mpcsMeta != null ? Math.max(0, mpcsMeta - activas) : null;
  const proyectadoVsPlan = churnPlan != null && churnPlan > 0
    ? ((churnNeto - churnPlan) / churnPlan) * 100 : null;
  const mpcsVsPlan = mpcsMeta != null && mpcsMeta > 0
    ? ((activas - mpcsMeta) / mpcsMeta) * 100 : null;

  return {
    fecha, pais,
    activas, pagoPendiente, bajas, aRecuperar, onboarding, engagement,
    activasConVentas, recuperar10v, sinVentas, loginMenos7, loginPct,
    pct10v, pctRetenido, pctRetenido10v,
    churnBruto, churnNeto, churnPlan, proyectadoVsPlan,
    mpcsMesPasado, nRecuperar, mpcsMeta, mpcsVsPlan,
  };
}

/** Lista todas las fechas con snapshots diarios (formato YYYY-MM-DD). */
export async function listFechasDiarias(): Promise<string[]> {
  const { data } = await supabase
    .from("clientes")
    .select("mes_exportacion")
    .order("mes_exportacion", { ascending: false });
  const uniq = Array.from(new Set((data ?? []).map(r => r.mes_exportacion as string).filter(Boolean)));
  return uniq.filter(f => f.length === 10).sort().reverse();
}

/** Hook para la serie de KPIs diarios de un país. */
export function useKpisDiarios(pais: Pais, limit = 30) {
  return useQuery({
    queryKey: ["kpis-diarios", pais, limit],
    queryFn: async () => {
      const fechas = await listFechasDiarias();
      const slice = fechas.slice(0, limit);
      const results = await Promise.all(slice.map(f => computeKpiDia(f, pais)));
      return results.sort((a, b) => a.fecha.localeCompare(b.fecha));
    },
    staleTime: 300_000,
  });
}

/** Hook que carga TODOS los países para una fecha → tabla multi-país tipo GSheet columna J. */
export function useKpiSnapshotMultipais(fecha: string) {
  const paises: Pais[] = ["Región", "Argentina", "Chile", "México", "Colombia", "Brasil"];
  return useQuery({
    queryKey: ["kpi-snapshot-multipais", fecha],
    queryFn: () => Promise.all(paises.map(p => computeKpiDia(fecha, p))),
    enabled: Boolean(fecha),
    staleTime: 300_000,
  });
}

/** Delta de KPIs hoy vs ayer para un país. */
export function useKpiDelta(fechaHoy: string, pais: Pais) {
  return useQuery({
    queryKey: ["kpi-delta", fechaHoy, pais],
    queryFn: async () => {
      const d = new Date(fechaHoy);
      d.setUTCDate(d.getUTCDate() - 1);
      const ayer = d.toISOString().slice(0, 10);
      const [hoy, ant] = await Promise.all([
        computeKpiDia(fechaHoy, pais),
        computeKpiDia(ayer, pais),
      ]);
      return {
        hoy,
        ayer: ant,
        delta: {
          activas:          hoy.activas          - ant.activas,
          pagoPendiente:    hoy.pagoPendiente    - ant.pagoPendiente,
          bajas:            hoy.bajas            - ant.bajas,
          aRecuperar:       hoy.aRecuperar       - ant.aRecuperar,
          onboarding:       hoy.onboarding       - ant.onboarding,
          engagement:       hoy.engagement       - ant.engagement,
          activasConVentas: hoy.activasConVentas - ant.activasConVentas,
          sinVentas:        hoy.sinVentas        - ant.sinVentas,
          pctRetenido:      hoy.pctRetenido      - ant.pctRetenido,
          churnNeto:        hoy.churnNeto        - ant.churnNeto,
          churnBruto:       hoy.churnBruto       - ant.churnBruto,
          mpcsVsPlan:       (hoy.mpcsVsPlan ?? 0) - (ant.mpcsVsPlan ?? 0),
        },
      };
    },
    enabled: Boolean(fechaHoy),
    staleTime: 60_000,
  });
}
