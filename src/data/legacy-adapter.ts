// Adapter: transforma el dataset canónico (filtrado por mes activo)
// a la forma que esperan los componentes legacy (useDashboardData).
// Esto permite que las rutas existentes sigan funcionando sin reescribirse,
// pero filtrando por mes seleccionado.

import type { DashboardDataset } from "./schema";
import * as seedFallback from "./mockData";

export type LegacyDashboardShape = {
  churnTrend: typeof seedFallback.churnTrend;
  churnByMotivo: typeof seedFallback.churnByMotivo;
  motivosBaja: typeof seedFallback.motivosBaja;
  npsPais: typeof seedFallback.npsPais;
  npsPorGmv: typeof seedFallback.npsPorGmv;
  npsPorAntiguedad: typeof seedFallback.npsPorAntiguedad;
  motivosDetraccion: typeof seedFallback.motivosDetraccion;
  motivosPromocion: typeof seedFallback.motivosPromocion;
  desgloseCosto: typeof seedFallback.desgloseCosto;
  csatMensual: typeof seedFallback.csatMensual;
  takeRateBuckets: typeof seedFallback.takeRateBuckets;
  cvrNeto: typeof seedFallback.cvrNeto;
  tierDist: typeof seedFallback.tierDist;
  riskFlagDist: typeof seedFallback.riskFlagDist;
  featureGaps: typeof seedFallback.featureGaps;
  healthAccounts: typeof seedFallback.healthAccounts;
  verbatims: typeof seedFallback.verbatims;
  kpiTargets: typeof seedFallback.kpiTargets;
  iniciativas: typeof seedFallback.iniciativas;
};

const TIER_COLOR: Record<string, string> = {
  Champion: "#F05A28", Healthy: "#1E5DBF", "At Risk": "#B5740F", Critical: "#B3261E",
};
const FLAG_COLOR: Record<string, string> = {
  MONO_CANAL: "#B5740F", "CUENTA_INACTIVA_+2M": "#B3261E",
  ADOPCION_BAJA: "#D97706", CAIDA_MODERADA_3M: "#F05A28",
  ADOPCION_MINIMA: "#B3261E", CAIDA_CRITICA_3M: "#B3261E",
  NPS_DETRACTOR: "#7C3AED", SIN_FLAGS: "#1E5DBF",
};

