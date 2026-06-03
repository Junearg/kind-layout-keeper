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

  // Bloque 5 — Plan (fórmulas exactas GSheet)
  mpcsMesPasado: number;
  mpcsRetenidosProyectados: number; // Activas + C/vtas_recuperar
  nRecuperar: number | null;        // mpcsMeta - activas
  mpcsMeta: number | null;          // (1 - churnPlan%) × MPCs_prev
  mpcsVsPlan: number | null;        // MPCs_retenidos / MPCs_prev - 1
};

/** Calcula los 25 KPIs para un snapshot diario y país.
 *
 * Replica exactamente las fórmulas del GSheet "Dashboard > columna J":
 * - Activas           = COUNTIF(estado_dash, "Activo")
 * - Aviso de Pago     = COUNTIF(estado_dash, "Aviso de Pago")
 * - Bajas Confirmadas = COUNTIF(etapa, "Bajas"|"Bajas clientes")
 * - A Recuperar       = COUNTIF(etapa, "Onboarding"|"Engagement")
 * - C/ vtas 7d        = COUNTIF(temas_contacto, "C/ vtas ultimos 7 dias")
 * - S/ vtas 7d        = COUNTIF(temas_contacto, "S/ vtas ultimos 7 dias")
 * - Login < 7d        = COUNTIF(motivos_contacto, "Menos de 7 dias")
 * - % Retenido        = Activas / MPCs_mes_pasado × 100
 */
