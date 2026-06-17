// Genera el XLSX de plantilla que el equipo descarga, llena y vuelve a
// subir. 8 hojas: INSTRUCCIONES + 7 hojas de datos (algunas con sub-hojas
// para separar bloques relacionados).
//
// La salida es 100% redonda: lo que produce este file puede leerse con
// `parse-workbook-v2.ts` y reconstruir un DashboardDataset.

import * as XLSX from "xlsx";

type FieldSpec = {
  campo: string;
  tipo: "string" | "number" | "boolean" | "date" | "string[]" | "enum";
  obligatorio: boolean;
  ejemplo: string;
  descripcion: string;
};

type SheetSpec = {
  name: string;        // pestaña en el XLSX
  schemaKey: string;   // clave en el dataset
  description: string;
  fields: FieldSpec[];
  sample: Array<Record<string, unknown>>;
};

const SHEETS: SheetSpec[] = [
  {
    name: "resumen_mensual",
    schemaKey: "resumen_mensual",
    description: "Una fila por mes cerrado. Alimenta el resumen ejecutivo, KPIs y alertas.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "Mes en formato YYYY-MM" },
      { campo: "mes_label", tipo: "string", obligatorio: true, ejemplo: "Abril", descripcion: "Etiqueta legible" },
      { campo: "bajas_reales", tipo: "number", obligatorio: true, ejemplo: "1446", descripcion: "Total de bajas del mes" },
      { campo: "bajas_ytd", tipo: "number", obligatorio: true, ejemplo: "4839", descripcion: "Acumulado del año" },
      { campo: "var_pct_mes_anterior", tipo: "number", obligatorio: true, ejemplo: "13.6", descripcion: "% variación vs mes previo" },
      { campo: "total_respuestas_calidad", tipo: "number", obligatorio: true, ejemplo: "6915", descripcion: "Respuestas NPS+CSAT del mes" },
      { campo: "nps_global", tipo: "number", obligatorio: true, ejemplo: "47.71", descripcion: "NPS global ponderado" },
      { campo: "csat_promedio", tipo: "number", obligatorio: true, ejemplo: "4.79", descripcion: "CSAT promedio /5" },
      { campo: "cvr_neto_bajas_pct", tipo: "number", obligatorio: true, ejemplo: "19.9", descripcion: "% recupero neto" },
      { campo: "cuentas_activas_total", tipo: "number", obligatorio: true, ejemplo: "818", descripcion: "Cuentas activas al cierre" },
      { campo: "cuentas_champion", tipo: "number", obligatorio: true, ejemplo: "312", descripcion: "Cuentas en tier Champion" },
      { campo: "cuentas_healthy", tipo: "number", obligatorio: true, ejemplo: "287", descripcion: "Cuentas en tier Healthy" },
      { campo: "cuentas_at_risk", tipo: "number", obligatorio: true, ejemplo: "156", descripcion: "Cuentas en tier At Risk" },
      { campo: "cuentas_critical", tipo: "number", obligatorio: true, ejemplo: "63", descripcion: "Cuentas en tier Critical" },
      { campo: "pct_bajas_sin_motivo", tipo: "number", obligatorio: true, ejemplo: "52.1", descripcion: "% del total sin motivo" },
      { campo: "n_bajas_sin_motivo", tipo: "number", obligatorio: true, ejemplo: "3048", descripcion: "Conteo de bajas sin motivo" },
      { campo: "alerta_pais_nps_bajo", tipo: "string", obligatorio: false, ejemplo: "Chile", descripcion: "País con peor NPS" },
      { campo: "alerta_nps_bajo_valor", tipo: "number", obligatorio: false, ejemplo: "37.05", descripcion: "Valor NPS del país peor" },
      { campo: "alerta_nps_gap_vs_lider", tipo: "number", obligatorio: false, ejemplo: "17.6", descripcion: "Diferencia vs líder" },
      { campo: "alerta_aceleracion_periodo", tipo: "string", obligatorio: false, ejemplo: "Feb→Abr", descripcion: "Período comparado" },
      { campo: "alerta_aceleracion_pct", tipo: "number", obligatorio: false, ejemplo: "28.6", descripcion: "% aceleración" },
      { campo: "proyeccion_mes_siguiente", tipo: "number", obligatorio: false, ejemplo: "1634", descripcion: "Forecast manual de bajas" },
      { campo: "proyeccion_pct_vs_actual", tipo: "number", obligatorio: false, ejemplo: "13.0", descripcion: "% del forecast vs mes actual" },
      { campo: "proyeccion_total_periodo_estimado", tipo: "number", obligatorio: false, ejemplo: "9327", descripcion: "Total estimado del período" },
      { campo: "forecast_auto", tipo: "boolean", obligatorio: false, ejemplo: "FALSE", descripcion: "TRUE = la app calcula el forecast con regresión lineal sobre los últimos 3 meses reales y sobreescribe el valor manual" },
    ],
    sample: [{
      mes: "2026-04", mes_label: "Abril",
      bajas_reales: 1446, bajas_ytd: 4839, var_pct_mes_anterior: 13.6,
      total_respuestas_calidad: 6915, nps_global: 47.71, csat_promedio: 4.79,
      cvr_neto_bajas_pct: 19.9, cuentas_activas_total: 818,
      cuentas_champion: 312, cuentas_healthy: 287, cuentas_at_risk: 156, cuentas_critical: 63,
      pct_bajas_sin_motivo: 52.1, n_bajas_sin_motivo: 3048,
      alerta_pais_nps_bajo: "Chile", alerta_nps_bajo_valor: 37.05, alerta_nps_gap_vs_lider: 17.6,
      alerta_aceleracion_periodo: "Feb→Abr", alerta_aceleracion_pct: 28.6,
      proyeccion_mes_siguiente: 1634, proyeccion_pct_vs_actual: 13.0,
      proyeccion_total_periodo_estimado: 9327, forecast_auto: false,
    }],
  },
  {
    name: "tendencia_mensual",
    schemaKey: "tendencia_mensual",
    description: "Una fila por mes (cerrado o proyectado). Alimenta el gráfico de tendencia.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "mes_label", tipo: "string", obligatorio: true, ejemplo: "Abr", descripcion: "Etiqueta corta" },
      { campo: "bajas_reales", tipo: "number", obligatorio: false, ejemplo: "1446", descripcion: "Bajas reales (vacío si es forecast)" },
      { campo: "bajas_proyectadas", tipo: "number", obligatorio: false, ejemplo: "", descripcion: "Bajas proyectadas (manual)" },
      { campo: "pct_con_motivo", tipo: "number", obligatorio: false, ejemplo: "49.9", descripcion: "% con motivo registrado" },
      { campo: "es_forecast", tipo: "boolean", obligatorio: true, ejemplo: "FALSE", descripcion: "TRUE si es un punto proyectado" },
    ],
    sample: [
      { mes: "2026-03", mes_label: "Mar", bajas_reales: 1273, bajas_proyectadas: "", pct_con_motivo: 48.4, es_forecast: false },
      { mes: "2026-04", mes_label: "Abr", bajas_reales: 1446, bajas_proyectadas: "", pct_con_motivo: 49.9, es_forecast: false },
      { mes: "2026-05", mes_label: "May", bajas_reales: "", bajas_proyectadas: 1634, pct_con_motivo: "", es_forecast: true },
    ],
  },
  {
    name: "motivos_baja",
    schemaKey: "motivos_baja",
    description: "Distribución de motivos del mes. Una fila por motivo y mes.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "motivo", tipo: "string", obligatorio: true, ejemplo: "Sin motivo registrado", descripcion: "Nombre del motivo" },
      { campo: "n_cuentas", tipo: "number", obligatorio: true, ejemplo: "3048", descripcion: "Cantidad de cuentas" },
      { campo: "pct_del_total_con_motivo", tipo: "number", obligatorio: true, ejemplo: "52.1", descripcion: "% sobre el total con motivo" },
      { campo: "pct_del_total_general", tipo: "number", obligatorio: true, ejemplo: "52.1", descripcion: "% sobre el total general" },
      { campo: "prioridad", tipo: "enum", obligatorio: true, ejemplo: "CRÍTICA", descripcion: "CRÍTICA | ALTA | MEDIA | ESTRAT." },
      { campo: "color_hex", tipo: "string", obligatorio: false, ejemplo: "#DC2626", descripcion: "Color para el chart" },
    ],
    sample: [
      { mes: "2026-04", motivo: "Sin motivo registrado", n_cuentas: 3048, pct_del_total_con_motivo: 52.1, pct_del_total_general: 52.1, prioridad: "CRÍTICA", color_hex: "#DC2626" },
      { mes: "2026-04", motivo: "Cierre definitivo", n_cuentas: 1036, pct_del_total_con_motivo: 17.7, pct_del_total_general: 17.7, prioridad: "MEDIA", color_hex: "#6B7280" },
    ],
  },
  {
    name: "nps_global",
    schemaKey: "nps.global",
    description: "Una fila por mes. NPS global ponderado.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "nps_score_global", tipo: "number", obligatorio: true, ejemplo: "47.71", descripcion: "NPS global" },
      { campo: "n_total_respuestas", tipo: "number", obligatorio: true, ejemplo: "6915", descripcion: "Respuestas totales" },
      { campo: "n_promotores", tipo: "number", obligatorio: true, ejemplo: "4534", descripcion: "" },
      { campo: "pct_promotores", tipo: "number", obligatorio: true, ejemplo: "65.6", descripcion: "% del total" },
      { campo: "n_pasivos", tipo: "number", obligatorio: true, ejemplo: "1183", descripcion: "" },
      { campo: "pct_pasivos", tipo: "number", obligatorio: true, ejemplo: "17.1", descripcion: "% del total" },
      { campo: "n_detractores", tipo: "number", obligatorio: true, ejemplo: "1198", descripcion: "" },
      { campo: "pct_detractores", tipo: "number", obligatorio: true, ejemplo: "17.3", descripcion: "% del total" },
    ],
    sample: [{ mes: "2026-04", nps_score_global: 47.71, n_total_respuestas: 6915, n_promotores: 4534, pct_promotores: 65.6, n_pasivos: 1183, pct_pasivos: 17.1, n_detractores: 1198, pct_detractores: 17.3 }],
  },
  {
    name: "nps_por_pais",
    schemaKey: "nps.por_pais",
    description: "Una fila por país y mes.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "pais", tipo: "string", obligatorio: true, ejemplo: "Argentina", descripcion: "Nombre país" },
      { campo: "nps_score", tipo: "number", obligatorio: true, ejemplo: "53.95", descripcion: "NPS del país" },
      { campo: "n_respuestas", tipo: "number", obligatorio: true, ejemplo: "2886", descripcion: "" },
      { campo: "pct_promotores", tipo: "number", obligatorio: true, ejemplo: "66.8", descripcion: "%" },
      { campo: "pct_pasivos", tipo: "number", obligatorio: true, ejemplo: "20.3", descripcion: "%" },
      { campo: "pct_detractores", tipo: "number", obligatorio: true, ejemplo: "12.9", descripcion: "%" },
      { campo: "tiene_alerta", tipo: "boolean", obligatorio: false, ejemplo: "FALSE", descripcion: "TRUE para resaltar país problemático" },
    ],
    sample: [
      { mes: "2026-04", pais: "Argentina", nps_score: 53.95, n_respuestas: 2886, pct_promotores: 66.8, pct_pasivos: 20.3, pct_detractores: 12.9, tiene_alerta: false },
      { mes: "2026-04", pais: "Chile", nps_score: 37.05, n_respuestas: 2062, pct_promotores: 60.5, pct_pasivos: 16.0, pct_detractores: 23.5, tiene_alerta: true },
    ],
  },
  {
    name: "nps_mirror_motivos",
    schemaKey: "nps.mirror_motivos",
    description: "Motivos de detracción y promoción del mes.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "motivo", tipo: "string", obligatorio: true, ejemplo: "Costo del sistema", descripcion: "Nombre del motivo" },
      { campo: "tipo", tipo: "enum", obligatorio: true, ejemplo: "DETRACCIÓN", descripcion: "DETRACCIÓN | PROMOCIÓN" },
      { campo: "pct_del_segmento", tipo: "number", obligatorio: true, ejemplo: "34.4", descripcion: "% del segmento" },
    ],
    sample: [
      { mes: "2026-04", motivo: "Costo del sistema", tipo: "DETRACCIÓN", pct_del_segmento: 34.4 },
      { mes: "2026-04", motivo: "Gestión del negocio", tipo: "PROMOCIÓN", pct_del_segmento: 38.1 },
    ],
  },
  {
    name: "health_tiers",
    schemaKey: "health_score.tiers_resumen",
    description: "Distribución de tiers por mes (una fila por mes).",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "champion_n", tipo: "number", obligatorio: true, ejemplo: "312", descripcion: "" },
      { campo: "champion_pct", tipo: "number", obligatorio: true, ejemplo: "38.1", descripcion: "" },
      { campo: "healthy_n", tipo: "number", obligatorio: true, ejemplo: "287", descripcion: "" },
      { campo: "healthy_pct", tipo: "number", obligatorio: true, ejemplo: "35.1", descripcion: "" },
      { campo: "at_risk_n", tipo: "number", obligatorio: true, ejemplo: "156", descripcion: "" },
      { campo: "at_risk_pct", tipo: "number", obligatorio: true, ejemplo: "19.1", descripcion: "" },
      { campo: "critical_n", tipo: "number", obligatorio: true, ejemplo: "63", descripcion: "" },
      { campo: "critical_pct", tipo: "number", obligatorio: true, ejemplo: "7.7", descripcion: "" },
    ],
    sample: [{ mes: "2026-04", champion_n: 312, champion_pct: 38.1, healthy_n: 287, healthy_pct: 35.1, at_risk_n: 156, at_risk_pct: 19.1, critical_n: 63, critical_pct: 7.7 }],
  },
  {
    name: "health_flags",
    schemaKey: "health_score.risk_flags",
    description: "Conteo de flags de riesgo por mes.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "flag", tipo: "string", obligatorio: true, ejemplo: "MONO_CANAL", descripcion: "Identificador del flag" },
      { campo: "n_cuentas", tipo: "number", obligatorio: true, ejemplo: "298", descripcion: "" },
    ],
    sample: [
      { mes: "2026-04", flag: "MONO_CANAL", n_cuentas: 298 },
      { mes: "2026-04", flag: "CUENTA_INACTIVA_+2M", n_cuentas: 187 },
    ],
  },
  {
    name: "health_cuentas",
    schemaKey: "health_score.cuentas_activas",
    description: "Cuentas activas con scoring detallado. Una fila por cuenta y mes.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "id_cuenta", tipo: "string", obligatorio: true, ejemplo: "917", descripcion: "ID único" },
      { campo: "nombre", tipo: "string", obligatorio: true, ejemplo: "Hasta la masa", descripcion: "" },
      { campo: "pais", tipo: "string", obligatorio: true, ejemplo: "AR", descripcion: "Código país" },
      { campo: "plan", tipo: "string", obligatorio: true, ejemplo: "Fu+Fi+Dv", descripcion: "" },
      { campo: "health_score", tipo: "number", obligatorio: true, ejemplo: "97.4", descripcion: "0-100" },
      { campo: "tier", tipo: "enum", obligatorio: true, ejemplo: "Champion", descripcion: "Champion | Healthy | At Risk | Critical" },
      { campo: "tendencia", tipo: "string", obligatorio: false, ejemplo: "Creciendo", descripcion: "Texto libre" },
      { campo: "tendencia_dir", tipo: "enum", obligatorio: true, ejemplo: "up", descripcion: "up | stable | down" },
      { campo: "risk_flags", tipo: "string[]", obligatorio: false, ejemplo: "MONO_CANAL|ADOPCION_BAJA", descripcion: "Flags separadas por | o ·" },
      { campo: "nps_ltr", tipo: "number", obligatorio: false, ejemplo: "9", descripcion: "Último LTR (0-10)" },
      { campo: "prio_cs", tipo: "number", obligatorio: true, ejemplo: "10", descripcion: "Prioridad CS 0-100" },
    ],
    sample: [
      { mes: "2026-04", id_cuenta: "917", nombre: "Hasta la masa", pais: "AR", plan: "Fu+Fi+Dv", health_score: 97.4, tier: "Champion", tendencia: "Creciendo", tendencia_dir: "up", risk_flags: "", nps_ltr: "", prio_cs: 10 },
    ],
  },
  {
    name: "cola_cs",
    schemaKey: "cola_cs",
    description: "Cola de trabajo CS del mes. Si esta hoja viene vacía, la app la deriva automáticamente desde health_cuentas (prio_cs ≥ 35).",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "id_cuenta", tipo: "string", obligatorio: true, ejemplo: "5247", descripcion: "" },
      { campo: "nombre", tipo: "string", obligatorio: true, ejemplo: "Bufetera", descripcion: "" },
      { campo: "pais", tipo: "string", obligatorio: true, ejemplo: "MX", descripcion: "" },
      { campo: "plan", tipo: "string", obligatorio: true, ejemplo: "St+Fi+Dv", descripcion: "" },
      { campo: "tier", tipo: "enum", obligatorio: true, ejemplo: "Healthy", descripcion: "Champion | Healthy | At Risk | Critical" },
      { campo: "tendencia", tipo: "string", obligatorio: false, ejemplo: "Estable", descripcion: "" },
      { campo: "risk_flags", tipo: "string[]", obligatorio: false, ejemplo: "CUENTA_INACTIVA_+2M|NPS_DETRACTOR", descripcion: "" },
      { campo: "prio_cs", tipo: "number", obligatorio: true, ejemplo: "46", descripcion: "" },
      { campo: "contactada_hoy", tipo: "boolean", obligatorio: false, ejemplo: "FALSE", descripcion: "" },
      { campo: "es_critica", tipo: "boolean", obligatorio: false, ejemplo: "FALSE", descripcion: "Marca visual" },
    ],
    sample: [],
  },
  {
    name: "kpis",
    schemaKey: "kpis_iniciativas.kpis",
    description: "KPIs del mes con baseline y targets.",
    fields: [
      { campo: "mes", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "YYYY-MM" },
      { campo: "nombre", tipo: "string", obligatorio: true, ejemplo: "Tasa de Churn Mensual", descripcion: "" },
      { campo: "valor_actual", tipo: "number", obligatorio: true, ejemplo: "1446", descripcion: "" },
      { campo: "unidad", tipo: "string", obligatorio: true, ejemplo: "cuentas", descripcion: "% | score | cuentas" },
      { campo: "estado", tipo: "enum", obligatorio: true, ejemplo: "ROJO", descripcion: "ROJO | VIGILAR | ESTABLE | VERDE" },
      { campo: "baseline", tipo: "number", obligatorio: true, ejemplo: "1273", descripcion: "" },
      { campo: "target_3m", tipo: "number", obligatorio: true, ejemplo: "1100", descripcion: "" },
      { campo: "target_6m", tipo: "number", obligatorio: true, ejemplo: "900", descripcion: "" },
      { campo: "direccion_deseada", tipo: "enum", obligatorio: true, ejemplo: "bajar", descripcion: "subir | bajar" },
    ],
    sample: [{ mes: "2026-04", nombre: "Tasa de Churn Mensual", valor_actual: 1446, unidad: "cuentas", estado: "ROJO", baseline: 1273, target_3m: 1100, target_6m: 900, direccion_deseada: "bajar" }],
  },
  {
    name: "iniciativas",
    schemaKey: "kpis_iniciativas.iniciativas",
    description: "Iniciativas estratégicas. Cada iniciativa se mantiene visible mientras `mes_creacion <= mes activo`. Actualizá `mes_actualizacion` cuando cambies el estado.",
    fields: [
      { campo: "numero", tipo: "number", obligatorio: true, ejemplo: "1", descripcion: "ID" },
      { campo: "area", tipo: "string", obligatorio: true, ejemplo: "Product + CS", descripcion: "Owner / área" },
      { campo: "titulo", tipo: "string", obligatorio: true, ejemplo: "Plan de pausa de suscripción", descripcion: "" },
      { campo: "descripcion", tipo: "string", obligatorio: false, ejemplo: "Implementar opción de pausa...", descripcion: "" },
      { campo: "prioridad", tipo: "enum", obligatorio: true, ejemplo: "ALTA", descripcion: "ALTA | MEDIA | BAJA" },
      { campo: "estado", tipo: "enum", obligatorio: true, ejemplo: "planificado", descripcion: "planificado | en curso | completado" },
      { campo: "timeline_semanas", tipo: "string", obligatorio: false, ejemplo: "2-4 semanas", descripcion: "" },
      { campo: "impacto_esperado", tipo: "string", obligatorio: false, ejemplo: "Retención 137-200 cuentas/mes", descripcion: "" },
      { campo: "mes_creacion", tipo: "string", obligatorio: true, ejemplo: "2026-04", descripcion: "Mes en que se levantó la iniciativa" },
      { campo: "mes_actualizacion", tipo: "string", obligatorio: true, ejemplo: "2026-05", descripcion: "Última actualización de estado" },
    ],
    sample: [{ numero: 1, area: "Product + CS", titulo: "Plan de pausa", descripcion: "Opción de pausa 30-60 días", prioridad: "ALTA", estado: "planificado", timeline_semanas: "2-4 semanas", impacto_esperado: "Retención 137-200 cuentas/mes", mes_creacion: "2026-04", mes_actualizacion: "2026-04" }],
  },
];

