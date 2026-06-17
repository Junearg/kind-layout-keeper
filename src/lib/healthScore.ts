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
export function calculateHealthScore(cliente: Record<string, any>): number {
  const norm = (val: any, max: number): number => {
    const n = Number(val);
    if (!val || isNaN(n)) return 0;
    return Math.min(n / max, 1) * 100;
  };

  const ventas = (Number(cliente.v_salon) || 0)
               + (Number(cliente.v_delivery) || 0)
               + (Number(cliente.v_mostrador) || 0);

  const hasNPS = cliente.nps_score !== null && cliente.nps_score !== undefined;
  const npsScore = hasNPS ? norm(Number(cliente.nps_score), 10) : 50;

  // Contactos: 0 contactos = 100 pts (cliente autosuficiente), más contactos = peor señal
  const contactScore = Math.max(0, 100 - (Number(cliente.cant_contactos) || 0) * 6);

  const components = [
    { score: norm(cliente.productos, 120),  weight: 0.20 }, // max real para restaurante: ~120 productos
    { score: norm(cliente.usuarios, 8),     weight: 0.15 }, // max real: ~8 usuarios
    { score: norm(ventas, 600),             weight: 0.25 }, // max real: ~600 tx/mes
    { score: contactScore,                  weight: 0.15 },
    { score: npsScore,                      weight: 0.25 },
  ];

  // Si no tiene NPS, redistribuimos ese peso entre productos y ventas
  const totalWeight = hasNPS ? 1.0 : 0.75;
  const raw = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, Math.max(0, raw / totalWeight)));
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
