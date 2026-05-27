// Parses a multi-sheet workbook produced from the Fudo Churn Center
// template (the same shape the in-app exporter produces) and returns
// dashboard overrides + the raw snapshot rows.

import * as XLSX from "xlsx";
import type { DashboardKey, DashboardOverrides } from "@/data/liveData";

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[%,\s$]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}
function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = str(v).toLowerCase();
  return s === "true" || s === "1" || s === "sí" || s === "si" || s === "yes" || s === "⚠";
}
function normKey(s: string): string {
  return s.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

type FieldDef = {
  // canonical field name in the dashboard data
  key: string;
  // accepted header labels (normalized form). First match wins.
  headers: string[];
  type?: "string" | "number" | "boolean";
  default?: unknown;
};

type SheetDef = {
  dashboardKey: DashboardKey;
  // sheet names to look for, in priority order (normalized)
  sheetNames: string[];
  fields: FieldDef[];
  // post-processing on the parsed row
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
};

const N = (s: string) => normKey(s);

const SHEET_DEFS: SheetDef[] = [
  {
    dashboardKey: "churnTrend",
    sheetNames: ["Tendencia churn", "churnTrend"].map(N),
    fields: [
      { key: "mes", headers: ["Mes", "mes"].map(N), type: "string" },
      { key: "bajas", headers: ["Bajas", "bajas"].map(N), type: "number", default: 0 },
      { key: "pctMotivo", headers: ["% con motivo", "pctMotivo"].map(N), type: "number" },
      { key: "proyectado", headers: ["Proyectado", "proyectado"].map(N), type: "boolean" },
    ],
  },
  {
    dashboardKey: "churnByMotivo",
    sheetNames: ["Churn por motivo (mes)", "Churn por motivo", "churnByMotivo"].map(N),
    fields: [
      { key: "mes", headers: ["Mes"].map(N), type: "string" },
      { key: "total", headers: ["Total"].map(N), type: "number", default: 0 },
      { key: "definitivo", headers: ["Definitivo"].map(N), type: "number", default: 0 },
      { key: "temporal", headers: ["Temporal"].map(N), type: "number", default: 0 },
      { key: "sinResp", headers: ["Sin resp.", "Sin resp", "sinResp"].map(N), type: "number", default: 0 },
      { key: "dejoUsar", headers: ["Dejó usar", "Dejo usar", "dejoUsar"].map(N), type: "number", default: 0 },
      { key: "eligioOtro", headers: ["Eligió otro", "Eligio otro", "eligioOtro"].map(N), type: "number", default: 0 },
      { key: "precio", headers: ["Precio"].map(N), type: "number", default: 0 },
      { key: "faltaFunc", headers: ["Falta func.", "Falta func", "faltaFunc"].map(N), type: "number", default: 0 },
      { key: "malServ", headers: ["Mal servicio", "malServ"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "motivosBaja",
    sheetNames: ["Motivos de baja", "motivosBaja"].map(N),
    fields: [
      { key: "motivo", headers: ["Motivo"].map(N), type: "string" },
      { key: "n", headers: ["Casos", "n"].map(N), type: "number", default: 0 },
      { key: "pct", headers: ["%", "pct"].map(N), type: "number", default: 0 },
      { key: "prioridad", headers: ["Prioridad"].map(N), type: "string" },
      { key: "accionable", headers: ["Accionable"].map(N), type: "string" },
      { key: "brecha", headers: ["Brecha"].map(N), type: "boolean" },
      { key: "color", headers: ["color"].map(N), type: "string", default: "#6B7280" },
    ],
  },
  {
    dashboardKey: "npsPais",
    sheetNames: ["NPS por país", "NPS por pais", "npsPais"].map(N),
    fields: [
      { key: "pais", headers: ["País", "Pais"].map(N), type: "string" },
      { key: "nps", headers: ["NPS"].map(N), type: "number", default: 0 },
      { key: "n", headers: ["Respuestas", "n"].map(N), type: "number", default: 0 },
      { key: "promotores", headers: ["% Promotores", "promotores"].map(N), type: "number", default: 0 },
      { key: "detractores", headers: ["% Detractores", "detractores"].map(N), type: "number", default: 0 },
      { key: "cuentas", headers: ["Cuentas"].map(N), type: "number", default: 0 },
      { key: "alerta", headers: ["Alerta"].map(N), type: "boolean" },
    ],
  },
  {
    dashboardKey: "npsPorGmv",
    sheetNames: ["NPS por GMV", "npsPorGmv"].map(N),
    fields: [
      { key: "grupo", headers: ["Grupo"].map(N), type: "string" },
      { key: "n", headers: ["Respuestas", "n"].map(N), type: "number", default: 0 },
      { key: "nps", headers: ["NPS"].map(N), type: "number", default: 0 },
      { key: "detractores", headers: ["% Detractores", "detractores"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "npsPorAntiguedad",
    sheetNames: ["NPS por antigüedad", "NPS por antiguedad", "npsPorAntiguedad"].map(N),
    fields: [
      { key: "rango", headers: ["Rango"].map(N), type: "string" },
      { key: "n", headers: ["Respuestas", "n"].map(N), type: "number", default: 0 },
      { key: "nps", headers: ["NPS"].map(N), type: "number", default: 0 },
      { key: "promotores", headers: ["% Promotores", "promotores"].map(N), type: "number", default: 0 },
      { key: "detractores", headers: ["% Detractores", "detractores"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "motivosDetraccion",
    sheetNames: ["Motivos detracción", "Motivos detraccion", "motivosDetraccion"].map(N),
    fields: [
      { key: "motivo", headers: ["Motivo"].map(N), type: "string" },
      { key: "n", headers: ["Casos", "n"].map(N), type: "number", default: 0 },
      { key: "pct", headers: ["%", "pct"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "motivosPromocion",
    sheetNames: ["Motivos promoción", "Motivos promocion", "motivosPromocion"].map(N),
    fields: [
      { key: "motivo", headers: ["Motivo"].map(N), type: "string" },
      { key: "n", headers: ["Casos", "n"].map(N), type: "number", default: 0 },
      { key: "pct", headers: ["%", "pct"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "desgloseCosto",
    sheetNames: ["Desglose costo", "desgloseCosto"].map(N),
    fields: [
      { key: "submotivo", headers: ["Submotivo"].map(N), type: "string" },
      { key: "n", headers: ["Casos", "n"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "csatMensual",
    sheetNames: ["CSAT mensual", "csatMensual"].map(N),
    fields: [
      { key: "mes", headers: ["Mes"].map(N), type: "string" },
      { key: "conversaciones", headers: ["Conversaciones"].map(N), type: "number", default: 0 },
      { key: "churnMes", headers: ["Churn del mes", "churnMes"].map(N), type: "number" },
      { key: "rating4", headers: ["Rating 4", "rating4"].map(N), type: "number", default: 0 },
      { key: "rating5", headers: ["Rating 5", "rating5"].map(N), type: "number", default: 0 },
      { key: "avg", headers: ["Promedio", "avg"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "takeRateBuckets",
    sheetNames: ["Take rate buckets", "takeRateBuckets"].map(N),
    fields: [
      { key: "bucket", headers: ["Bucket"].map(N), type: "string" },
      { key: "rango", headers: ["Rango"].map(N), type: "string" },
      { key: "nps", headers: ["NPS"].map(N), type: "number", default: 0 },
      { key: "detracCosto", headers: ["% Detracción costo", "% Detraccion costo", "detracCosto"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "cvrNeto",
    sheetNames: ["CVR neto", "cvrNeto"].map(N),
    fields: [
      { key: "mes", headers: ["Mes"].map(N), type: "string" },
      { key: "cvr", headers: ["CVR"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "tierDist",
    sheetNames: ["Health · tiers", "Health tiers", "tierDist"].map(N),
    fields: [
      { key: "tier", headers: ["Tier"].map(N), type: "string" },
      { key: "count", headers: ["Cuentas", "count"].map(N), type: "number", default: 0 },
      { key: "pct", headers: ["%", "pct"].map(N), type: "number", default: 0 },
      { key: "color", headers: ["color"].map(N), type: "string", default: "#6E6D66" },
    ],
  },
  {
    dashboardKey: "riskFlagDist",
    sheetNames: ["Health · flags", "Health flags", "riskFlagDist"].map(N),
    fields: [
      { key: "flag", headers: ["Flag"].map(N), type: "string" },
      { key: "count", headers: ["Cuentas", "count"].map(N), type: "number", default: 0 },
      { key: "color", headers: ["color"].map(N), type: "string", default: "#6E6D66" },
    ],
  },
  {
    dashboardKey: "featureGaps",
    sheetNames: ["Feature gaps", "featureGaps"].map(N),
    fields: [
      { key: "gap", headers: ["Gap"].map(N), type: "string" },
      { key: "label", headers: ["Descripción", "Descripcion", "label"].map(N), type: "string" },
      { key: "cuentas", headers: ["Cuentas"].map(N), type: "number", default: 0 },
    ],
  },
  {
    dashboardKey: "healthAccounts",
    sheetNames: ["Cuentas · Health", "Cuentas Health", "healthAccounts"].map(N),
    fields: [
      { key: "id", headers: ["ID", "id"].map(N), type: "number", default: 0 },
      { key: "nombre", headers: ["Nombre"].map(N), type: "string" },
      { key: "pais", headers: ["País", "Pais"].map(N), type: "string" },
      { key: "plan", headers: ["Plan"].map(N), type: "string" },
      { key: "score", headers: ["Score"].map(N), type: "number", default: 0 },
      { key: "tier", headers: ["Tier"].map(N), type: "string", default: "Healthy" },
      { key: "tendencia", headers: ["Tendencia"].map(N), type: "string" },
      { key: "trendDir", headers: ["trendDir", "Dir"].map(N), type: "string", default: "flat" },
      { key: "flags", headers: ["Flags"].map(N), type: "string", default: "" },
      { key: "npsLtr", headers: ["NPS LTR", "npsLtr"].map(N), type: "number" },
      { key: "npsGrupo", headers: ["NPS Grupo", "npsGrupo"].map(N), type: "string", default: "—" },
      { key: "csPrio", headers: ["Prio CS", "csPrio"].map(N), type: "number", default: 0 },
    ],
    transform: (r) => {
      const raw = str(r.flags);
      // accept either "|" or " · " (export uses " · ")
      const parts = raw
        ? raw.split(/\s*[·|]\s*/).map((s) => s.trim()).filter(Boolean)
        : [];
      return { ...r, flags: parts };
    },
  },
  {
    dashboardKey: "verbatims",
    sheetNames: ["Verbatims NPS", "verbatims"].map(N),
    fields: [
      { key: "ltr", headers: ["LTR", "ltr"].map(N), type: "number", default: 0 },
      { key: "tipo", headers: ["Tipo"].map(N), type: "string" },
      { key: "pais", headers: ["País", "Pais"].map(N), type: "string" },
      { key: "plan", headers: ["Plan"].map(N), type: "string" },
      { key: "submotivo", headers: ["Submotivo"].map(N), type: "string" },
      { key: "texto", headers: ["Comentario", "texto"].map(N), type: "string" },
    ],
    transform: (r) => ({ ...r, submotivo: r.submotivo === "—" ? null : r.submotivo || null }),
  },
  {
    dashboardKey: "kpiTargets",
    sheetNames: ["KPIs", "kpiTargets"].map(N),
    fields: [
      { key: "kpi", headers: ["KPI"].map(N), type: "string" },
      { key: "baseline", headers: ["Baseline"].map(N), type: "string" },
      { key: "target3m", headers: ["Target 3m", "target3m"].map(N), type: "string" },
      { key: "target6m", headers: ["Target 6m", "target6m"].map(N), type: "string" },
      { key: "current", headers: ["Actual", "current"].map(N), type: "string" },
      { key: "status", headers: ["Estado", "status"].map(N), type: "string" },
    ],
  },
  {
    dashboardKey: "iniciativas",
    sheetNames: ["Iniciativas", "iniciativas"].map(N),
    fields: [
      { key: "id", headers: ["#", "id"].map(N), type: "number", default: 0 },
      { key: "titulo", headers: ["Título", "Titulo", "titulo"].map(N), type: "string" },
      { key: "prioridad", headers: ["Prioridad"].map(N), type: "string" },
      { key: "owner", headers: ["Owner"].map(N), type: "string" },
      { key: "timeline", headers: ["Timeline"].map(N), type: "string" },
      { key: "impacto", headers: ["Impacto"].map(N), type: "string" },
      { key: "estado", headers: ["Estado"].map(N), type: "string" },
      { key: "descripcion", headers: ["Descripción", "Descripcion", "descripcion"].map(N), type: "string" },
    ],
  },
];

/** Read sheet as a 2D array of cells (any type). */
function sheetToMatrix(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
}

/** Find the row that matches the most expected headers; return its index + column→fieldKey map. */
function findHeaderRow(matrix: unknown[][], fields: FieldDef[]): { rowIdx: number; colToField: Map<number, FieldDef> } | null {
  const maxScan = Math.min(matrix.length, 8);
  let best: { rowIdx: number; colToField: Map<number, FieldDef>; score: number } | null = null;
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] ?? [];
    const colToField = new Map<number, FieldDef>();
    let score = 0;
    row.forEach((cell, c) => {
      const k = normKey(str(cell));
      if (!k) return;
      const f = fields.find((fd) => fd.headers.includes(k));
      if (f && !Array.from(colToField.values()).some((x) => x.key === f.key)) {
        colToField.set(c, f);
        score++;
      }
    });
    if (score >= 2 && (!best || score > best.score)) {
      best = { rowIdx: r, colToField, score };
    }
  }
  return best ? { rowIdx: best.rowIdx, colToField: best.colToField } : null;
}

function castCell(v: unknown, type: FieldDef["type"], def: unknown): unknown {
  switch (type) {
    case "number": {
      const n = num(v);
      return n === null ? (def ?? null) : n;
    }
    case "boolean":
      return bool(v);
    case "string":
    default:
      return str(v) || (def !== undefined ? def : "");
  }
}

function parseDashboardSheet(ws: XLSX.WorkSheet, def: SheetDef): unknown[] | null {
  const matrix = sheetToMatrix(ws);
  const header = findHeaderRow(matrix, def.fields);
  if (!header) return null;

  const out: Record<string, unknown>[] = [];
  for (let r = header.rowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    // skip rows that are entirely blank
    if (!row.some((v) => str(v) !== "")) continue;
    const obj: Record<string, unknown> = {};
    // apply defaults first
    def.fields.forEach((f) => {
      if (f.default !== undefined) obj[f.key] = f.default;
      else obj[f.key] = f.type === "number" ? null : f.type === "boolean" ? false : "";
    });
    header.colToField.forEach((f, c) => {
      obj[f.key] = castCell(row[c], f.type, f.default);
    });
    // require at least one non-default identifying value
    const hasContent = Object.values(obj).some((v) => v !== "" && v !== null && v !== 0 && v !== false);
    if (!hasContent) continue;
    out.push(def.transform ? def.transform(obj) : obj);
  }
  return out.length ? out : null;
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): { name: string; ws: XLSX.WorkSheet } | null {
  for (const name of wb.SheetNames) {
    if (candidates.includes(normKey(name))) {
      return { name, ws: wb.Sheets[name]! };
    }
  }
  return null;
}

export type ParsedWorkbook = {
  sheetNames: string[];
  dashboardOverrides: DashboardOverrides;
  matchedDashboards: DashboardKey[];
  snapshotRows: Row[] | null;
  snapshotSheetName: string | null;
};

export function parseWorkbook(wb: XLSX.WorkBook): ParsedWorkbook {
  const sheetNames = wb.SheetNames;
  const dashboardOverrides: DashboardOverrides = {};
  const matchedDashboards: DashboardKey[] = [];

  for (const def of SHEET_DEFS) {
    const found = findSheet(wb, def.sheetNames);
    if (!found) continue;
    const parsed = parseDashboardSheet(found.ws, def);
    if (parsed && parsed.length) {
      dashboardOverrides[def.dashboardKey] = parsed;
      matchedDashboards.push(def.dashboardKey);
    }
  }

  // Snapshot: prefer SNAPSHOT_mensual; also accept "Snapshots mensuales" (from exporter).
  let snapshotRows: Row[] | null = null;
  let snapshotSheetName: string | null = null;
  const snapCandidates = ["SNAPSHOT_mensual", "Snapshots mensuales", "Snapshot mensual", "snapshot"].map(N);
  const snapSheet = findSheet(wb, snapCandidates);
  if (snapSheet) {
    // Try direct parse first (header on row 1)
    let rows = XLSX.utils.sheet_to_json<Row>(snapSheet.ws, { defval: "" });
    // If headers came back like "__EMPTY", try assuming export layout (title row 1, header row 3)
    if (rows.length && Object.keys(rows[0]!).some((k) => k.startsWith("__EMPTY"))) {
      rows = XLSX.utils.sheet_to_json<Row>(snapSheet.ws, { defval: "", range: 2 });
    }
    rows = rows.filter((r) => Object.values(r).some((v) => v !== "" && v !== null));
    if (rows.length) {
      snapshotRows = rows;
      snapshotSheetName = snapSheet.name;
    }
  }

  return { sheetNames, dashboardOverrides, matchedDashboards, snapshotRows, snapshotSheetName };
}