function buildInstructionsSheet(): XLSX.WorkSheet {
  const rows: Array<Record<string, unknown>> = [];
  SHEETS.forEach((s) => {
    rows.push({
      HOJA: s.name,
      CAMPO: "— DESCRIPCIÓN DE LA HOJA —",
      TIPO: "",
      "OBLIGATORIO (S/N)": "",
      EJEMPLO: "",
      DESCRIPCIÓN: s.description,
    });
    s.fields.forEach((f) => {
      rows.push({
        HOJA: s.name,
        CAMPO: f.campo,
        TIPO: f.tipo,
        "OBLIGATORIO (S/N)": f.obligatorio ? "S" : "N",
        EJEMPLO: f.ejemplo,
        DESCRIPCIÓN: f.descripcion,
      });
    });
    rows.push({ HOJA: "", CAMPO: "", TIPO: "", "OBLIGATORIO (S/N)": "", EJEMPLO: "", DESCRIPCIÓN: "" });
  });
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["HOJA", "CAMPO", "TIPO", "OBLIGATORIO (S/N)", "EJEMPLO", "DESCRIPCIÓN"],
  });
  ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 70 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as XLSX.WorkSheet["!freeze"];
  return ws;
}


function buildDataSheet(s: SheetSpec): XLSX.WorkSheet {
  const headers = s.fields.map((f) => f.campo);
  const rows = s.sample.length ? s.sample : [Object.fromEntries(headers.map((h) => [h, ""]))];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws["!cols"] = headers.map((h) => ({ wch: Math.min(28, Math.max(12, h.length + 4)) }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as XLSX.WorkSheet["!freeze"];
  return ws;
}

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), "INSTRUCCIONES");
  SHEETS.forEach((s) => XLSX.utils.book_append_sheet(wb, buildDataSheet(s), s.name));
  return wb;
}

export function downloadTemplate(filename = "fudo-churn-center-plantilla.xlsx") {
  const wb = buildTemplateWorkbook();
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
}

export const TEMPLATE_SHEETS = SHEETS;
