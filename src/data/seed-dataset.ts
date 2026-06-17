// Seed inicial — convierte la data histórica mock a un dataset canónico
// con un único mes cerrado (2026-04, Abril). El equipo lo reemplaza
// importando su propio XLSX desde /importar.
//
// Nota: los datos acá NO son "hardcodes de UI" — representan el dataset
// por defecto. Una vez que el usuario importa el archivo mensual, este
// seed deja de usarse (queda en localStorage el dataset real).

import type { DashboardDataset } from "./schema";
import * as base from "./mockData";

const MES = "2026-04";
const MES_LABEL = "Abril";

const churnTrendMap = (base.churnTrend as Array<{ mes: string; bajas: number; pctMotivo: number | null; proyectado: boolean }>).map((p, i) => {
  // mapeo aproximado "Dic"→2025-12, "Ene"→2026-01, …
  const order = ["Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun"];
  const yr = ["2025", "2026", "2026", "2026", "2026", "2026", "2026"];
  const mm = ["12", "01", "02", "03", "04", "05", "06"];
  const baseLabel = p.mes.replace(/\*+$/, "");
  const idx = Math.max(0, order.indexOf(baseLabel));
  return {
    mes: `${yr[idx] ?? "2026"}-${mm[idx] ?? "04"}`,
    mes_label: baseLabel,
    bajas_reales: p.proyectado ? null : p.bajas,
    bajas_proyectadas: p.proyectado ? p.bajas : null,
    pct_con_motivo: p.pctMotivo,
    es_forecast: p.proyectado,
    _order: i,
  };
}).sort((a, b) => a._order - b._order).map(({ _order, ...x }) => x);

const tierAbr = base.tierDist as Array<{ tier: string; count: number; pct: number; color: string }>;
const tierByName = (n: string) => tierAbr.find((t) => t.tier === n);

const motivosBajaMes = (base.motivosBaja as Array<{ motivo: string; n: number; pct: number; color: string; prioridad: string }>).map((m) => {
  const totalGen = base.motivosBaja.reduce((s, x) => s + x.n, 0);
  const prio = (m.prioridad ?? "MEDIA").toUpperCase();
  const mapped =
    prio.startsWith("CRÍTIC") ? "CRÍTICA"
    : prio.startsWith("ALTA") ? "ALTA"
    : prio.startsWith("ESTRAT") ? "ESTRAT."
    : "MEDIA";
  return {
    motivo: m.motivo,
    n_cuentas: m.n,
    pct_del_total_con_motivo: m.pct,
    pct_del_total_general: totalGen ? +(m.n / totalGen * 100).toFixed(2) : 0,
    prioridad: mapped as "CRÍTICA" | "ALTA" | "MEDIA" | "ESTRAT.",
    color_hex: m.color,
    mes: MES,
  };
});

const sinMotivo = base.motivosBaja.find((m) => /sin motivo/i.test(m.motivo));
const totalBajas = base.motivosBaja.reduce((s, m) => s + m.n, 0);
const npsTot = (base.npsPais as Array<{ pais: string; nps: number; n: number; promotores: number; detractores: number; alerta: boolean }>);
const npsResp = npsTot.reduce((s, p) => s + p.n, 0);
const npsW = (k: "promotores" | "detractores") => npsTot.reduce((s, p) => s + p.n * p[k], 0) / (npsResp || 1);
const npsGlobalW = npsTot.reduce((s, p) => s + p.n * p.nps, 0) / (npsResp || 1);
const promP = npsW("promotores"), detP = npsW("detractores"), pasP = Math.max(0, 100 - promP - detP);
const npsWorst = [...npsTot].sort((a, b) => a.nps - b.nps)[0];
const npsBest = [...npsTot].sort((a, b) => b.nps - a.nps)[0];

const abrPoint = churnTrendMap.find((p) => p.mes === MES);
const marPoint = churnTrendMap.find((p) => p.mes === "2026-03");
const mayPoint = churnTrendMap.find((p) => p.mes === "2026-05");
const febPoint = churnTrendMap.find((p) => p.mes === "2026-02");
const bajasYTD = churnTrendMap.filter((p) => p.bajas_reales !== null && p.mes >= "2026-01" && p.mes <= MES).reduce((s, p) => s + (p.bajas_reales ?? 0), 0);

