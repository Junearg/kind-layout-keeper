// Parses a multi-sheet workbook produced from the Fudo Churn Center
// template and returns dashboard overrides + the raw snapshot rows.

import * as XLSX from "xlsx";
import type { DashboardKey, DashboardOverrides } from "@/data/liveData";

type Row = Record<string, unknown>;

function readSheet(wb: XLSX.WorkBook, name: string): Row[] | null {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  // Template puts description in row 1, blank row 2, headers in row 3.
  // We try `range: 2` (0-indexed → row 3 as header) first; if all columns
  // come back as "__EMPTY", fall back to the default first-row header.
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", range: 2 });
  if (rows.length && Object.keys(rows[0]!).some((k) => !k.startsWith("__EMPTY"))) {
    return rows.filter((r) => Object.values(r).some((v) => v !== "" && v !== null));
  }
  const fallback = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
  return fallback.filter((r) => Object.values(r).some((v) => v !== "" && v !== null));
}

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\\s$%]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}
function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = str(v).toLowerCase();
  return s === "true" || s === "1" || s === "sí" || s === "si" || s === "yes";
}

// Each mapper: takes raw rows from a sheet, returns the dashboard array
// shape used in mockData. Permissive — keeps any extra fields too.
const MAPPERS: Partial<Record<DashboardKey, (rows: Row[]) => unknown[]>> = {
  churnTrend: (rows) => rows.map((r) => ({
    mes: str(r.mes),
    bajas: num(r.bajas) ?? 0,
    pctMotivo: num(r.pctMotivo),
    proyectado: bool(r.proyectado),
  })),
  churnByMotivo: (rows) => rows.map((r) => ({
    mes: str(r.mes),
    total: num(r.total) ?? 0,
    definitivo: num(r.definitivo) ?? 0,
    temporal: num(r.temporal) ?? 0,
    sinResp: num(r.sinResp) ?? 0,
    dejoUsar: num(r.dejoUsar) ?? 0,
    eligioOtro: num(r.eligioOtro) ?? 0,
    precio: num(r.precio) ?? 0,
    faltaFunc: num(r.faltaFunc) ?? 0,
    malServ: num(r.malServ) ?? 0,
  })),
  motivosBaja: (rows) => rows.map((r) => ({
    motivo: str(r.motivo),
    n: num(r.n) ?? 0,
    pct: num(r.pct) ?? 0,
    color: str(r.color) || "#6B7280",
    brecha: bool(r.brecha),
    prioridad: str(r.prioridad),
    accionable: str(r.accionable),
  })),
  npsPais: (rows) => rows.map((r) => ({
    pais: str(r.pais),
    nps: num(r.nps) ?? 0,
    n: num(r.n) ?? 0,
    promotores: num(r.promotores) ?? 0,
    detractores: num(r.detractores) ?? 0,
    cuentas: num(r.cuentas) ?? 0,
    alerta: bool(r.alerta),
  })),
  npsPorGmv: (rows) => rows.map((r) => ({
    grupo: str(r.grupo),
    n: num(r.n) ?? 0,
    nps: num(r.nps) ?? 0,
    detractores: num(r.detractores) ?? 0,
  })),
  npsPorAntiguedad: (rows) => rows.map((r) => ({
    rango: str(r.rango),
    n: num(r.n) ?? 0,
    nps: num(r.nps) ?? 0,
    promotores: num(r.promotores) ?? 0,
    detractores: num(r.detractores) ?? 0,
  })),
  motivosDetraccion: (rows) => rows.map((r) => ({
    motivo: str(r.motivo),
    n: num(r.n) ?? 0,
    pct: num(r.pct) ?? 0,
  })),
  motivosPromocion: (rows) => rows.map((r) => ({
    motivo: str(r.motivo),
    n: num(r.n) ?? 0,
    pct: num(r.pct) ?? 0,
  })),
  desgloseCosto: (rows) => rows.map((r) => ({
    submotivo: str(r.submotivo),
    n: num(r.n) ?? 0,
  })),
  csatMensual: (rows) => rows.map((r) => ({
    mes: str(r.mes),
    conversaciones: num(r.conversaciones) ?? 0,
    churnMes: num(r.churnMes),
    rating4: num(r.rating4) ?? 0,
    rating5: num(r.rating5) ?? 0,
    avg: num(r.avg) ?? 0,
  })),
  takeRateBuckets: (rows) => rows.map((r) => ({
    bucket: str(r.bucket),
    rango: str(r.rango),
    nps: num(r.nps) ?? 0,
    detracCosto: num(r.detracCosto) ?? 0,
  })),
  cvrNeto: (rows) => rows.map((r) => ({
    mes: str(r.mes),
    cvr: num(r.cvr) ?? 0,
  })),
  tierDist: (rows) => rows.map((r) => ({
    tier: str(r.tier),
    count: num(r.count) ?? 0,
    pct: num(r.pct) ?? 0,
    color: str(r.color) || "#6E6D66",
  })),
  riskFlagDist: (rows) => rows.map((r) => ({
    flag: str(r.flag),
    count: num(r.count) ?? 0,
    color: str(r.color) || "#6E6D66",
  })),
  featureGaps: (rows) => rows.map((r) => ({
    gap: str(r.gap),
    label: str(r.label),
    cuentas: num(r.cuentas) ?? 0,
  })),
  healthAccounts: (rows) => rows.map((r) => {
    const flagsRaw = str(r.flags);
    return {
      id: num(r.id) ?? 0,
      nombre: str(r.nombre),
      pais: str(r.pais),
      plan: str(r.plan),
      score: num(r.score) ?? 0,
      tier: (str(r.tier) || "Healthy") as "Champion" | "Healthy" | "At Risk" | "Critical",
      tendencia: str(r.tendencia),
      trendDir: (str(r.trendDir) || "flat") as "up" | "down" | "flat" | "crit",
      flags: flagsRaw ? flagsRaw.split("|").map((s) => s.trim()).filter(Boolean) : [],
      npsLtr: num(r.npsLtr),
      npsGrupo: str(r.npsGrupo) || "—",
      csPrio: num(r.csPrio) ?? 0,
    };
  }),
  verbatims: (rows) => rows.map((r) => ({
    ltr: num(r.ltr) ?? 0,
    tipo: str(r.tipo),
    pais: str(r.pais),
    plan: str(r.plan),
    submotivo: str(r.submotivo) || null,
    texto: str(r.texto),
  })),
  kpiTargets: (rows) => rows.map((r) => ({
    kpi: str(r.kpi),
    baseline: str(r.baseline),
    target3m: str(r.target3m),
    target6m: str(r.target6m),
    current: str(r.current),
    status: str(r.status),
  })),
  iniciativas: (rows) => rows.map((r) => ({
    id: num(r.id) ?? 0,
    titulo: str(r.titulo),
    prioridad: str(r.prioridad),
    owner: str(r.owner),
    timeline: str(r.timeline),
    impacto: str(r.impacto),
    estado: str(r.estado),
    descripcion: str(r.descripcion),
  })),
};