export function toLegacy(ds: DashboardDataset, mesActivo: string): LegacyDashboardShape {
  // ── tendencia ──
  const churnTrend = ds.tendencia_mensual.map((p) => ({
    mes: p.es_forecast ? `${p.mes_label}*` : p.mes_label,
    bajas: (p.bajas_reales ?? p.bajas_proyectadas ?? 0),
    pctMotivo: p.pct_con_motivo,
    proyectado: p.es_forecast,
  })) as LegacyDashboardShape["churnTrend"];

  // ── motivos baja ──
  const motivosBaja = ds.motivos_baja.filter((m) => m.mes === mesActivo).map((m) => ({
    motivo: m.motivo,
    n: m.n_cuentas,
    pct: m.pct_del_total_con_motivo,
    color: m.color_hex,
    brecha: /sin motivo/i.test(m.motivo),
    prioridad: m.prioridad,
    accionable: "—",
  })) as LegacyDashboardShape["motivosBaja"];

  // ── NPS por país ──
  const npsPais = ds.nps.por_pais.filter((p) => p.mes === mesActivo).map((p) => ({
    pais: p.pais,
    nps: p.nps_score,
    n: p.n_respuestas,
    promotores: p.pct_promotores,
    detractores: p.pct_detractores,
    cuentas: 0,
    alerta: p.tiene_alerta,
  })) as LegacyDashboardShape["npsPais"];

  // ── mirror motivos ──
  const mirror = ds.nps.mirror_motivos.filter((m) => m.mes === mesActivo);
  const motivosDetraccion = mirror.filter((m) => m.tipo === "DETRACCIÓN").map((m) => ({
    motivo: m.motivo, n: 0, pct: m.pct_del_segmento,
  })) as LegacyDashboardShape["motivosDetraccion"];
  const motivosPromocion = mirror.filter((m) => m.tipo === "PROMOCIÓN").map((m) => ({
    motivo: m.motivo, n: 0, pct: m.pct_del_segmento,
  })) as LegacyDashboardShape["motivosPromocion"];

  // ── tier dist ──
  const tr = ds.health_score.tiers_resumen.find((t) => t.mes === mesActivo);
  const tierDist = tr ? ([
    { tier: "Champion", count: tr.champion_n, pct: tr.champion_pct, color: TIER_COLOR.Champion },
    { tier: "Healthy",  count: tr.healthy_n,  pct: tr.healthy_pct,  color: TIER_COLOR.Healthy },
    { tier: "At Risk",  count: tr.at_risk_n,  pct: tr.at_risk_pct,  color: TIER_COLOR["At Risk"] },
    { tier: "Critical", count: tr.critical_n, pct: tr.critical_pct, color: TIER_COLOR.Critical },
  ] as LegacyDashboardShape["tierDist"]) : [] as unknown as LegacyDashboardShape["tierDist"];

  // ── risk flags ──
  const riskFlagDist = ds.health_score.risk_flags
    .filter((r) => r.mes === mesActivo)
    .map((r) => ({ flag: r.flag, count: r.n_cuentas, color: FLAG_COLOR[r.flag] ?? "#6E6D66" })) as LegacyDashboardShape["riskFlagDist"];

  // ── cuentas activas ──
  const healthAccounts = ds.health_score.cuentas_activas
    .filter((c) => c.mes === mesActivo)
    .map((c, i) => ({
      id: Number(c.id_cuenta) || i,
      nombre: c.nombre,
      pais: c.pais,
      plan: c.plan,
      score: c.health_score,
      tier: c.tier,
      tendencia: c.tendencia,
      trendDir: c.tendencia_dir === "down" && /crít/i.test(c.tendencia) ? "crit" : c.tendencia_dir === "stable" ? "flat" : c.tendencia_dir,
      flags: c.risk_flags,
      npsLtr: c.nps_ltr,
      npsGrupo: c.nps_ltr === null ? "—" : c.nps_ltr >= 9 ? "Promotor" : c.nps_ltr <= 6 ? "Detractor" : "Neutro",
      csPrio: c.prio_cs,
    })) as LegacyDashboardShape["healthAccounts"];

  // ── kpis (mapping a la forma vieja con strings) ──
  const fmt = (n: number, unit: string) => unit === "%" ? `${n.toFixed(1)}%` : unit === "score" ? n.toFixed(2) : n.toLocaleString();
  const kpiStatusMap: Record<string, string> = { ROJO: "rojo", VIGILAR: "vigilar", ESTABLE: "estable", VERDE: "verde" };
  const kpiTargets = ds.kpis_iniciativas.kpis.filter((k) => k.mes === mesActivo).map((k) => ({
    kpi: k.nombre,
    baseline: fmt(k.baseline, k.unidad),
    target3m: (k.direccion_deseada === "bajar" ? "<" : ">") + fmt(k.target_3m, k.unidad),
    target6m: (k.direccion_deseada === "bajar" ? "<" : ">") + fmt(k.target_6m, k.unidad),
    current: fmt(k.valor_actual, k.unidad),
    status: kpiStatusMap[k.estado] ?? "vigilar",
  })) as LegacyDashboardShape["kpiTargets"];

  const iniciativas = ds.kpis_iniciativas.iniciativas.map((i) => ({
    id: i.numero, titulo: i.titulo, prioridad: i.prioridad,
    owner: i.area, timeline: i.timeline_semanas, impacto: i.impacto_esperado,
    estado: i.estado === "en curso" ? "en_progreso" : i.estado, descripcion: i.descripcion,
  })) as LegacyDashboardShape["iniciativas"];

  // ── derivables no presentes en el schema canónico (placeholders desde seed por ahora) ──
  const cvrSeed = seedFallback.cvrNeto as LegacyDashboardShape["cvrNeto"];
  const csatSeed = seedFallback.csatMensual as LegacyDashboardShape["csatMensual"];

  return {
    churnTrend,
    churnByMotivo: seedFallback.churnByMotivo as LegacyDashboardShape["churnByMotivo"],
    motivosBaja,
    npsPais,
    npsPorGmv: seedFallback.npsPorGmv as LegacyDashboardShape["npsPorGmv"],
    npsPorAntiguedad: seedFallback.npsPorAntiguedad as LegacyDashboardShape["npsPorAntiguedad"],
    motivosDetraccion,
    motivosPromocion,
    desgloseCosto: seedFallback.desgloseCosto as LegacyDashboardShape["desgloseCosto"],
    csatMensual: csatSeed,
    takeRateBuckets: seedFallback.takeRateBuckets as LegacyDashboardShape["takeRateBuckets"],
    cvrNeto: cvrSeed,
    tierDist,
    riskFlagDist,
    featureGaps: seedFallback.featureGaps as LegacyDashboardShape["featureGaps"],
    healthAccounts,
    verbatims: seedFallback.verbatims as LegacyDashboardShape["verbatims"],
    kpiTargets,
    iniciativas,
  };
}
