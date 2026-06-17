// Churn Plan — targets netos mensuales acordados por país.
// Valores en porcentaje POSITIVO (ej: 3.2 = 3.2% de churn objetivo).
// Fuente: pestaña de plan en "Evolución Retención".

import type { Pais } from "@/contexts/CountryContext";

type PlanRow = Record<Pais, number>;

const CHURN_PLAN: Record<string, PlanRow> = {
  "2026-05": { "Región": 3.20, "Argentina": 2.80, "Chile": 3.20, "México": 3.50, "Colombia": 3.80, "Brasil": 4.50, "Others": 3.80 },
  "2026-06": { "Región": 3.00, "Argentina": 2.40, "Chile": 3.00, "México": 4.20, "Colombia": 3.50, "Brasil": 4.50, "Others": 3.50 },
  "2026-07": { "Región": 2.80, "Argentina": 1.90, "Chile": 2.70, "México": 3.90, "Colombia": 3.70, "Brasil": 4.60, "Others": 3.70 },
  "2026-08": { "Región": 2.70, "Argentina": 2.00, "Chile": 2.70, "México": 3.20, "Colombia": 3.70, "Brasil": 4.80, "Others": 3.70 },
  "2026-09": { "Región": 2.70, "Argentina": 2.00, "Chile": 2.40, "México": 4.10, "Colombia": 3.40, "Brasil": 4.80, "Others": 3.40 },
  "2026-10": { "Región": 2.60, "Argentina": 1.70, "Chile": 2.80, "México": 3.50, "Colombia": 3.70, "Brasil": 4.90, "Others": 3.70 },
  "2026-11": { "Región": 2.60, "Argentina": 1.60, "Chile": 2.70, "México": 3.80, "Colombia": 3.90, "Brasil": 4.70, "Others": 3.90 },
  "2026-12": { "Región": 2.80, "Argentina": 2.40, "Chile": 2.40, "México": 3.70, "Colombia": 3.40, "Brasil": 4.80, "Others": 3.40 },
};

/** Devuelve el Churn Plan (%) para un mes y país dados. Null si no hay plan definido. */
export function getChurnPlan(period: string, pais: Pais): number | null {
  // Tomar el mes (YYYY-MM) del período
  const mesKey = period.slice(0, 7);
  return CHURN_PLAN[mesKey]?.[pais] ?? null;
}

/** Devuelve todos los meses con plan definido. */
export function getPlanPeriods(): string[] {
  return Object.keys(CHURN_PLAN).sort();
}
