// Health Score unificado para cuentas activas (tabla `clientes`).
// Esta es la fuente única de verdad: scoring, tier, risk flags y prioridad CS.

export type Tier = "Champion" | "Healthy" | "At Risk" | "Critical";

export type RiskFlagKey =
  | "MONO_CANAL"
  | "CUENTA_INACTIVA_+2M"
  | "ADOPCION_BAJA"
  | "NPS_DETRACTOR"
  | "PRECIO"
  | "RIESGO_METABASE";

export type RiskFlags = Record<RiskFlagKey, boolean>;

/** Subconjunto mínimo de campos de la fila `clientes` que necesita el scoring. */
export type ClienteScoreInput = {
  productos?: number | null;
  usuarios?: number | null;
  v_salon?: number | null;
  v_delivery?: number | null;
  v_mostrador?: number | null;
  cant_contactos?: number | null;
  nps_score?: number | null;
  motivo_baja?: string | null;
  motivo_metabase?: string | null;
  estado_dash?: string | null;
};

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/** Normaliza linealmente [min..max] → [0..100], saturando fuera de rango. */
function normalizar(value: number | null | undefined, min: number, max: number): number {
  const v = num(value);
  if (max <= min) return 0;
  return clamp(((v - min) / (max - min)) * 100);
}

/** Health score 0-100 ponderado. */
export function calculateHealthScore(cliente: ClienteScoreInput): number {
  const ventas = num(cliente.v_salon) + num(cliente.v_mostrador) + num(cliente.v_delivery);
  const contactos = num(cliente.cant_contactos);

  const componentes = [
    { value: normalizar(cliente.productos, 0, 500), weight: 0.20 },           // adopción
    { value: normalizar(cliente.usuarios, 0, 20), weight: 0.15 },              // team
    { value: normalizar(ventas, 0, 50000), weight: 0.25 },                     // volumen ventas
    { value: contactos === 0 ? 80 : Math.max(0, 100 - contactos * 5), weight: 0.15 }, // bajo contacto = bueno
    { value: cliente.nps_score != null ? (Number(cliente.nps_score) / 10) * 100 : 50, weight: 0.25 }, // NPS
  ];

  const total = componentes.reduce((acc, c) => acc + c.value * c.weight, 0);
  return Math.round(clamp(total) * 10) / 10;
}

export function getTier(score: number): Tier {
  if (score >= 80) return "Champion";
  if (score >= 55) return "Healthy";
  if (score >= 30) return "At Risk";
  return "Critical";
}

export function getRiskFlags(cliente: ClienteScoreInput): RiskFlags {
  const vs = num(cliente.v_salon);
  const vd = num(cliente.v_delivery);
  const vm = num(cliente.v_mostrador);
  const canales = (vs > 0 ? 1 : 0) + (vd > 0 ? 1 : 0) + (vm > 0 ? 1 : 0);
  const productos = num(cliente.productos);
  const usuarios = num(cliente.usuarios);
  const motivo = cliente.motivo_baja ?? "";

  return {
    MONO_CANAL: canales <= 1,
    "CUENTA_INACTIVA_+2M": vs + vd + vm === 0 && productos > 0,
    ADOPCION_BAJA: productos < 10 && usuarios <= 1,
    NPS_DETRACTOR: cliente.nps_score != null && Number(cliente.nps_score) <= 6,
    PRECIO: /precio/i.test(motivo),
    RIESGO_METABASE: !!cliente.motivo_metabase && cliente.estado_dash === "Activo",
  };
}

export function getActiveFlags(cliente: ClienteScoreInput): RiskFlagKey[] {
  const f = getRiskFlags(cliente);
  return (Object.keys(f) as RiskFlagKey[]).filter((k) => f[k]);
}

export function getPrioCS(score: number, tier: Tier, flags: RiskFlags): number {
  const base = 100 - score;
  const tierBoost = tier === "Critical" ? 20 : tier === "At Risk" ? 10 : 0;
  const npsBoost = flags.NPS_DETRACTOR ? 5 : 0;
  const inactBoost = flags["CUENTA_INACTIVA_+2M"] ? 10 : 0;
  return Math.round(clamp(base + tierBoost + npsBoost + inactBoost));
}

/** Resultado completo para una cuenta. */
export type ScoredCliente = {
  score: number;
  tier: Tier;
  flags: RiskFlags;
  activeFlags: RiskFlagKey[];
  prioCS: number;
};

export function scoreCliente(cliente: ClienteScoreInput): ScoredCliente {
  const score = calculateHealthScore(cliente);
  const tier = getTier(score);
  const flags = getRiskFlags(cliente);
  const activeFlags = (Object.keys(flags) as RiskFlagKey[]).filter((k) => flags[k]);
  const prioCS = getPrioCS(score, tier, flags);
  return { score, tier, flags, activeFlags, prioCS };
}

export const TIER_COLOR: Record<Tier, string> = {
  Champion: "#F05A28",
  Healthy: "#1E5DBF",
  "At Risk": "#B5740F",
  Critical: "#B3261E",
};
