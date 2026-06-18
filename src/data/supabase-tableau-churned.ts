// Lista de churneados por período, fuente: Tableau (via tabla tableau_mpcs_snapshot).
// Churned del mes M = cuentas en snapshot M-1 que no están en snapshot M.
// Enriquecido con NPS y motivo de baja de Supabase (clientes) donde existe.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TableauChurnedRow = {
  account_id: string;
  shop: string | null;
  country: string | null;
  gmv_tier: string | null;
  plan: string | null;
  // Enriquecimiento desde clientes (puede ser null si no está en Supabase)
  nps_score: number | null;
  motivo_baja: string | null;
  submotivo_baja: string | null;
  ejecutivo: string | null;
  fecha_baja: string | null;
};

function prevMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m) return mes;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

async function fetchTableauChurned(mes: string): Promise<TableauChurnedRow[]> {
  const prev = prevMes(mes);

  // Cuentas en snapshot del mes anterior
  const { data: prevSnap, error: e1 } = await supabase
    .from("tableau_mpcs_snapshot")
    .select("account_id, shop, country, gmv_tier, plan")
    .eq("mes", prev);
  if (e1) throw e1;
  if (!prevSnap?.length) return [];

  // Cuentas que SÍ están en el mes actual (para excluirlas)
  const { data: currSnap, error: e2 } = await supabase
    .from("tableau_mpcs_snapshot")
    .select("account_id")
    .eq("mes", mes);
  if (e2) throw e2;

  const currIds = new Set((currSnap ?? []).map((r) => r.account_id));
  const churned = (prevSnap ?? []).filter((r) => !currIds.has(r.account_id));

  if (!churned.length) return [];

  // Enriquecer con datos de Supabase (clientes) usando id_cuenta_dash = account_id
  const churnedIds = churned.map((r) => r.account_id);
  const { data: enrich } = await supabase
    .from("clientes")
    .select("id_cuenta_dash, nps_score, motivo_baja, submotivo_baja, ejecutivo, fecha_baja")
    .eq("mes_exportacion", prev)
    .in("id_cuenta_dash", churnedIds.map(Number).filter(Boolean));

  const enrichMap = new Map<string, typeof enrich extends (infer T)[] ? T : never>();
  (enrich ?? []).forEach((r) => {
    if (r.id_cuenta_dash != null) enrichMap.set(String(r.id_cuenta_dash), r);
  });

  return churned.map((r) => {
    const e = enrichMap.get(r.account_id);
    return {
      account_id: r.account_id,
      shop: r.shop,
      country: r.country,
      gmv_tier: r.gmv_tier,
      plan: r.plan,
      nps_score: e?.nps_score ?? null,
      motivo_baja: e?.motivo_baja ?? null,
      submotivo_baja: e?.submotivo_baja ?? null,
      ejecutivo: e?.ejecutivo ?? null,
      fecha_baja: e?.fecha_baja ?? null,
    };
  });
}

export function useTableauChurned(mes: string) {
  return useQuery({
    queryKey: ["tableau-churned", mes],
    queryFn: () => fetchTableauChurned(mes),
    enabled: Boolean(mes),
    staleTime: 5 * 60_000,
  });
}

/** Estadísticas rápidas: total churned, % con datos de Supabase */
export function useTableauChurnedStats(mes: string) {
  const { data, ...rest } = useTableauChurned(mes);
  const total = data?.length ?? 0;
  const conDatos = data?.filter((r) => r.motivo_baja || r.nps_score != null).length ?? 0;
  return { total, conDatos, pctEnriquecido: total ? (conDatos / total) * 100 : 0, ...rest };
}
