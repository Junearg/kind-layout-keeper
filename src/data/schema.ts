// Esquema canónico del dataset mensual.
// Todo el dashboard se alimenta desde acá.

export type Prioridad = "CRÍTICA" | "ALTA" | "MEDIA" | "ESTRAT.";
export type Tier = "Champion" | "Healthy" | "At Risk" | "Critical";
export type TrendDir = "up" | "stable" | "down";
export type NpsTipo = "DETRACCIÓN" | "PROMOCIÓN";
export type KpiEstado = "ROJO" | "VIGILAR" | "ESTABLE" | "VERDE";
export type IniciativaEstado = "planificado" | "en curso" | "completado";
export type IniciativaPrioridad = "ALTA" | "MEDIA" | "BAJA";

/** ───── Hoja 1: resumen_mensual ───── */
export type ResumenMes = {
  mes: string;            // "2026-04"
  mes_label: string;      // "Abril"
  bajas_reales: number;
  bajas_ytd: number;
  var_pct_mes_anterior: number;
  total_respuestas_calidad: number;
  nps_global: number;
  csat_promedio: number;
  cvr_neto_bajas_pct: number;
  cuentas_activas_total: number;
  cuentas_champion: number;
  cuentas_healthy: number;
  cuentas_at_risk: number;
  cuentas_critical: number;
  pct_bajas_sin_motivo: number;
  n_bajas_sin_motivo: number;
  alerta_pais_nps_bajo: string;
  alerta_nps_bajo_valor: number;
  alerta_nps_gap_vs_lider: number;
  alerta_aceleracion_periodo: string;
  alerta_aceleracion_pct: number;
  proyeccion_mes_siguiente: number;
  proyeccion_pct_vs_actual: number;
  proyeccion_total_periodo_estimado: number;
};

/** ───── Hoja 2: tendencia_mensual ───── */
export type TendenciaPunto = {
  mes: string;
  mes_label: string;
  bajas_reales: number | null;
  bajas_proyectadas: number | null;
  pct_con_motivo: number | null;
  es_forecast: boolean;
};

/** ───── Hoja 3: motivos_baja ───── */
export type MotivoBaja = {
  motivo: string;
  n_cuentas: number;
  pct_del_total_con_motivo: number;
  pct_del_total_general: number;
  prioridad: Prioridad;
  color_hex: string;
  mes: string;
};

/** ───── Hoja 4: nps ───── */
export type NpsGlobalRow = {
  mes: string;
  nps_score_global: number;
  n_total_respuestas: number;
  n_promotores: number;
  pct_promotores: number;
  n_pasivos: number;
  pct_pasivos: number;
  n_detractores: number;
  pct_detractores: number;
};
export type NpsPais = {
  mes: string;
  pais: string;
  nps_score: number;
  n_respuestas: number;
  pct_promotores: number;
  pct_pasivos: number;
  pct_detractores: number;
  tiene_alerta: boolean;
};
export type NpsMirrorMotivo = {
  mes: string;
  motivo: string;
  tipo: NpsTipo;
  pct_del_segmento: number;
};

/** ───── Hoja 5: health_score ───── */
export type TierResumen = {
  mes: string;
  champion_n: number;  champion_pct: number;
  healthy_n: number;   healthy_pct: number;
  at_risk_n: number;   at_risk_pct: number;
  critical_n: number;  critical_pct: number;
};
export type RiskFlag = {
  mes: string;
  flag: string;
  n_cuentas: number;
};
export type CuentaActiva = {
  mes: string;
  id_cuenta: string;
  nombre: string;
  pais: string;
  plan: string;
  health_score: number;
  tier: Tier;
  tendencia: string;
  tendencia_dir: TrendDir;
  risk_flags: string[];
  nps_ltr: number | null;
  prio_cs: number;
};

/** ───── Hoja 6: cola_cs ───── */
export type CuentaCola = {
  mes: string;
  id_cuenta: string;
  nombre: string;
  pais: string;
  plan: string;
  tier: Tier;
  tendencia: string;
  risk_flags: string[];
  prio_cs: number;
  contactada_hoy: boolean;
  es_critica: boolean;
};

/** ───── Hoja 7: kpis + iniciativas ───── */
export type Kpi = {
  mes: string;
  nombre: string;
  valor_actual: number;
  unidad: string;
  estado: KpiEstado;
  baseline: number;
  target_3m: number;
  target_6m: number;
  direccion_deseada: "subir" | "bajar";
};
export type Iniciativa = {
  numero: number;
  area: string;
  titulo: string;
  descripcion: string;
  prioridad: IniciativaPrioridad;
  estado: IniciativaEstado;
  timeline_semanas: string;
  impacto_esperado: string;
};

export type DatasetMeta = {
  uploaded_at: string;        // ISO
  source_filename: string;
  meses_disponibles: string[];
};

export type DashboardDataset = {
  meta: DatasetMeta;
  resumen_mensual: ResumenMes[];
  tendencia_mensual: TendenciaPunto[];
  motivos_baja: MotivoBaja[];
  nps: {
    global: NpsGlobalRow[];
    por_pais: NpsPais[];
    mirror_motivos: NpsMirrorMotivo[];
  };
  health_score: {
    tiers_resumen: TierResumen[];
    risk_flags: RiskFlag[];
    cuentas_activas: CuentaActiva[];
  };
  cola_cs: CuentaCola[];
  kpis_iniciativas: {
    kpis: Kpi[];
    iniciativas: Iniciativa[];
  };
};

/** Etiqueta corta de mes a partir de "2026-04". */
export const MES_LABEL_CORTO: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};
export const MES_LABEL_LARGO: Record<string, string> = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
};
export function mesCorto(mes: string): string {
  const mm = mes.slice(5, 7);
  return MES_LABEL_CORTO[mm] ?? mes;
}
export function mesLargo(mes: string): string {
  const yyyy = mes.slice(0, 4);
  const mm = mes.slice(5, 7);
  return `${MES_LABEL_LARGO[mm] ?? mes} ${yyyy}`;
}
