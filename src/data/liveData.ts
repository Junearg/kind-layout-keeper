// Live dashboard data layer.
// Reads optional overrides saved by the importer from localStorage,
// falling back to the static mockData defaults. Components subscribe
// via useDashboardData() so dashboards update reactively after import.

import { useSyncExternalStore } from "react";
import * as base from "./mockData";

export const DASHBOARD_KEYS = [
  "churnTrend", "churnByMotivo", "motivosBaja",
  "npsPais", "npsPorGmv", "npsPorAntiguedad",
  "motivosDetraccion", "motivosPromocion", "desgloseCosto",
  "csatMensual", "takeRateBuckets", "cvrNeto",
  "tierDist", "riskFlagDist", "featureGaps",
  "healthAccounts", "verbatims", "kpiTargets", "iniciativas",
] as const;

export type DashboardKey = (typeof DASHBOARD_KEYS)[number];
export type DashboardOverrides = Partial<Record<DashboardKey, unknown[]>>;

const STORAGE_KEY = "dashboard_overrides_v1";
const EVENT = "dashboard-overrides-changed";

function read(): DashboardOverrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveOverrides(patch: DashboardOverrides) {
  if (typeof window === "undefined") return;
  const next = { ...read(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function clearOverrides() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function listOverrideKeys(): DashboardKey[] {
  return Object.keys(read()) as DashboardKey[];
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: DashboardOverrides = {};
let cachedRaw: string | null | undefined;
let cachedSnapshot: DashboardOverrides = EMPTY;

function readCached(): DashboardOverrides {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY) ?? "{}";
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    cachedSnapshot = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cachedSnapshot = EMPTY;
  }
  return cachedSnapshot;
}

function getSnapshot(): DashboardOverrides { return readCached(); }
function getServerSnapshot(): DashboardOverrides { return EMPTY; }

function merge(o: DashboardOverrides) {
  return {
    churnTrend:        (o.churnTrend        as typeof base.churnTrend)        ?? base.churnTrend,
    churnByMotivo:     (o.churnByMotivo     as typeof base.churnByMotivo)     ?? base.churnByMotivo,
    motivosBaja:       (o.motivosBaja       as typeof base.motivosBaja)       ?? base.motivosBaja,
    npsPais:           (o.npsPais           as typeof base.npsPais)           ?? base.npsPais,
    npsPorGmv:         (o.npsPorGmv         as typeof base.npsPorGmv)         ?? base.npsPorGmv,
    npsPorAntiguedad:  (o.npsPorAntiguedad  as typeof base.npsPorAntiguedad)  ?? base.npsPorAntiguedad,
    motivosDetraccion: (o.motivosDetraccion as typeof base.motivosDetraccion) ?? base.motivosDetraccion,
    motivosPromocion:  (o.motivosPromocion  as typeof base.motivosPromocion)  ?? base.motivosPromocion,
    desgloseCosto:     (o.desgloseCosto     as typeof base.desgloseCosto)     ?? base.desgloseCosto,
    csatMensual:       (o.csatMensual       as typeof base.csatMensual)       ?? base.csatMensual,
    takeRateBuckets:   (o.takeRateBuckets   as typeof base.takeRateBuckets)   ?? base.takeRateBuckets,
    cvrNeto:           (o.cvrNeto           as typeof base.cvrNeto)           ?? base.cvrNeto,
    tierDist:          (o.tierDist          as typeof base.tierDist)          ?? base.tierDist,
    riskFlagDist:      (o.riskFlagDist      as typeof base.riskFlagDist)      ?? base.riskFlagDist,
    featureGaps:       (o.featureGaps       as typeof base.featureGaps)       ?? base.featureGaps,
    healthAccounts:    (o.healthAccounts    as typeof base.healthAccounts)    ?? base.healthAccounts,
    verbatims:         (o.verbatims         as typeof base.verbatims)         ?? base.verbatims,
    kpiTargets:        (o.kpiTargets        as typeof base.kpiTargets)        ?? base.kpiTargets,
    iniciativas:       (o.iniciativas       as typeof base.iniciativas)       ?? base.iniciativas,
  };
}

export function useDashboardData() {
  const o = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return merge(o);
}

/** Non-hook getter — for export workbook, etc. */
export function getDashboardData() {
  return merge(read());
}
