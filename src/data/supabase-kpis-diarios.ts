// KPIs diarios calculados desde los snapshots daily de la tabla clientes.
// Los snapshots daily tienen mes_exportacion en formato YYYY-MM-DD.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Pais } from "@/contexts/CountryContext";
import { PAISES_CONOCIDOS } from "@/contexts/CountryContext";

const ETAPAS_BAJA      = ["Bajas", "Bajas clientes"] as const;
const ETAPAS_RECUPERAR = ["Engagement", "Onboarding"] as const;

function applyPais(query: any, pais: Pais) {
  if (pais === "Región") return query;
  if (pais === "Others") return query.not("pais", "in", `(${PAISES_CONOCIDOS.join(",")})`);
  return query.eq("pais", pais);
}

export type KpiDiario = {
  fecha: string;           // YYYY-MM-DD
  activas: number;
  bajas: number;
  aRecuperar: number;
  churnNeto: number;       // %
  churnBruto: number;      // %
  activasConVentas: number;
  loginMenos7: number;
};

/** Calcula KPIs para un snapshot diario específico. */
export async function computeKpiDia(fecha: string, pais: Pais): Promise<KpiDiario> {
  type ActiveRow = {
    v_salon: number | null;
    v_delivery: number | null;
    v_mostrador: number | null;
    ultima_fecha_contacto: string | null;
  };

  // Día anterior
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() - 1);
  const prevFecha = d.toISOString().slice(0, 10);

  const [activasRes, bajasRes, recuperarRes, prevActivasRes] = await Promise.all([
    applyPais(
      supabase.from("clientes")
        .select("v_salon,v_delivery,v_mostrador,ultima_fecha_contacto")
        .eq("mes_exportacion", fecha)
        .eq("estado_dash", "Activo"),
      pais
    ),
    applyPais(
      supabase.from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("mes_exportacion", fecha)
        .in("etapa", ETAPAS_BAJA),
      pais
    ),
    applyPais(
      supabase.from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("mes_exportacion", fecha)
        .in("etapa", ETAPAS_RECUPERAR),
      pais
    ),
    applyPais(
      supabase.from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("mes_exportacion", prevFecha)
        .eq("estado_dash", "Activo"),
      pais
    ),
  ]);

  const rows = ((activasRes.data ?? []) as ActiveRow[]);
  const activas = rows.length;
  const bajas = bajasRes.count ?? 0;
  const aRecuperar = recuperarRes.count ?? 0;
  const prevActivas = prevActivasRes.count ?? activas; // fallback: sin cambio

  const activasConVentas = rows.filter(r =>
    ((r.v_salon ?? 0) + (r.v_delivery ?? 0) + (r.v_mostrador ?? 0)) >= 10
  ).length;

  const loginMenos7 = rows.filter(r => {
    if (!r.ultima_fecha_contacto) return false;
    return (Date.now() - new Date(r.ultima_fecha_contacto).getTime()) / 86_400_000 < 7;
  }).length;

  const base = prevActivas || 1;
  const churnNeto  = (1 - activas / base) * 100;
  const churnBruto = (bajas / base) * 100;

  return { fecha, activas, bajas, aRecuperar, churnNeto, churnBruto, activasConVentas, loginMenos7 };
}

/** Lista todas las fechas con snapshots diarios (formato YYYY-MM-DD). */
export async function listFechasDiarias(): Promise<string[]> {
  const { data } = await supabase
    .from("clientes")
    .select("mes_exportacion")
    .order("mes_exportacion", { ascending: false });
  const uniq = Array.from(new Set((data ?? []).map(r => r.mes_exportacion as string).filter(Boolean)));
  // Solo los que tienen formato YYYY-MM-DD (longitud 10)
  return uniq.filter(f => f.length === 10).sort().reverse();
}

/** Hook para la serie de KPIs diarios. Calcula los últimos N días disponibles. */
export function useKpisDiarios(pais: Pais, limit = 30) {
  return useQuery({
    queryKey: ["kpis-diarios", pais, limit],
    queryFn: async () => {
      const fechas = await listFechasDiarias();
      const slice = fechas.slice(0, limit);
      const results = await Promise.all(slice.map(f => computeKpiDia(f, pais)));
      return results.sort((a, b) => a.fecha.localeCompare(b.fecha));
    },
    staleTime: 300_000, // 5 minutos
  });
}

/** Delta de KPIs entre hoy y ayer. */
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
          bajas:            hoy.bajas            - ant.bajas,
          aRecuperar:       hoy.aRecuperar       - ant.aRecuperar,
          churnNeto:        hoy.churnNeto        - ant.churnNeto,
          activasConVentas: hoy.activasConVentas - ant.activasConVentas,
        },
      };
    },
    enabled: Boolean(fechaHoy),
    staleTime: 60_000,
  });
}
