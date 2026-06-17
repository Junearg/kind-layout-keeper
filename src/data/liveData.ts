// Capa de compatibilidad: useDashboardData() ahora delega en el nuevo
// dataset-store filtrado por mes activo.

import { useMemo } from "react";
import { useDatasetState } from "./dataset-store";
import { toLegacy } from "./legacy-adapter";

export function useDashboardData() {
  const { dataset, mesActivo } = useDatasetState();
  return useMemo(() => toLegacy(dataset, mesActivo), [dataset, mesActivo]);
}

/** Non-hook getter (export workbook, etc.) — no usa selector reactivo. */
export function getDashboardData() {
  // import dinámico para no romper SSR
  const { SEED_DATASET } = require("./seed-dataset") as typeof import("./seed-dataset");
  const mes = SEED_DATASET.resumen_mensual[0]?.mes ?? "";
  return toLegacy(SEED_DATASET, mes);
}

// ── Legacy overrides API (mantenida para no romper imports existentes) ──
export type DashboardKey = string;
export type DashboardOverrides = Record<string, unknown[]>;
export const DASHBOARD_KEYS: readonly string[] = [];
export function saveOverrides(_p: DashboardOverrides) {}
export function clearOverrides() {}
export function listOverrideKeys(): DashboardKey[] { return []; }