const resumenAbr = {
  mes: MES,
  mes_label: MES_LABEL,
  bajas_reales: abrPoint?.bajas_reales ?? 0,
  bajas_ytd: bajasYTD,
  var_pct_mes_anterior: marPoint && abrPoint && abrPoint.bajas_reales && marPoint.bajas_reales
    ? +((abrPoint.bajas_reales - marPoint.bajas_reales) / marPoint.bajas_reales * 100).toFixed(1) : 0,
  total_respuestas_calidad: npsResp,
  nps_global: +npsGlobalW.toFixed(2),
  csat_promedio: 4.79,
  cvr_neto_bajas_pct: 19.9,
  cuentas_activas_total: tierAbr.reduce((s, t) => s + t.count, 0),
  cuentas_champion: tierByName("Champion")?.count ?? 0,
  cuentas_healthy: tierByName("Healthy")?.count ?? 0,
  cuentas_at_risk: tierByName("At Risk")?.count ?? 0,
  cuentas_critical: tierByName("Critical")?.count ?? 0,
  pct_bajas_sin_motivo: sinMotivo ? +((sinMotivo.n / totalBajas) * 100).toFixed(1) : 0,
  n_bajas_sin_motivo: sinMotivo?.n ?? 0,
  alerta_pais_nps_bajo: npsWorst?.pais ?? "",
  alerta_nps_bajo_valor: +(npsWorst?.nps ?? 0).toFixed(2),
  alerta_nps_gap_vs_lider: npsBest && npsWorst ? +(npsBest.nps - npsWorst.nps).toFixed(1) : 0,
  alerta_aceleracion_periodo: febPoint && abrPoint ? `${febPoint.mes_label}→${abrPoint.mes_label}` : "",
  alerta_aceleracion_pct: febPoint?.bajas_reales && abrPoint?.bajas_reales
    ? +(((abrPoint.bajas_reales - febPoint.bajas_reales) / febPoint.bajas_reales) * 100).toFixed(1) : 0,
  proyeccion_mes_siguiente: mayPoint?.bajas_proyectadas ?? 0,
  proyeccion_pct_vs_actual: mayPoint?.bajas_proyectadas && abrPoint?.bajas_reales
    ? +(((mayPoint.bajas_proyectadas - abrPoint.bajas_reales) / abrPoint.bajas_reales) * 100).toFixed(1) : 0,
  proyeccion_total_periodo_estimado: churnTrendMap.reduce((s, p) => s + (p.bajas_reales ?? p.bajas_proyectadas ?? 0), 0),
  forecast_auto: false,
};

const npsGlobal = [{
  mes: MES,
  nps_score_global: +npsGlobalW.toFixed(2),
  n_total_respuestas: npsResp,
  n_promotores: Math.round(npsResp * promP / 100),
  pct_promotores: +promP.toFixed(1),
  n_pasivos: Math.round(npsResp * pasP / 100),
  pct_pasivos: +pasP.toFixed(1),
  n_detractores: Math.round(npsResp * detP / 100),
  pct_detractores: +detP.toFixed(1),
}];

const npsPorPais = npsTot.map((p) => ({
  mes: MES,
  pais: p.pais,
  nps_score: +p.nps.toFixed(2),
  n_respuestas: p.n,
  pct_promotores: p.promotores,
  pct_pasivos: +Math.max(0, 100 - p.promotores - p.detractores).toFixed(1),
  pct_detractores: p.detractores,
  tiene_alerta: !!p.alerta,
}));

const mirror = [
  ...(base.motivosDetraccion as Array<{ motivo: string; pct: number }>).map((m) => ({ mes: MES, motivo: m.motivo, tipo: "DETRACCIÓN" as const, pct_del_segmento: m.pct })),
  ...(base.motivosPromocion as Array<{ motivo: string; pct: number }>).map((m) => ({ mes: MES, motivo: m.motivo, tipo: "PROMOCIÓN" as const, pct_del_segmento: m.pct })),
];

const tiersResumen = [{
  mes: MES,
  champion_n: tierByName("Champion")?.count ?? 0,  champion_pct: tierByName("Champion")?.pct ?? 0,
  healthy_n: tierByName("Healthy")?.count ?? 0,    healthy_pct: tierByName("Healthy")?.pct ?? 0,
  at_risk_n: tierByName("At Risk")?.count ?? 0,    at_risk_pct: tierByName("At Risk")?.pct ?? 0,
  critical_n: tierByName("Critical")?.count ?? 0,  critical_pct: tierByName("Critical")?.pct ?? 0,
}];