export async function computeKpiDia(fecha: string, pais: Pais): Promise<KpiDiario> {
  type ActiveRow = {
    temas_contacto: string | null;
    motivos_contacto: string | null;
    ultima_fecha_contacto: string | null;
    v_salon: number | null;
    v_delivery: number | null;
    v_mostrador: number | null;
  };
  type RecuperarRow = {
    temas_contacto: string | null;
    v_salon: number | null;
    v_delivery: number | null;
    v_mostrador: number | null;
  };

  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() - 1);
  const prevFecha = d.toISOString().slice(0, 10);

  // Paginación completa para superar el límite de 1000 filas de PostgREST
  async function fetchAllRows<T>(builder: () => any): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await builder().range(from, from + PAGE - 1);
      if (error) break;
      const batch = (data ?? []) as T[];
      out.push(...batch);
      if (batch.length < PAGE) break;
    }
    return out;
  }

  // Activas con paginación completa (puede ser 25.000+ filas)
  const rows = await fetchAllRows<ActiveRow>(() =>
    applyPais(
      supabase.from("clientes")
        .select("temas_contacto,motivos_contacto,ultima_fecha_contacto,v_salon,v_delivery,v_mostrador")
        .eq("mes_exportacion", fecha)
        .eq("estado_dash", "Activo"),
      pais
    )
  );

  // A Recuperar con paginación (puede ser 6.000+ filas)
  const recRows = await fetchAllRows<RecuperarRow>(() =>
    applyPais(
      supabase.from("clientes")
        .select("temas_contacto,v_salon,v_delivery,v_mostrador")
        .eq("mes_exportacion", fecha)
        .eq("nps_motivo", "A Recuperar"),
      pais
    )
  );

  // Las queries de COUNT no necesitan paginación (solo devuelven el número)
  const [bajasRes, onboardingRes, engagementRes, pagoPendienteRes, prevActivasRes] = await Promise.all([
    applyPais(supabase.from("clientes").select("*", { count: "exact", head: true })
      .eq("mes_exportacion", fecha).in("etapa", ETAPAS_BAJA), pais),
    applyPais(supabase.from("clientes").select("*", { count: "exact", head: true })
      .eq("mes_exportacion", fecha).eq("etapa", "Onboarding"), pais),
    applyPais(supabase.from("clientes").select("*", { count: "exact", head: true })
      .eq("mes_exportacion", fecha).eq("etapa", "Engagement"), pais),
    applyPais(supabase.from("clientes").select("*", { count: "exact", head: true })
      .eq("mes_exportacion", fecha).eq("estado_dash", "Aviso de Pago"), pais),
    applyPais(supabase.from("clientes").select("*", { count: "exact", head: true })
      .eq("mes_exportacion", prevFecha).eq("estado_dash", "Activo"), pais),
  ]);
  const activas     = rows.length;
  const bajas       = bajasRes.count ?? 0;
  const onboarding  = onboardingRes.count ?? 0;
  const engagement  = engagementRes.count ?? 0;
  // aRecuperar usa Estado de Cuenta = "A Recuperar" (col W en base_hubspot)
  // Si hay datos de nps_motivo usamos ese conteo; fallback a etapa Engagement+Onboarding
  const aRecuperarByEstadoCuenta = recRows.length;
  const aRecuperar  = aRecuperarByEstadoCuenta > 0
    ? aRecuperarByEstadoCuenta
    : (onboarding + engagement);
  const pagoPendiente = pagoPendienteRes.count ?? 0;
  const mpcsMesPasado = prevActivasRes.count ?? activas;

  // C/ vtas últimos 7 días: usa la columna "temas_contacto" que importa "ventas?"
  // Si temas_contacto es null (import mensual sin este campo) → fallback a ventas mensuales ≥10
  const hasVentasColumn = rows.some(r => r.temas_contacto != null);
  const activasConVentas = hasVentasColumn
    ? rows.filter(r => r.temas_contacto === "C/ vtas ultimos 7 dias").length
    : rows.filter(r => ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10).length;

  const sinVentas = hasVentasColumn
    ? rows.filter(r => r.temas_contacto === "S/ vtas ultimos 7 dias").length
    : rows.filter(r => ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) === 0).length;

  // Recuperar con ventas
  const hasVentasRec = recRows.some(r => r.temas_contacto != null);
  const recuperar10v = hasVentasRec
    ? recRows.filter(r => r.temas_contacto === "C/ vtas ultimos 7 dias").length
    : recRows.filter(r => ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10).length;

  // Login < 7 días: usa motivos_contacto = "Menos de 7 dias" (importado de "ultima login?")
  // Si el campo no está disponible → calcula desde ultima_fecha_contacto
  const hasLoginColumn = rows.some(r => r.motivos_contacto != null);
  const loginMenos7 = hasLoginColumn
    ? rows.filter(r => r.motivos_contacto === "Menos de 7 dias").length
    : rows.filter(r => {
        if (!r.ultima_fecha_contacto) return false;
        return (Date.now() - new Date(r.ultima_fecha_contacto).getTime()) / 86_400_000 < 7;
      }).length;

  // Guard: si no hay datos del día anterior, las métricas relativas quedan como null
  const hasPrevData = mpcsMesPasado > 0;
  const base = mpcsMesPasado || 1; // fallback solo para no dividir por 0

  // C/ vtas del pool A_Recuperar (usado en Churn Neto — fórmula GSheet: J9)
  const cvtasRecuperar = recRows.filter(r => r.temas_contacto === "C/ vtas ultimos 7 dias").length;

  // Fórmulas exactas del GSheet columna J:
  // Churn Bruto = Bajas / Activas (J6/J5)
  const churnBruto = activas > 0 ? (bajas / activas) * 100 : 0;

  // Churn Neto = 1 - (Activas + C_vtas_recuperar) / MPCs_prev (1-(J5+J9)/J23)
  // MPCs Retenidos Proyectados = Activas + C_vtas_recuperar
  const mpcsRetenidosProyectados = activas + cvtasRecuperar;
  const churnNeto = hasPrevData ? (1 - mpcsRetenidosProyectados / base) * 100 : 0;

  const pct10v        = activas > 0 ? (activasConVentas / activas) * 100 : 0;
  const loginPct      = activas > 0 ? (loginMenos7 / activas) * 100 : 0;
  // % Retenido y >=10v solo son válidas si hay datos previos
  const pctRetenido   = hasPrevData ? (activas / base) * 100 : 0;
  const pctRetenido10v = hasPrevData ? (activasConVentas / base) * 100 : 0;

  // Plan
  const mesKey = fecha.slice(0, 7);
  const churnPlan = getChurnPlan(mesKey, pais);
  const mpcsMeta = (hasPrevData && churnPlan != null) ? Math.round((1 - churnPlan / 100) * base) : null;
  const nRecuperar = mpcsMeta != null ? Math.max(0, mpcsMeta - activas) : null;
  // Proyectado Neto vs Plan = Churn_Neto/Churn_Plan - 1 (J25/J26-1)
  const proyectadoVsPlan = (hasPrevData && churnPlan != null && churnPlan > 0)
    ? (churnNeto / churnPlan - 1) * 100 : null;
  // MPCs vs Plan = MPCs_retenidos/Plan_MPCs - 1
  const mpcsVsPlan = hasPrevData
    ? (mpcsRetenidosProyectados / base - 1) * 100 : null;

  return {
    fecha, pais,
    activas, pagoPendiente, bajas, aRecuperar, onboarding, engagement,
    activasConVentas, recuperar10v, sinVentas, loginMenos7, loginPct,
    pct10v, pctRetenido, pctRetenido10v,
    churnBruto, churnNeto, churnPlan, proyectadoVsPlan,
    mpcsMesPasado, mpcsRetenidosProyectados, nRecuperar, mpcsMeta, mpcsVsPlan,
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
