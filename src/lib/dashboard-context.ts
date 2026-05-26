import {
  churnTrend, motivosBaja, npsPais, npsPorGmv, npsPorAntiguedad,
  motivosDetraccion, motivosPromocion, desgloseCosto, csatMensual,
  takeRateBuckets, cvrNeto, tierDist, riskFlagDist, featureGaps,
  healthAccounts, verbatims, kpiTargets, iniciativas,
} from "@/data/mockData";

// Compact, model-friendly serialization of the entire dashboard dataset.
// Used as system-prompt context so the agent can answer questions grounded
// in the same data the user sees on screen.
export function buildDashboardContext(): string {
  const sections: Array<[string, unknown]> = [
    ["TENDENCIA_CHURN_MENSUAL", churnTrend],
    ["MOTIVOS_DE_BAJA", motivosBaja],
    ["NPS_POR_PAIS", npsPais],
    ["NPS_POR_GMV", npsPorGmv],
    ["NPS_POR_ANTIGUEDAD", npsPorAntiguedad],
    ["MOTIVOS_DETRACCION", motivosDetraccion],
    ["MOTIVOS_PROMOCION", motivosPromocion],
    ["DESGLOSE_COSTO", desgloseCosto],
    ["CSAT_MENSUAL", csatMensual],
    ["TAKE_RATE_BUCKETS", takeRateBuckets],
    ["CVR_NETO_BAJAS", cvrNeto],
    ["DISTRIBUCION_TIERS", tierDist],
    ["RISK_FLAGS", riskFlagDist],
    ["FEATURE_GAPS", featureGaps],
    ["HEALTH_ACCOUNTS_TOP", healthAccounts.slice(0, 50)],
    ["VERBATIMS_CLIENTES", verbatims],
    ["KPIS_SEGUIMIENTO", kpiTargets],
    ["INICIATIVAS_RETENCION", iniciativas],
  ];

  return sections
    .map(([k, v]) => `## ${k}\n${JSON.stringify(v)}`)
    .join("\n\n");
}
