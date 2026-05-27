// Parser declarativo del XLSX de plantilla → DashboardDataset.
// Devuelve { dataset, report } con errores/warnings por hoja.

import * as XLSX from "xlsx";
import type {
  DashboardDataset, Iniciativa, Kpi, MotivoBaja, NpsGlobalRow, NpsMirrorMotivo,
  NpsPais, ResumenMes, RiskFlag, TendenciaPunto, TierResumen, CuentaActiva, CuentaCola,
  Prioridad, Tier, NpsTipo, KpiEstado, IniciativaEstado, IniciativaPrioridad, TrendDir,
} from "@/data/schema";

export type SheetReport = {
  sheet: string;
  status: "ok" | "missing" | "warn" | "error";
  rows_parseadas: number;
  campos_faltantes: string[];
  errores: Array<{ fila: number; campo: string; motivo: string }>;
};
export type ParseReport = {
  filename: string;
  hojas: SheetReport[];
  total_filas: number;
};

// ── helpers de casting ──
function s(v: unknown): string { return v == null ? "" : String(v).trim(); }
function n(v: unknown): number | null {
  if (v === "" || v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const x = Number(String(v).replace(/[%,\s$]/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
function b(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const t = s(v).toLowerCase();
  return t === "true" || t === "1" || t === "sí" || t === "si" || t === "yes" || t === "verdadero";
}
function arr(v: unknown): string[] {
  const raw = s(v); if (!raw) return [];
  return raw.split(/\s*[|·,]\s*/).map((x) => x.trim()).filter(Boolean);
}
function enumOr<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const x = s(v); const f = allowed.find((a) => a.toLowerCase() === x.toLowerCase());
  return f ?? fallback;
}

function readSheet(wb: XLSX.WorkBook, name: string): Array<Record<string, unknown>> | null {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", blankrows: false });
}

const TIERS = ["Champion", "Healthy", "At Risk", "Critical"] as const;
const PRIOS = ["CRÍTICA", "ALTA", "MEDIA", "ESTRAT."] as const;
const TRENDS = ["up", "stable", "down"] as const;
const NPS_TIPOS = ["DETRACCIÓN", "PROMOCIÓN"] as const;
const KPI_ESTADOS = ["ROJO", "VIGILAR", "ESTABLE", "VERDE"] as const;
const INI_ESTADOS = ["planificado", "en curso", "completado"] as const;
const INI_PRIOS = ["ALTA", "MEDIA", "BAJA"] as const;
const DIRS = ["subir", "bajar"] as const;

type ParserFn<T> = (rows: Array<Record<string, unknown>>, rep: SheetReport) => T[];

function parseRows<T>(
  wb: XLSX.WorkBook,
  sheet: string,
  parser: ParserFn<T>,
  required: string[],
  hojas: SheetReport[],
): T[] {
  const raw = readSheet(wb, sheet);
  const rep: SheetReport = { sheet, status: "ok", rows_parseadas: 0, campos_faltantes: [], errores: [] };
  if (!raw) {
    rep.status = "missing";
    hojas.push(rep);
    return [];
  }
  const headers = raw.length ? Object.keys(raw[0]!) : [];
  rep.campos_faltantes = required.filter((r) => !headers.includes(r));
  if (rep.campos_faltantes.length) rep.status = "warn";
  const out = parser(raw, rep);
  rep.rows_parseadas = out.length;
  hojas.push(rep);
  return out;
}

export function parseTemplateWorkbook(wb: XLSX.WorkBook, filename = ""): { dataset: DashboardDataset; report: ParseReport } {
  const hojas: SheetReport[] = [];

  const resumen_mensual = parseRows<ResumenMes>(wb, "resumen_mensual", (rows) => rows.map((r) => ({
    mes: s(r.mes), mes_label: s(r.mes_label),
    bajas_reales: n(r.bajas_reales) ?? 0,
    bajas_ytd: n(r.bajas_ytd) ?? 0,
    var_pct_mes_anterior: n(r.var_pct_mes_anterior) ?? 0,
    total_respuestas_calidad: n(r.total_respuestas_calidad) ?? 0,
    nps_global: n(r.nps_global) ?? 0,
    csat_promedio: n(r.csat_promedio) ?? 0,
    cvr_neto_bajas_pct: n(r.cvr_neto_bajas_pct) ?? 0,
    cuentas_activas_total: n(r.cuentas_activas_total) ?? 0,
    cuentas_champion: n(r.cuentas_champion) ?? 0,
    cuentas_healthy: n(r.cuentas_healthy) ?? 0,
    cuentas_at_risk: n(r.cuentas_at_risk) ?? 0,
    cuentas_critical: n(r.cuentas_critical) ?? 0,
    pct_bajas_sin_motivo: n(r.pct_bajas_sin_motivo) ?? 0,
    n_bajas_sin_motivo: n(r.n_bajas_sin_motivo) ?? 0,
    alerta_pais_nps_bajo: s(r.alerta_pais_nps_bajo),
    alerta_nps_bajo_valor: n(r.alerta_nps_bajo_valor) ?? 0,
    alerta_nps_gap_vs_lider: n(r.alerta_nps_gap_vs_lider) ?? 0,
    alerta_aceleracion_periodo: s(r.alerta_aceleracion_periodo),
    alerta_aceleracion_pct: n(r.alerta_aceleracion_pct) ?? 0,
    proyeccion_mes_siguiente: n(r.proyeccion_mes_siguiente) ?? 0,
    proyeccion_pct_vs_actual: n(r.proyeccion_pct_vs_actual) ?? 0,
    proyeccion_total_periodo_estimado: n(r.proyeccion_total_periodo_estimado) ?? 0,
    forecast_auto: b(r.forecast_auto),
  })).filter((r) => r.mes), ["mes", "mes_label", "bajas_reales"], hojas);

  const tendencia_mensual = parseRows<TendenciaPunto>(wb, "tendencia_mensual", (rows) => rows.map((r) => ({
    mes: s(r.mes), mes_label: s(r.mes_label),
    bajas_reales: n(r.bajas_reales), bajas_proyectadas: n(r.bajas_proyectadas),
    pct_con_motivo: n(r.pct_con_motivo), es_forecast: b(r.es_forecast),
  })).filter((r) => r.mes), ["mes", "es_forecast"], hojas);

  const motivos_baja = parseRows<MotivoBaja>(wb, "motivos_baja", (rows) => rows.map((r) => ({
    motivo: s(r.motivo),
    n_cuentas: n(r.n_cuentas) ?? 0,
    pct_del_total_con_motivo: n(r.pct_del_total_con_motivo) ?? 0,
    pct_del_total_general: n(r.pct_del_total_general) ?? 0,
    prioridad: enumOr<Prioridad>(r.prioridad, PRIOS, "MEDIA"),
    color_hex: s(r.color_hex) || "#6B7280",
    mes: s(r.mes),
  })).filter((r) => r.motivo && r.mes), ["mes", "motivo"], hojas);

  const npsGlobal = parseRows<NpsGlobalRow>(wb, "nps_global", (rows) => rows.map((r) => ({
    mes: s(r.mes),
    nps_score_global: n(r.nps_score_global) ?? 0,
    n_total_respuestas: n(r.n_total_respuestas) ?? 0,
    n_promotores: n(r.n_promotores) ?? 0, pct_promotores: n(r.pct_promotores) ?? 0,
    n_pasivos: n(r.n_pasivos) ?? 0, pct_pasivos: n(r.pct_pasivos) ?? 0,
    n_detractores: n(r.n_detractores) ?? 0, pct_detractores: n(r.pct_detractores) ?? 0,
  })).filter((r) => r.mes), ["mes"], hojas);

  const npsPais = parseRows<NpsPais>(wb, "nps_por_pais", (rows) => rows.map((r) => ({
    mes: s(r.mes), pais: s(r.pais),
    nps_score: n(r.nps_score) ?? 0, n_respuestas: n(r.n_respuestas) ?? 0,
    pct_promotores: n(r.pct_promotores) ?? 0, pct_pasivos: n(r.pct_pasivos) ?? 0,
    pct_detractores: n(r.pct_detractores) ?? 0, tiene_alerta: b(r.tiene_alerta),
  })).filter((r) => r.mes && r.pais), ["mes", "pais"], hojas);

  const npsMirror = parseRows<NpsMirrorMotivo>(wb, "nps_mirror_motivos", (rows) => rows.map((r) => ({
    mes: s(r.mes), motivo: s(r.motivo),
    tipo: enumOr<NpsTipo>(r.tipo, NPS_TIPOS, "DETRACCIÓN"),
    pct_del_segmento: n(r.pct_del_segmento) ?? 0,
  })).filter((r) => r.mes && r.motivo), ["mes", "motivo", "tipo"], hojas);

  const tiers_resumen = parseRows<TierResumen>(wb, "health_tiers", (rows) => rows.map((r) => ({
    mes: s(r.mes),
    champion_n: n(r.champion_n) ?? 0, champion_pct: n(r.champion_pct) ?? 0,
    healthy_n: n(r.healthy_n) ?? 0, healthy_pct: n(r.healthy_pct) ?? 0,
    at_risk_n: n(r.at_risk_n) ?? 0, at_risk_pct: n(r.at_risk_pct) ?? 0,
    critical_n: n(r.critical_n) ?? 0, critical_pct: n(r.critical_pct) ?? 0,
  })).filter((r) => r.mes), ["mes"], hojas);

  const risk_flags = parseRows<RiskFlag>(wb, "health_flags", (rows) => rows.map((r) => ({
    mes: s(r.mes), flag: s(r.flag), n_cuentas: n(r.n_cuentas) ?? 0,
  })).filter((r) => r.mes && r.flag), ["mes", "flag"], hojas);

  const cuentas_activas = parseRows<CuentaActiva>(wb, "health_cuentas", (rows) => rows.map((r) => ({
    mes: s(r.mes), id_cuenta: s(r.id_cuenta), nombre: s(r.nombre),
    pais: s(r.pais), plan: s(r.plan),
    health_score: n(r.health_score) ?? 0,
    tier: enumOr<Tier>(r.tier, TIERS, "Healthy"),
    tendencia: s(r.tendencia),
    tendencia_dir: enumOr<TrendDir>(r.tendencia_dir, TRENDS, "stable"),
    risk_flags: arr(r.risk_flags),
    nps_ltr: n(r.nps_ltr),
    prio_cs: n(r.prio_cs) ?? 0,
  })).filter((r) => r.mes && r.id_cuenta), ["mes", "id_cuenta", "tier"], hojas);

  const cola_cs = parseRows<CuentaCola>(wb, "cola_cs", (rows) => rows.map((r) => ({
    mes: s(r.mes), id_cuenta: s(r.id_cuenta), nombre: s(r.nombre),
    pais: s(r.pais), plan: s(r.plan),
    tier: enumOr<Tier>(r.tier, TIERS, "Healthy"),
    tendencia: s(r.tendencia), risk_flags: arr(r.risk_flags),
    prio_cs: n(r.prio_cs) ?? 0,
    contactada_hoy: b(r.contactada_hoy), es_critica: b(r.es_critica),
  })).filter((r) => r.mes && r.id_cuenta), ["mes", "id_cuenta"], hojas);

  const kpis = parseRows<Kpi>(wb, "kpis", (rows) => rows.map((r) => ({
    mes: s(r.mes), nombre: s(r.nombre),
    valor_actual: n(r.valor_actual) ?? 0, unidad: s(r.unidad) || "cuentas",
    estado: enumOr<KpiEstado>(r.estado, KPI_ESTADOS, "VIGILAR"),
    baseline: n(r.baseline) ?? 0, target_3m: n(r.target_3m) ?? 0, target_6m: n(r.target_6m) ?? 0,
    direccion_deseada: enumOr(r.direccion_deseada, DIRS, "subir"),
  })).filter((r) => r.mes && r.nombre), ["mes", "nombre"], hojas);

  const iniciativas = parseRows<Iniciativa>(wb, "iniciativas", (rows) => rows.map((r) => ({
    numero: n(r.numero) ?? 0,
    area: s(r.area), titulo: s(r.titulo), descripcion: s(r.descripcion),
    prioridad: enumOr<IniciativaPrioridad>(r.prioridad, INI_PRIOS, "MEDIA"),
    estado: enumOr<IniciativaEstado>(r.estado, INI_ESTADOS, "planificado"),
    timeline_semanas: s(r.timeline_semanas),
    impacto_esperado: s(r.impacto_esperado),
    mes_creacion: s(r.mes_creacion),
    mes_actualizacion: s(r.mes_actualizacion) || s(r.mes_creacion),
  })).filter((r) => r.titulo), ["numero", "titulo", "mes_creacion"], hojas);

  // ── meses disponibles: unión de todas las hojas con campo "mes" ──
  const mesesSet = new Set<string>();
  [resumen_mensual, tendencia_mensual, motivos_baja, npsGlobal, npsPais, npsMirror,
   tiers_resumen, risk_flags, cuentas_activas, cola_cs, kpis].forEach((arr) => {
     arr.forEach((r) => { if ("mes" in r && r.mes) mesesSet.add(r.mes as string); });
  });
  const meses_disponibles = [...mesesSet].sort();

  const dataset: DashboardDataset = {
    meta: {
      uploaded_at: new Date().toISOString(),
      source_filename: filename,
      meses_disponibles,
    },
    resumen_mensual,
    tendencia_mensual,
    motivos_baja,
    nps: { global: npsGlobal, por_pais: npsPais, mirror_motivos: npsMirror },
    health_score: { tiers_resumen, risk_flags, cuentas_activas },
    cola_cs,
    kpis_iniciativas: { kpis, iniciativas },
  };

  const total = hojas.reduce((s, h) => s + h.rows_parseadas, 0);
  return { dataset, report: { filename, hojas, total_filas: total } };
}
