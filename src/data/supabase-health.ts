import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  scoreCliente,
  type ScoredCliente,
  type Tier,
  type RiskFlagKey,
} from "@/lib/healthScore";
import type { HealthAccount } from "@/data/mockData";

const SCORE_COLS =
  "id_cuenta_dash, nombre, pais, plan, productos, usuarios, v_salon, v_delivery, v_mostrador, cant_contactos, nps_score, motivo_baja, motivo_metabase, estado_dash, ultima_fecha_contacto";

type Row = {
  id_cuenta_dash: number | null;
  nombre: string | null;
  pais: string | null;
  plan: string | null;
  productos: number | null;
  usuarios: number | null;
  v_salon: number | null;
  v_delivery: number | null;
  v_mostrador: number | null;
  cant_contactos: number | null;
  nps_score: number | null;
  motivo_baja: string | null;
  motivo_metabase: string | null;
  estado_dash: string | null;
  ultima_fecha_contacto: string | null;
};

export type ScoredAccount = HealthAccount & { scored: ScoredCliente };

/** Normaliza NPS guardado como 0-100 (factor ×10) a escala 0-10. */
function normalizeNps(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 10 ? v / 10 : v;
}

function trendFromContacto(ultima: string | null): { trendDir: HealthAccount["trendDir"]; tendencia: string } {
  if (!ultima) return { trendDir: "flat", tendencia: "Sin señal" };
  const days = (Date.now() - new Date(ultima).getTime()) / 86_400_000;
  if (days > 90) return { trendDir: "crit", tendencia: "Caída crítica" };
  if (days > 45) return { trendDir: "down", tendencia: "Caída moderada" };
  if (days < 15) return { trendDir: "up", tendencia: "Activa reciente" };
  return { trendDir: "flat", tendencia: "Estable" };
}

function npsGrupo(score: number | null): string {
  if (score == null) return "—";
  if (score >= 9) return "Promotor";
  if (score >= 7) return "Pasivo";
  return "Detractor";
}

async function fetchScoredAccounts(period: string): Promise<ScoredAccount[]> {
  // Paginamos para esquivar el límite de 1000 filas de PostgREST.
  const PAGE = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("clientes")
      .select(SCORE_COLS)
      .eq("mes_exportacion", period)
      .eq("estado_dash", "Activo")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Row[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }

  return out.map((r, i) => {
    const npsNorm = normalizeNps(r.nps_score);
    const scored = scoreCliente({ ...r, nps_score: npsNorm });
    const { trendDir, tendencia } = trendFromContacto(r.ultima_fecha_contacto);
    return {
      id: r.id_cuenta_dash ?? i,
      nombre: r.nombre ?? "—",
      pais: r.pais ?? "—",
      plan: r.plan ?? "—",
      score: scored.score,
      tier: scored.tier,
      tendencia,
      trendDir,
      flags: scored.activeFlags,
      npsLtr: npsNorm,
      npsGrupo: npsGrupo(npsNorm),
      csPrio: scored.prioCS,
      scored,
    };
  });
}

export function useSupabaseScoredAccounts(period: string) {
  return useQuery({
    queryKey: ["supabase-scored-accounts", period],
    queryFn: () => fetchScoredAccounts(period),
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}

export function tierDistFromScored(rows: ScoredAccount[]): {
  tier: Tier;
  count: number;
  pct: number;
  color: string;
}[] {
  const order: Tier[] = ["Champion", "Healthy", "At Risk", "Critical"];
  const colors: Record<Tier, string> = {
    Champion: "#F05A28",
    Healthy: "#1E5DBF",
    "At Risk": "#B5740F",
    Critical: "#B3261E",
  };
  const total = rows.length || 1;
  return order.map((tier) => {
    const count = rows.filter((r) => r.tier === tier).length;
    return { tier, count, pct: (count / total) * 100, color: colors[tier] };
  });
}

export function riskFlagDistFromScored(rows: ScoredAccount[]): {
  flag: RiskFlagKey;
  count: number;
  color: string;
}[] {
  const flagKeys: RiskFlagKey[] = [
    "MONO_CANAL",
    "CUENTA_INACTIVA_+2M",
    "ADOPCION_BAJA",
    "NPS_DETRACTOR",
    "PRECIO",
    "RIESGO_METABASE",
  ];
  const colors: Record<RiskFlagKey, string> = {
    MONO_CANAL: "#B5740F",
    "CUENTA_INACTIVA_+2M": "#B3261E",
    ADOPCION_BAJA: "#6E6D66",
    NPS_DETRACTOR: "#B3261E",
    PRECIO: "#1E5DBF",
    RIESGO_METABASE: "#F05A28",
  };
  return flagKeys
    .map((flag) => ({
      flag,
      count: rows.filter((r) => r.scored.flags[flag]).length,
      color: colors[flag],
    }))
    .filter((f) => f.count > 0);
}
