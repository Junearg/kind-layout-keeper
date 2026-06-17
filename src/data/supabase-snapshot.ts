// Snapshot de cuentas dadas de baja en el período seleccionado.
// Misma lógica que /health pero filtrado por etapa = Bajas / Bajas clientes.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarMotivo } from "@/lib/motivo-normalizer";
import type { Pais } from "@/contexts/CountryContext";
import { PAISES_CONOCIDOS } from "@/contexts/CountryContext";

const ETAPAS_BAJA = ["Bajas", "Bajas clientes"] as const;

type RawRow = {
  id_hubspot: string | null;
  id_cuenta_dash: number | null;
  nombre: string | null;
  pais: string | null;
  plan: string | null;
  fecha_baja: string | null;
  motivo_baja: string | null;
  submotivo_baja: string | null;
  motivo_metabase: string | null;
  comentarios_metabase: string | null;
  ejecutivo: string | null;
};

export type SnapshotRow = {
  id_hubspot: string;
  id_cuenta: number | null;
  nombre: string;
  pais: string;
  plan: string;
  fecha_baja: string | null;
  diasDesdeBaja: number | null;
  motivoCat: string;
  motivoRaw: string | null;
  ejecutivo: string;
};

function applyPais(query: any, pais: Pais) {
  if (pais === "Región") return query;
  if (pais === "Others") return query.not("pais", "in", `(${PAISES_CONOCIDOS.join(",")})`);
  return query.eq("pais", pais);
}

async function fetchSnapshot(period: string, pais: Pais): Promise<SnapshotRow[]> {
  const PAGE = 1000;
  const out: RawRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await applyPais(
      supabase.from("clientes")
        .select("id_hubspot,id_cuenta_dash,nombre,pais,plan,fecha_baja,motivo_baja,submotivo_baja,motivo_metabase,comentarios_metabase,ejecutivo")
        .eq("mes_exportacion", period)
        .in("etapa", ETAPAS_BAJA),
      pais
    ).order("fecha_baja", { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as RawRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }

  const hoy = Date.now();
  return out.map((r) => {
    const diasDesdeBaja = r.fecha_baja
      ? Math.floor((hoy - new Date(r.fecha_baja).getTime()) / 86_400_000)
      : null;
    return {
      id_hubspot: r.id_hubspot ?? "—",
      id_cuenta: r.id_cuenta_dash,
      nombre: r.nombre ?? "—",
      pais: r.pais ?? "—",
      plan: r.plan ?? "—",
      fecha_baja: r.fecha_baja ? r.fecha_baja.slice(0, 10) : null,
      diasDesdeBaja,
      motivoCat: normalizarMotivo(r.motivo_baja, r.submotivo_baja, r.motivo_metabase, r.comentarios_metabase),
      motivoRaw: r.motivo_baja,
      ejecutivo: r.ejecutivo ?? "—",
    };
  });
}

export function useSnapshot(period: string, pais: Pais) {
  return useQuery({
    queryKey: ["snapshot-bajas", period, pais],
    queryFn: () => fetchSnapshot(period, pais),
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}
