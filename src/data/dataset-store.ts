// Store global del dataset + mes activo.
// Persistencia en localStorage. Suscripción vía useSyncExternalStore
// para SSR-safe + reactividad sin librerías externas.

import { useSyncExternalStore } from "react";
import type { DashboardDataset } from "./schema";
import { SEED_DATASET } from "./seed-dataset";

const STORAGE_DATASET = "dashboard_dataset_v2";
const STORAGE_MES = "dashboard_mes_activo_v2";
const EVENT = "dashboard-dataset-changed";

type State = { dataset: DashboardDataset; mesActivo: string };

function readDataset(): DashboardDataset {
  if (typeof window === "undefined") return SEED_DATASET;
  try {
    const raw = localStorage.getItem(STORAGE_DATASET);
    if (!raw) return SEED_DATASET;
    return JSON.parse(raw) as DashboardDataset;
  } catch {
    return SEED_DATASET;
  }
}
function readMes(ds: DashboardDataset): string {
  if (typeof window === "undefined") return ds.meta.meses_disponibles[0] ?? "";
  const saved = localStorage.getItem(STORAGE_MES);
  if (saved && ds.meta.meses_disponibles.includes(saved)) return saved;
  // default: último mes con resumen
  const meses = ds.resumen_mensual.map((r) => r.mes).sort();
  return meses[meses.length - 1] ?? ds.meta.meses_disponibles[0] ?? "";
}

let cached: State | null = null;
function getSnapshot(): State {
  if (cached) return cached;
  const dataset = readDataset();
  const mesActivo = readMes(dataset);
  cached = { dataset, mesActivo };
  return cached;
}
function getServerSnapshot(): State {
  return { dataset: SEED_DATASET, mesActivo: SEED_DATASET.resumen_mensual[0]?.mes ?? "" };
}

function emit() {
  cached = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onEvent = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_DATASET || e.key === STORAGE_MES) { cached = null; cb(); }
  };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}

export function setDataset(d: DashboardDataset) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_DATASET, JSON.stringify(d));
  const meses = d.resumen_mensual.map((r) => r.mes).sort();
  const last = meses[meses.length - 1] ?? d.meta.meses_disponibles[0] ?? "";
  if (last) localStorage.setItem(STORAGE_MES, last);
  emit();
}
export function setMesActivo(mes: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_MES, mes);
  emit();
}
export function clearDataset() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_DATASET);
  localStorage.removeItem(STORAGE_MES);
  emit();
}

/** Hook principal: devuelve dataset + mes activo. */
export function useDatasetState(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDataset(): DashboardDataset { return useDatasetState().dataset; }
export function useMesActivo(): string { return useDatasetState().mesActivo; }
export function useMesesDisponibles(): string[] {
  const ds = useDataset();
  return [...new Set([
    ...ds.resumen_mensual.map((r) => r.mes),
    ...ds.meta.meses_disponibles,
  ])].sort();
}

/** Selectores derivados — devuelven `null` si no hay datos del mes. */
export function useResumenMes() {
  const { dataset, mesActivo } = useDatasetState();
  return dataset.resumen_mensual.find((r) => r.mes === mesActivo) ?? null;
}
export function useMotivosMes() {
  const { dataset, mesActivo } = useDatasetState();
  const rows = dataset.motivos_baja.filter((m) => m.mes === mesActivo);
  return rows.length ? rows : null;
}
export function useNpsMes() {
  const { dataset, mesActivo } = useDatasetState();
  const global = dataset.nps.global.find((g) => g.mes === mesActivo) ?? null;
  const por_pais = dataset.nps.por_pais.filter((p) => p.mes === mesActivo);
  const mirror_motivos = dataset.nps.mirror_motivos.filter((m) => m.mes === mesActivo);
  if (!global && por_pais.length === 0) return null;
  return { global, por_pais, mirror_motivos };
}
export function useHealthMes() {
  const { dataset, mesActivo } = useDatasetState();
  const tiers = dataset.health_score.tiers_resumen.find((t) => t.mes === mesActivo) ?? null;
  const risk_flags = dataset.health_score.risk_flags.filter((r) => r.mes === mesActivo);
  const cuentas_activas = dataset.health_score.cuentas_activas.filter((c) => c.mes === mesActivo);
  if (!tiers && cuentas_activas.length === 0) return null;
  return { tiers, risk_flags, cuentas_activas };
}
export function useColaMes() {
  const { dataset, mesActivo } = useDatasetState();
  const rows = dataset.cola_cs.filter((c) => c.mes === mesActivo);
  if (rows.length) return rows;
  // Fallback: derivar la cola desde health_score con prio_cs ≥ 35
  const cuentas = dataset.health_score.cuentas_activas.filter((c) => c.mes === mesActivo);
  const derived = cuentas
    .filter((c) => c.prio_cs >= 35)
    .sort((a, b) => b.prio_cs - a.prio_cs)
    .map((c) => ({
      mes: mesActivo,
      id_cuenta: c.id_cuenta,
      nombre: c.nombre,
      pais: c.pais,
      plan: c.plan,
      tier: c.tier,
      tendencia: c.tendencia,
      risk_flags: c.risk_flags,
      prio_cs: c.prio_cs,
      contactada_hoy: false,
      es_critica: c.tier === "Critical" || c.prio_cs >= 50,
    }));
  return derived.length ? derived : null;
}
export function useKpisMes() {
  const { dataset, mesActivo } = useDatasetState();
  const kpis = dataset.kpis_iniciativas.kpis.filter((k) => k.mes === mesActivo);
  // Iniciativas: vigentes son las cuyo mes_creacion <= mesActivo
  const iniciativas = dataset.kpis_iniciativas.iniciativas
    .filter((i) => !i.mes_creacion || i.mes_creacion <= mesActivo)
    .sort((a, b) => (b.mes_actualizacion ?? "").localeCompare(a.mes_actualizacion ?? ""));
  if (kpis.length === 0 && iniciativas.length === 0) return null;
  return { kpis, iniciativas };
}

/** Regresión lineal simple sobre los últimos N puntos reales.
 *  Devuelve el valor predicho para el próximo paso. */
export function linearForecastNext(values: number[]): number {
  const n = values.length;
  if (n < 2) return values[n - 1] ?? 0;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = values.reduce((s, y) => s + y, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - meanX) * (values[i]! - meanY), 0);
  const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return Math.max(0, Math.round(slope * n + intercept));
}

/** Si el resumen del mes activo tiene `forecast_auto: true`, devuelve la
 *  proyección calculada por regresión sobre los últimos 3 meses reales.
 *  Si no, devuelve null para que se use el valor manual. */
export function useForecastAutoNext(): number | null {
  const { dataset, mesActivo } = useDatasetState();
  const resumen = dataset.resumen_mensual.find((r) => r.mes === mesActivo);
  if (!resumen?.forecast_auto) return null;
  const reales = dataset.tendencia_mensual
    .filter((p) => !p.es_forecast && p.bajas_reales != null && p.mes <= mesActivo)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(-3)
    .map((p) => p.bajas_reales as number);
  if (reales.length < 2) return null;
  return linearForecastNext(reales);
}
