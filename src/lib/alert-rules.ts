// Umbrales y reglas de alertas auto-derivadas.
// Único lugar con valores numéricos hardcodeados de negocio: son los umbrales.
// Editalos acá, no en componentes.

import type { DashboardDataset } from "@/data/schema";

export const ALERT_THRESHOLDS = {
  npsPaisGapVsLider: 10,       // pts: alerta si país_peor < líder − 10
  pctSinMotivoCritico: 50,     // %
  aceleracionPctCritico: 25,   // %
  proyeccionAlzaPctCritico: 10, // %
  criticalTierMin: 1,          // n: si hay ≥1 cuenta Critical, mostrar alerta
};

export type Alerta = {
  tone: "red" | "amber" | "blue";
  titulo: string;
  detalle?: string;
  link?: string;
};

export function computeAlertas(ds: DashboardDataset, mes: string): Alerta[] {
  const out: Alerta[] = [];
  const resumen = ds.resumen_mensual.find((r) => r.mes === mes);
  if (!resumen) return out;

  // NPS gap
  const paises = ds.nps.por_pais.filter((p) => p.mes === mes);
  if (paises.length >= 2) {
    const worst = [...paises].sort((a, b) => a.nps_score - b.nps_score)[0]!;
    const best = [...paises].sort((a, b) => b.nps_score - a.nps_score)[0]!;
    const gap = +(best.nps_score - worst.nps_score).toFixed(1);
    if (gap >= ALERT_THRESHOLDS.npsPaisGapVsLider) {
      out.push({
        tone: "red",
        titulo: `${worst.pais} NPS ${worst.nps_score.toFixed(2)} — gap ${gap} pts vs ${best.pais}`,
        link: "/nps",
      });
    }
  }

  // % sin motivo
  if (resumen.pct_bajas_sin_motivo >= ALERT_THRESHOLDS.pctSinMotivoCritico) {
    out.push({
      tone: "red",
      titulo: `${resumen.pct_bajas_sin_motivo.toFixed(1)}% de bajas sin motivo (${resumen.n_bajas_sin_motivo.toLocaleString()} cuentas)`,
      link: "/tendencia",
    });
  }

  // Aceleración
  if (Math.abs(resumen.alerta_aceleracion_pct) >= ALERT_THRESHOLDS.aceleracionPctCritico && resumen.alerta_aceleracion_periodo) {
    out.push({
      tone: "amber",
      titulo: `Aceleración churn ${resumen.alerta_aceleracion_pct >= 0 ? "+" : ""}${resumen.alerta_aceleracion_pct.toFixed(1)}% ${resumen.alerta_aceleracion_periodo}`,
      link: "/tendencia",
    });
  }

  // Cuentas críticas
  if (resumen.cuentas_critical >= ALERT_THRESHOLDS.criticalTierMin) {
    out.push({
      tone: "amber",
      titulo: `${resumen.cuentas_critical.toLocaleString()} cuentas en tier Critical — intervención urgente`,
      link: "/cola",
    });
  }

  return out;
}
