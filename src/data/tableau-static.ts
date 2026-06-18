// Datos mensuales extraídos de Tableau — fuente de verdad para MPCs, Bajas y Recuperadas.
// Vista: MonthlyPayingCustomersMPC (site fudogeneral)
// Fórmulas:
//   Churn Bruto = bajas / mpcs_mes_anterior
//   Churn Neto  = (bajas - recuperadas) / mpcs_mes_anterior
//
// Para agregar un nuevo mes: copiar la última fila y actualizar los valores desde Tableau.

type TableauMes = {
  mpcs: number;
  bajas: number;
  recuperadas: number;
};

// Recovered de meses históricos calculado como: bajas - (neto% × mpcs_prev)
// usando los porcentajes del gráfico "Churn Neto" de Tableau.
const DATA: Record<string, TableauMes> = {
  "2025-06": { mpcs: 27_494, bajas: 1_213, recuperadas: 0   }, // primer mes — sin prev para neto
  "2025-07": { mpcs: 28_034, bajas: 1_102, recuperadas: 250 },
  "2025-08": { mpcs: 28_589, bajas: 1_049, recuperadas: 236 },
  "2025-09": { mpcs: 29_197, bajas: 1_077, recuperadas: 248 },
  "2025-10": { mpcs: 29_781, bajas: 1_137, recuperadas: 290 },
  "2025-11": { mpcs: 30_367, bajas: 1_132, recuperadas: 268 },
  "2025-12": { mpcs: 30_811, bajas: 1_192, recuperadas: 311 },
  "2026-01": { mpcs: 31_407, bajas: 1_198, recuperadas: 243 },
  "2026-02": { mpcs: 31_729, bajas: 1_261, recuperadas: 225 },
  "2026-03": { mpcs: 32_050, bajas: 1_363, recuperadas: 253 },
  "2026-04": { mpcs: 32_176, bajas: 1_531, recuperadas: 249 },
  "2026-05": { mpcs: 32_337, bajas: 1_421, recuperadas: 231 },
  "2026-06": { mpcs: 31_847, bajas: 1_484, recuperadas: 153 },
};

function prevKey(period: string): string | null {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return null;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export type TableauChurn = {
  mpcs: number | null;
  mpcsPrev: number | null;
  bajas: number | null;
  recuperadas: number | null;
  churnBruto: number | null;   // %
  churnNeto: number | null;    // %
};

export function getTableauChurn(period: string): TableauChurn {
  const curr = DATA[period] ?? null;
  const prev = DATA[prevKey(period) ?? ""] ?? null;

  const mpcs       = curr?.mpcs       ?? null;
  const bajas      = curr?.bajas      ?? null;
  const recuperadas = curr?.recuperadas ?? null;
  const mpcsPrev   = prev?.mpcs       ?? null;

  const churnBruto = bajas != null && mpcsPrev
    ? (bajas / mpcsPrev) * 100
    : null;
  const churnNeto = bajas != null && recuperadas != null && mpcsPrev
    ? ((bajas - recuperadas) / mpcsPrev) * 100
    : null;

  return { mpcs, mpcsPrev, bajas, recuperadas, churnBruto, churnNeto };
}

/** Últimos N meses con churn bruto y neto, para el sparkline. */
export function getTableauTrend(period: string, n = 6): { mes: string; bruto: number | null; neto: number | null }[] {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return [];
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const totalMonths = m - i;
    const yr = y + Math.floor((totalMonths - 1) / 12);
    const mo = ((totalMonths - 1) % 12 + 12) % 12 + 1;
    const k = `${yr}-${String(mo).padStart(2, "0")}`;
    const c = getTableauChurn(k);
    result.push({ mes: k, bruto: c.churnBruto, neto: c.churnNeto });
  }
  return result;
}