const riskFlagsArr = (base.riskFlagDist as Array<{ flag: string; count: number }>).map((r) => ({ mes: MES, flag: r.flag, n_cuentas: r.count }));

const cuentasActivas = (base.healthAccounts as Array<{ id: number; nombre: string; pais: string; plan: string; score: number; tier: string; tendencia: string; trendDir: string; flags: string[]; npsLtr: number | null; csPrio: number }>).map((a) => ({
  mes: MES,
  id_cuenta: String(a.id),
  nombre: a.nombre,
  pais: a.pais,
  plan: a.plan,
  health_score: a.score,
  tier: (a.tier === "At Risk" ? "At Risk" : a.tier) as "Champion" | "Healthy" | "At Risk" | "Critical",
  tendencia: a.tendencia,
  tendencia_dir: (a.trendDir === "up" ? "up" : a.trendDir === "down" || a.trendDir === "crit" ? "down" : "stable") as "up" | "stable" | "down",
  risk_flags: a.flags ?? [],
  nps_ltr: a.npsLtr ?? null,
  prio_cs: a.csPrio,
}));

const colaCs = cuentasActivas.filter((a) => a.prio_cs >= 35).map((a) => ({
  mes: MES,
  id_cuenta: a.id_cuenta,
  nombre: a.nombre,
  pais: a.pais,
  plan: a.plan,
  tier: a.tier,
  tendencia: a.tendencia,
  risk_flags: a.risk_flags,
  prio_cs: a.prio_cs,
  contactada_hoy: false,
  es_critica: a.tier === "Critical" || a.prio_cs >= 50,
}));

const ESTADO_MAP: Record<string, "ROJO" | "VIGILAR" | "ESTABLE" | "VERDE"> = {
  rojo: "ROJO", critico: "ROJO", vigilar: "VIGILAR", estable: "ESTABLE", verde: "VERDE", sindato: "VIGILAR",
};
const num = (s: unknown) => {
  if (typeof s === "number") return s;
  const n = Number(String(s ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const kpis = (base.kpiTargets as Array<{ kpi: string; baseline: string; target3m: string; target6m: string; current: string; status: string }>).map((k) => ({
  mes: MES,
  nombre: k.kpi,
  valor_actual: num(k.current),
  unidad: /%/.test(k.current) ? "%" : /\//.test(k.current) ? "score" : "cuentas",
  estado: ESTADO_MAP[k.status] ?? "VIGILAR",
  baseline: num(k.baseline),
  target_3m: num(k.target3m),
  target_6m: num(k.target6m),
  direccion_deseada: /bajas|churn|detract/i.test(k.kpi) ? "bajar" as const : "subir" as const,
}));

const iniciativas = (base.iniciativas as Array<{ id: number; titulo: string; prioridad: string; owner: string; timeline: string; impacto: string; estado: string; descripcion: string }>).map((i) => {
  const prio = i.prioridad.toUpperCase();
  const mappedPrio = prio.startsWith("ALTA") ? "ALTA" : prio.startsWith("BAJA") ? "BAJA" : "MEDIA";
  const estMap: Record<string, "planificado" | "en curso" | "completado"> = {
    planificado: "planificado", en_progreso: "en curso", "en progreso": "en curso", completado: "completado",
  };
  return {
    numero: i.id,
    area: i.owner,
    titulo: i.titulo,
    descripcion: i.descripcion,
    prioridad: mappedPrio as "ALTA" | "MEDIA" | "BAJA",
    estado: estMap[i.estado] ?? "planificado",
    timeline_semanas: i.timeline,
    impacto_esperado: i.impacto,
    mes_creacion: MES,
    mes_actualizacion: MES,
  };
});

export const SEED_DATASET: DashboardDataset = {
  meta: {
    uploaded_at: new Date("2026-05-01T10:00:00").toISOString(),
    source_filename: "seed inicial (Abril 2026)",
    meses_disponibles: [MES],
  },
  resumen_mensual: [resumenAbr],
  tendencia_mensual: churnTrendMap,
  motivos_baja: motivosBajaMes,
  nps: { global: npsGlobal, por_pais: npsPorPais, mirror_motivos: mirror },
  health_score: { tiers_resumen: tiersResumen, risk_flags: riskFlagsArr, cuentas_activas: cuentasActivas },
  cola_cs: colaCs,
  kpis_iniciativas: { kpis, iniciativas },
};