export type ParsedWorkbook = {
  sheetNames: string[];
  dashboardOverrides: DashboardOverrides;
  matchedDashboards: DashboardKey[];
  snapshotRows: Row[] | null;       // raw rows for SNAPSHOT_mensual (or first sheet fallback)
  snapshotSheetName: string | null;
};

export function parseWorkbook(wb: XLSX.WorkBook): ParsedWorkbook {
  const sheetNames = wb.SheetNames;
  const dashboardOverrides: DashboardOverrides = {};
  const matchedDashboards: DashboardKey[] = [];

  (Object.keys(MAPPERS) as DashboardKey[]).forEach((key) => {
    const rows = readSheet(wb, key);
    if (!rows || !rows.length) return;
    const mapped = MAPPERS[key]!(rows);
    if (mapped.length) {
      dashboardOverrides[key] = mapped;
      matchedDashboards.push(key);
    }
  });

  // Snapshot: prefer SNAPSHOT_mensual; fall back to first sheet if absent.
  let snapshotRows: Row[] | null = readSheet(wb, "SNAPSHOT_mensual");
  let snapshotSheetName: string | null = snapshotRows ? "SNAPSHOT_mensual" : null;
  if (!snapshotRows) {
    const firstNonDashboard = sheetNames.find((n) => n !== "README" && !(MAPPERS as Record<string, unknown>)[n]);
    if (firstNonDashboard) {
      const ws = wb.Sheets[firstNonDashboard];
      if (ws) {
        snapshotRows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
        snapshotSheetName = firstNonDashboard;
      }
    }
  }

  return { sheetNames, dashboardOverrides, matchedDashboards, snapshotRows, snapshotSheetName };
}
