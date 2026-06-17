// Consumo directo del Google Sheet público de Fudo Dashboard.
// Estrategia de parsing: busca ETIQUETAS (no filas fijas) para ser
// robusto frente a bloques de distinto tamaño por país.
//
// Cada bloque de país empieza en la fila donde columna A = "Activas<País>".
// Las métricas se identifican por el texto exacto en cualquier celda de la fila.
// El valor siempre está en la columna J (índice 9 del array de celdas).

import { useQuery } from "@tanstack/react-query";

const SHEET_ID   = "17jUew-LhWUqi81ztx4TgOkZApWZnm6Bp05ue3_TaOUA";
const SHEET_NAME = "dashboard";
// Rango amplio para cubrir todos los países (~30 filas por país × 7 países ≈ 250 filas)
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=A1:J300`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CountryKPIs = {
  activas:           number | null;
  bajasConfirmadas:  number | null;
  cuentasARecuperar: number | null;
  cvtasUltimos7d:    number | null;
  svtasUltimos7d:    number | null;
  pctRetenido:       number | null;  // % Retenido (ej. 95.81)
  mpcsMesPasado:     number | null;
  churnBruto:        number | null;  // % (ej. 4.5)
  churnNeto:         number | null;  // % (ej. 4.1)
  churnPlan:         number | null;  // % (ej. 3.0)
  proyectadoVsPlan:  number | null;
  nRecuperar:        number | null;
};

export type SheetsDashboardData = {
  fecha: string;          // "9-Jun"
  countries: string[];    // en orden de aparición, primer elemento = "Región"
  byCountry: Record<string, CountryKPIs>;
};

// ─── Etiquetas que identifican cada métrica (match exacto en cualquier celda) ─

const METRIC_LABELS: Record<string, keyof CountryKPIs> = {
  "Activas":                          "activas",
  "Bajas Confirmadas":                "bajasConfirmadas",
  "Cuentas a Recuperar":              "cuentasARecuperar",
  "C/ vtas ultimos 7 dias":           "cvtasUltimos7d",
  "S/ vtas ultimos 7 dias":           "svtasUltimos7d",
  "% Retenido":                       "pctRetenido",
  "MPCs mes pasado":                  "mpcsMesPasado",
  "Churn Bruto Proyectado":           "churnBruto",
  "Churn Neto Proyectado":            "churnNeto",
  "Churn Plan":                       "churnPlan",
  "Proyectado Neto vs Plan":          "proyectadoVsPlan",
  "# Recuperar para Churn on target": "nRecuperar",
};

// Normaliza nombre del sheet → nombre de la app
const COUNTRY_NORMALIZE: Record<string, string> = {
  Region: "Región",
  Mexico: "México",
};
function normalizeName(raw: string): string {
  return COUNTRY_NORMALIZE[raw] ?? raw;
}

// ─── CSV parser simple (maneja campos entre comillas con comas internas) ──────

function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

// ─── Conversión de valor de celda a número ────────────────────────────────────

function toNum(s: string): number | null {
  if (!s) return null;
  // "36.2%", "4.3%", "32,338", "758", "-4.1%", etc.
  const isPercent = s.endsWith("%");
  const clean = s.replace(/,/g, "").replace(/%$/, "").trim();
  const n = parseFloat(clean);
  if (isNaN(n)) return null;
  // Los porcentajes ya vienen formateados (ej. "36.2%") → devolver como 0-100
  return isPercent ? n : n;
}

// ─── Fetch y parsing ──────────────────────────────────────────────────────────

function emptyKPIs(): CountryKPIs {
  return {
    activas: null, bajasConfirmadas: null, cuentasARecuperar: null,
    cvtasUltimos7d: null, svtasUltimos7d: null,
    pctRetenido: null, mpcsMesPasado: null,
    churnBruto: null, churnNeto: null, churnPlan: null,
    proyectadoVsPlan: null, nRecuperar: null,
  };
}

async function fetchSheetsDashboard(): Promise<SheetsDashboardData> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Google Sheets: HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows  = lines.map(parseCSVRow);

  let fecha       = "";
  const countries: string[] = [];
  const byCountry: Record<string, CountryKPIs> = {};
  let current: string | null = null;  // país activo mientras escaneamos

  for (const cells of rows) {
    const colA = cells[0] ?? "";
    const colB = cells[1] ?? "";
    const colJ = cells[9] ?? "";   // columna J = valor

    // ── Fecha del snapshot (fila 2: colJ = "9-Jun") ──
    if (!fecha && colA === "" && colJ && /^\d+-[A-Za-z]+$/.test(colJ)) {
      fecha = colJ;
      continue;
    }

    // ── Inicio de bloque de país (colA empieza con "Activas") ──
    if (colA.startsWith("Activas") && colA.length > 7) {
      const raw = normalizeName(colB || colA.slice(7));
      if (raw && !countries.includes(raw)) {
        countries.push(raw);
        byCountry[raw] = emptyKPIs();
      }
      current = raw;
      // NO hacer continue — la misma fila contiene el valor "Activas" en col F
    }

    if (!current) continue;

    // ── Buscar etiqueta de métrica en cualquier celda de la fila ──
    for (const cell of cells) {
      const label = cell.trim();
      const metricKey = METRIC_LABELS[label];
      if (metricKey) {
        const val = toNum(colJ);
        byCountry[current]![metricKey] = val;
        break;
      }
    }
  }

  // Garantizar "Región" primero
  const sorted = [
    ...countries.filter(c => c === "Región"),
    ...countries.filter(c => c !== "Región"),
  ];

  return { fecha, countries: sorted, byCountry };
}

export function useSheetsDashboard() {
  return useQuery({
    queryKey:  ["sheets-dashboard"],
    queryFn:   fetchSheetsDashboard,
    staleTime: 5 * 60_000,  // 5 min
    retry: 2,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUENTAS — listado de base_hubspot filtrado por Estado de Cuenta
// ═══════════════════════════════════════════════════════════════════════════════

export type EstadoCuenta = "A Recuperar" | "Baja";

export type AccountRow = {
  nombre:       string;   // col B — Nombre del negocio
  idFudo:       string;   // col C — ID de cuenta Fudo
  ejecutivo:    string;   // col G — Ejecutivo Engagement
  gmvTier:      string;   // col S — GMV Tier
  etapa:        string;   // col U — Etapa
  ventas:       string;   // col V — ventas?
  estado:       EstadoCuenta;  // col W — Estado de Cuenta
  pais:         string;   // col X — País adj
  ultimaLogin:  string;   // col Z — ultima login?
};

// Usa la API de Visualization Query para pre-filtrar en origen (sólo A Recuperar + Baja).
// Columnas seleccionadas: B,C,G,S,U,V,W,X,Z
const ACCOUNTS_TQ = encodeURIComponent(
  "select B,C,G,S,U,V,W,X,Z where W='A Recuperar' or W='Baja'"
);
const ACCOUNTS_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?tqx=out:csv&sheet=base_hubspot&tq=${ACCOUNTS_TQ}`;

async function fetchAccounts(): Promise<AccountRow[]> {
  const res = await fetch(ACCOUNTS_URL);
  if (!res.ok) throw new Error(`base_hubspot: HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  // La primera línea es el header generado por gviz → saltar
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const c = parseCSVRow(line);
    // Orden de columnas tal como se seleccionaron: B,C,G,S,U,V,W,X,Z → índices 0-8
    return {
      nombre:      c[0] ?? "",
      idFudo:      c[1] ?? "",
      ejecutivo:   c[2] ?? "",
      gmvTier:     c[3] ?? "",
      etapa:       c[4] ?? "",
      ventas:      c[5] ?? "",
      estado:      (c[6] ?? "") as EstadoCuenta,
      pais:        c[7] ?? "",
      ultimaLogin: c[8] ?? "",
    };
  }).filter(r => r.nombre || r.idFudo);
}

export function useAccounts() {
  return useQuery({
    queryKey:  ["sheets-accounts"],
    queryFn:   fetchAccounts,
    staleTime: 5 * 60_000,
    retry: 2,
  });
}
