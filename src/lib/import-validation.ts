// Validation logic for customer/account imports.
// Expected columns (case-insensitive, accepts common variants):
//   company_id | id
//   customer_name | name | cliente
//   country | pais
//   segment | segmento
//   owner | dueño | duenio
//   plan
//   mrr
//   status   -> "active" | "churned"
//   churn_date
//   month    -> e.g. "2026-05" or "May 2026"

export type RawRow = Record<string, unknown>;

export type NormalizedRow = {
  rowNumber: number; // 1-based, matches the spreadsheet row
  company_id: string;
  customer_name: string;
  country: string;
  segment: string;
  owner: string;
  plan: string;
  mrr: number | null;
  status: string;
  churn_date: string;
  month: string;
};

export type IssueSeverity = "error" | "warning";

export type Issue = {
  severity: IssueSeverity;
  code:
    | "missing_company_id"
    | "duplicate_customer"
    | "negative_mrr"
    | "churned_no_date"
    | "active_zero_mrr"
    | "missing_owner_or_segment"
    | "month_already_loaded";
  title: string;
  detail: string;
  rows?: number[];
};

const FIELD_ALIASES: Record<keyof NormalizedRow, string[]> = {
  rowNumber: [],
  company_id:   ["company_id", "companyid", "id", "id_cliente", "id_empresa"],
  customer_name:["customer_name", "name", "cliente", "nombre", "customer"],
  country:      ["country", "pais", "país"],
  segment:      ["segment", "segmento", "tier"],
  owner:        ["owner", "dueño", "duenio", "responsable", "csm"],
  plan:         ["plan"],
  mrr:          ["mrr", "arr_monthly", "fee", "monto"],
  status:       ["status", "estado"],
  churn_date:   ["churn_date", "fecha_churn", "fecha_baja", "baja"],
  month:        ["month", "mes", "periodo", "período"],
};

function pick(row: RawRow, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const k = keys.find((x) => x.toLowerCase().trim() === alias);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function normalizeRows(raw: RawRow[]): NormalizedRow[] {
  return raw.map((r, i) => ({
    rowNumber: i + 2, // header at row 1
    company_id:    toStr(pick(r, FIELD_ALIASES.company_id)),
    customer_name: toStr(pick(r, FIELD_ALIASES.customer_name)),
    country:       toStr(pick(r, FIELD_ALIASES.country)),
    segment:       toStr(pick(r, FIELD_ALIASES.segment)),
    owner:         toStr(pick(r, FIELD_ALIASES.owner)),
    plan:          toStr(pick(r, FIELD_ALIASES.plan)),
    mrr:           toNum(pick(r, FIELD_ALIASES.mrr)),
    status:        toStr(pick(r, FIELD_ALIASES.status)).toLowerCase(),
    churn_date:    toStr(pick(r, FIELD_ALIASES.churn_date)),
    month:         toStr(pick(r, FIELD_ALIASES.month)),
  }));
}

export function detectMonth(rows: NormalizedRow[]): string {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    if (r.month) counts.set(r.month, (counts.get(r.month) ?? 0) + 1);
  });
  let best = "";
  let max = 0;
  counts.forEach((v, k) => {
    if (v > max) {
      max = v;
      best = k;
    }
  });
  return best;
}

const LOADED_KEY = "fudo-loaded-months-v1";

export function getLoadedMonths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOADED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function markMonthLoaded(month: string) {
  if (!month) return;
  const cur = new Set(getLoadedMonths());
  cur.add(month);
  localStorage.setItem(LOADED_KEY, JSON.stringify([...cur]));
}

export function validate(rows: NormalizedRow[]): Issue[] {
  const issues: Issue[] = [];

  // 1. Missing company IDs
  const missingIds = rows.filter((r) => !r.company_id).map((r) => r.rowNumber);
  if (missingIds.length) {
    issues.push({
      severity: "error",
      code: "missing_company_id",
      title: `${missingIds.length} fila${missingIds.length > 1 ? "s" : ""} sin company_id`,
      detail: "El identificador de la cuenta es obligatorio para evitar colisiones.",
      rows: missingIds,
    });
  }

  // 2. Duplicate customers (by company_id)
  const byId = new Map<string, number[]>();
  rows.forEach((r) => {
    if (!r.company_id) return;
    const arr = byId.get(r.company_id) ?? [];
    arr.push(r.rowNumber);
    byId.set(r.company_id, arr);
  });
  const dupRows: number[] = [];
  let dupCount = 0;
  byId.forEach((arr) => {
    if (arr.length > 1) {
      dupCount++;
      dupRows.push(...arr);
    }
  });
  if (dupCount) {
    issues.push({
      severity: "error",
      code: "duplicate_customer",
      title: `${dupCount} company_id duplicado${dupCount > 1 ? "s" : ""}`,
      detail: "Hay más de una fila con el mismo identificador de cliente.",
      rows: dupRows,
    });
  }

  // 3. Negative MRR
  const neg = rows.filter((r) => r.mrr !== null && r.mrr < 0).map((r) => r.rowNumber);
  if (neg.length) {
    issues.push({
      severity: "error",
      code: "negative_mrr",
      title: `${neg.length} fila${neg.length > 1 ? "s" : ""} con MRR negativo`,
      detail: "El MRR no puede ser negativo. Revisar signos invertidos o devoluciones mal cargadas.",
      rows: neg,
    });
  }

  // 4. Churned without churn_date
  const churnedNoDate = rows
    .filter((r) => r.status === "churned" && !r.churn_date)
    .map((r) => r.rowNumber);
  if (churnedNoDate.length) {
    issues.push({
      severity: "error",
      code: "churned_no_date",
      title: `${churnedNoDate.length} cliente${churnedNoDate.length > 1 ? "s" : ""} churned sin fecha`,
      detail: "Toda cuenta en estado churned debe tener churn_date para alimentar la cohorte.",
      rows: churnedNoDate,
    });
  }

  // 5. Active with MRR = 0
  const activeZero = rows
    .filter((r) => r.status === "active" && r.mrr !== null && r.mrr === 0)
    .map((r) => r.rowNumber);
  if (activeZero.length) {
    issues.push({
      severity: "warning",
      code: "active_zero_mrr",
      title: `${activeZero.length} cuenta${activeZero.length > 1 ? "s" : ""} activa${activeZero.length > 1 ? "s" : ""} con MRR = 0`,
      detail: "Cuentas activas con MRR cero suelen ser cortesías o errores de facturación.",
      rows: activeZero,
    });
  }

  // 6. Missing owner or segment
  const missingMeta = rows
    .filter((r) => !r.owner || !r.segment)
    .map((r) => r.rowNumber);
  if (missingMeta.length) {
    issues.push({
      severity: "warning",
      code: "missing_owner_or_segment",
      title: `${missingMeta.length} cuenta${missingMeta.length > 1 ? "s" : ""} sin owner o segmento`,
      detail: "Sin owner/segmento no se puede priorizar en la cola CS ni en los KPIs.",
      rows: missingMeta,
    });
  }

  // 7. Month already loaded
  const month = detectMonth(rows);
  if (month && getLoadedMonths().includes(month)) {
    issues.push({
      severity: "warning",
      code: "month_already_loaded",
      title: `El mes ${month} ya fue cargado antes`,
      detail: "Volver a importarlo sobrescribirá los datos previos de ese período.",
    });
  }

  return issues;
}
