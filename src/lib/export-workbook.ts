import ExcelJS from "exceljs";
import {
  churnTrend,
  churnByMotivo,
  motivosBaja,
  npsPais,
  npsPorGmv,
  npsPorAntiguedad,
  motivosDetraccion,
  motivosPromocion,
  desgloseCosto,
  csatMensual,
  takeRateBuckets,
  cvrNeto,
  tierDist,
  riskFlagDist,
  featureGaps,
  healthAccounts,
  verbatims,
  kpiTargets,
  iniciativas,
} from "@/data/mockData";

// ----- Colores institucionales -----
const ORANGE = "FFF05A28";
const ORANGE_DEEP = "FFC9421A";
const ORANGE_SOFT = "FFFFEEE6";
const INK = "FF0B0B0A";
const INK_3 = "FF6E6D66";
const PAPER = "FFFAFAF7";
const PAPER_2 = "FFF2F0E9";
const RULE = "FFE8E6DC";
const WHITE = "FFFFFFFF";

type Col = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
};

type Section = {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: Col[];
  rows: Record<string, unknown>[];
};

// ---------- Snapshots desde localStorage ----------
function loadSnapshotRows(): Record<string, unknown>[] {
  if (typeof window === "undefined") return [];
  try {
    const store = JSON.parse(localStorage.getItem("customer_monthly_snapshot") ?? "{}");
    const out: Record<string, unknown>[] = [];
    Object.values(store).forEach((snap: any) => {
      (snap.rows ?? []).forEach((r: any) => {
        out.push({
          month: snap.month,
          company_id: r.company_id,
          customer_name: r.customer_name,
          country: r.country,
          segment: r.segment,
          owner: r.owner,
          plan: r.plan,
          mrr: r.mrr,
          status: r.status,
          churn_date: r.churn_date ?? "",
        });
      });
    });
    return out;
  } catch {
    return [];
  }
}

// ---------- Definición de secciones ----------
function buildSections(): Section[] {
  const sections: Section[] = [
    {
      sheetName: "Tendencia churn",
      title: "Tendencia mensual de bajas",
      subtitle: "5 meses cerrados + 2 proyectados",
      columns: [
        { header: "Mes", key: "mes", width: 14 },
        { header: "Bajas", key: "bajas", width: 12, numFmt: "#,##0", align: "right" },
        { header: "% con motivo", key: "pctMotivo", width: 16, numFmt: '0.0"%";-;-', align: "right" },
        { header: "Proyectado", key: "proyectado", width: 14, align: "center" },
      ],
      rows: churnTrend.map((r) => ({ ...r, proyectado: r.proyectado ? "Sí" : "No" })),
    },
    {
      sheetName: "Churn por motivo (mes)",
      title: "Churn por motivo · desglose mensual",
      columns: [
        { header: "Mes", key: "mes", width: 10 },
        { header: "Total", key: "total", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Definitivo", key: "definitivo", width: 14, numFmt: "#,##0", align: "right" },
        { header: "Temporal", key: "temporal", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Sin resp.", key: "sinResp", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Dejó usar", key: "dejoUsar", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Eligió otro", key: "eligioOtro", width: 14, numFmt: "#,##0", align: "right" },
        { header: "Precio", key: "precio", width: 10, numFmt: "#,##0", align: "right" },
        { header: "Falta func.", key: "faltaFunc", width: 14, numFmt: "#,##0", align: "right" },
        { header: "Mal servicio", key: "malServ", width: 14, numFmt: "#,##0", align: "right" },
      ],
      rows: churnByMotivo as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Motivos de baja",
      title: "Distribución de motivos de baja",
      columns: [
        { header: "Motivo", key: "motivo", width: 30 },
        { header: "Casos", key: "n", width: 12, numFmt: "#,##0", align: "right" },
        { header: "%", key: "pct", width: 10, numFmt: '0.0"%"', align: "right" },
        { header: "Prioridad", key: "prioridad", width: 14 },
        { header: "Accionable", key: "accionable", width: 14 },
        { header: "Brecha", key: "brecha", width: 10, align: "center" },
      ],
      rows: motivosBaja.map((r) => ({ ...r, brecha: r.brecha ? "Sí" : "No" })),
    },
    {
      sheetName: "NPS por país",
      title: "NPS por país",
      subtitle: "6.915 respuestas · LATAM · Q1+Q2 2026",
      columns: [
        { header: "País", key: "pais", width: 16 },
        { header: "NPS", key: "nps", width: 10, numFmt: "0.00", align: "right" },
        { header: "Respuestas", key: "n", width: 14, numFmt: "#,##0", align: "right" },
        { header: "% Promotores", key: "promotores", width: 16, numFmt: '0.0"%"', align: "right" },
        { header: "% Detractores", key: "detractores", width: 16, numFmt: '0.0"%"', align: "right" },
        { header: "Cuentas", key: "cuentas", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Alerta", key: "alerta", width: 10, align: "center" },
      ],
      rows: npsPais.map((r) => ({ ...r, alerta: r.alerta ? "⚠" : "" })),
    },
    {
      sheetName: "NPS por GMV",
      title: "NPS por segmento de GMV",
      columns: [
        { header: "Grupo", key: "grupo", width: 22 },
        { header: "Respuestas", key: "n", width: 14, numFmt: "#,##0", align: "right" },
        { header: "NPS", key: "nps", width: 10, numFmt: "0.00", align: "right" },
        { header: "% Detractores", key: "detractores", width: 16, numFmt: '0.0"%"', align: "right" },
      ],
      rows: npsPorGmv as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "NPS por antigüedad",
      title: "NPS por antigüedad",
      columns: [
        { header: "Rango", key: "rango", width: 24 },
        { header: "Respuestas", key: "n", width: 14, numFmt: "#,##0", align: "right" },
        { header: "NPS", key: "nps", width: 10, numFmt: "0.00", align: "right" },
        { header: "% Promotores", key: "promotores", width: 16, numFmt: '0.0"%"', align: "right" },
        { header: "% Detractores", key: "detractores", width: 16, numFmt: '0.0"%"', align: "right" },
      ],
      rows: npsPorAntiguedad as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Motivos detracción",
      title: "Motivos de detracción",
      columns: [
        { header: "Motivo", key: "motivo", width: 34 },
        { header: "Casos", key: "n", width: 12, numFmt: "#,##0", align: "right" },
        { header: "%", key: "pct", width: 10, numFmt: '0.0"%"', align: "right" },
      ],
      rows: motivosDetraccion as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Motivos promoción",
      title: "Motivos de promoción",
      columns: [
        { header: "Motivo", key: "motivo", width: 34 },
        { header: "Casos", key: "n", width: 12, numFmt: "#,##0", align: "right" },
        { header: "%", key: "pct", width: 10, numFmt: '0.0"%"', align: "right" },
      ],
      rows: motivosPromocion as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Desglose costo",
      title: "Detracción por costo · desglose",
      columns: [
        { header: "Submotivo", key: "submotivo", width: 34 },
        { header: "Casos", key: "n", width: 12, numFmt: "#,##0", align: "right" },
      ],
      rows: desgloseCosto as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "CSAT mensual",
      title: "CSAT mensual",
      columns: [
        { header: "Mes", key: "mes", width: 10 },
        { header: "Conversaciones", key: "conversaciones", width: 18, numFmt: "#,##0", align: "right" },
        { header: "Churn del mes", key: "churnMes", width: 16, numFmt: "#,##0", align: "right" },
        { header: "Rating 4", key: "rating4", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Rating 5", key: "rating5", width: 12, numFmt: "#,##0", align: "right" },
        { header: "Promedio", key: "avg", width: 12, numFmt: "0.00", align: "right" },
      ],
      rows: csatMensual as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Take rate buckets",
      title: "Take rate · NPS y detracción por costo",
      columns: [
        { header: "Bucket", key: "bucket", width: 16 },
        { header: "Rango", key: "rango", width: 20 },
        { header: "NPS", key: "nps", width: 10, numFmt: "0.0", align: "right" },
        { header: "% Detracción costo", key: "detracCosto", width: 20, numFmt: '0.0"%"', align: "right" },
      ],
      rows: takeRateBuckets as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "CVR neto",
      title: "CVR neto de bajas",
      columns: [
        { header: "Mes", key: "mes", width: 10 },
        { header: "CVR", key: "cvr", width: 12, numFmt: '0.0"%"', align: "right" },
      ],
      rows: cvrNeto as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Health · tiers",
      title: "Distribución de tiers de Health Score",
      columns: [
        { header: "Tier", key: "tier", width: 14 },
        { header: "Cuentas", key: "count", width: 12, numFmt: "#,##0", align: "right" },
        { header: "%", key: "pct", width: 10, numFmt: '0.0"%"', align: "right" },
      ],
      rows: tierDist as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Health · flags",
      title: "Distribución de flags de riesgo",
      columns: [
        { header: "Flag", key: "flag", width: 28 },
        { header: "Cuentas", key: "count", width: 12, numFmt: "#,##0", align: "right" },
      ],
      rows: riskFlagDist as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Feature gaps",
      title: "Brechas de adopción",
      columns: [
        { header: "Gap", key: "gap", width: 24 },
        { header: "Descripción", key: "label", width: 30 },
        { header: "Cuentas", key: "cuentas", width: 12, numFmt: "#,##0", align: "right" },
      ],
      rows: featureGaps as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Cuentas · Health",
      title: "Cuentas activas con scoring",
      subtitle: `${healthAccounts.length} cuentas · scoring 0-100`,
      columns: [
        { header: "ID", key: "id", width: 10, align: "right" },
        { header: "Nombre", key: "nombre", width: 30 },
        { header: "País", key: "pais", width: 8, align: "center" },
        { header: "Plan", key: "plan", width: 14 },
        { header: "Score", key: "score", width: 10, numFmt: "0.0", align: "right" },
        { header: "Tier", key: "tier", width: 12 },
        { header: "Tendencia", key: "tendencia", width: 22 },
        { header: "Flags", key: "flags", width: 50 },
        { header: "NPS LTR", key: "npsLtr", width: 10, align: "right" },
        { header: "NPS Grupo", key: "npsGrupo", width: 14 },
        { header: "Prio CS", key: "csPrio", width: 10, numFmt: "0", align: "right" },
      ],
      rows: healthAccounts.map((r) => ({
        ...r,
        flags: r.flags.join(" · "),
        npsLtr: r.npsLtr ?? "",
      })),
    },
    {
      sheetName: "Cola CS",
      title: "Cola de trabajo · priorización por urgencia",
      columns: [
        { header: "Prio", key: "csPrio", width: 8, numFmt: "0", align: "right" },
        { header: "ID", key: "id", width: 10, align: "right" },
        { header: "Cuenta", key: "nombre", width: 30 },
        { header: "País", key: "pais", width: 8, align: "center" },
        { header: "Tier", key: "tier", width: 12 },
        { header: "Score", key: "score", width: 10, numFmt: "0.0", align: "right" },
        { header: "Tendencia", key: "tendencia", width: 22 },
        { header: "Flags", key: "flags", width: 50 },
      ],
      rows: [...healthAccounts]
        .sort((a, b) => b.csPrio - a.csPrio)
        .map((r) => ({ ...r, flags: r.flags.join(" · ") })),
    },
    {
      sheetName: "Verbatims NPS",
      title: "Verbatims destacados",
      columns: [
        { header: "LTR", key: "ltr", width: 8, align: "right" },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "País", key: "pais", width: 14 },
        { header: "Plan", key: "plan", width: 12 },
        { header: "Submotivo", key: "submotivo", width: 26 },
        { header: "Comentario", key: "texto", width: 80 },
      ],
      rows: verbatims.map((r) => ({ ...r, submotivo: r.submotivo ?? "—" })),
    },
    {
      sheetName: "KPIs",
      title: "KPIs · targets 3 y 6 meses",
      columns: [
        { header: "KPI", key: "kpi", width: 30 },
        { header: "Baseline", key: "baseline", width: 18 },
        { header: "Target 3m", key: "target3m", width: 14 },
        { header: "Target 6m", key: "target6m", width: 14 },
        { header: "Actual", key: "current", width: 14 },
        { header: "Estado", key: "status", width: 12 },
      ],
      rows: kpiTargets as unknown as Record<string, unknown>[],
    },
    {
      sheetName: "Iniciativas",
      title: "Roadmap de retención",
      columns: [
        { header: "#", key: "id", width: 6, align: "right" },
        { header: "Título", key: "titulo", width: 38 },
        { header: "Prioridad", key: "prioridad", width: 14 },
        { header: "Owner", key: "owner", width: 22 },
        { header: "Timeline", key: "timeline", width: 16 },
        { header: "Impacto", key: "impacto", width: 38 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Descripción", key: "descripcion", width: 70 },
      ],
      rows: iniciativas as unknown as Record<string, unknown>[],
    },
  ];

  const snapRows = loadSnapshotRows();
  if (snapRows.length > 0) {
    sections.push({
      sheetName: "Snapshots mensuales",
      title: "Snapshots mensuales · cliente por cliente",
      subtitle: `${snapRows.length} filas guardadas localmente`,
      columns: [
        { header: "Mes", key: "month", width: 12 },
        { header: "Company ID", key: "company_id", width: 14 },
        { header: "Cliente", key: "customer_name", width: 30 },
        { header: "País", key: "country", width: 10, align: "center" },
        { header: "Segmento", key: "segment", width: 14 },
        { header: "Owner", key: "owner", width: 18 },
        { header: "Plan", key: "plan", width: 14 },
        { header: "MRR", key: "mrr", width: 12, numFmt: '"$"#,##0.00', align: "right" },
        { header: "Status", key: "status", width: 12 },
        { header: "Churn date", key: "churn_date", width: 14 },
      ],
      rows: snapRows,
    });
  }

  return sections;
}

// ---------- Estilos compartidos ----------
function styleTitleRow(ws: ExcelJS.Worksheet, row: number, text: string, cols: number) {
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: "Inter", size: 16, bold: true, color: { argb: INK } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(row).height = 28;
  ws.mergeCells(row, 1, row, cols);
}

function styleSubtitleRow(ws: ExcelJS.Worksheet, row: number, text: string, cols: number) {
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: "Inter", size: 11, italic: true, color: { argb: INK_3 } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(row).height = 18;
  ws.mergeCells(row, 1, row, cols);
}

function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  r.height = 26;
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { name: "Inter", size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: ORANGE_DEEP } },
      bottom: { style: "thin", color: { argb: ORANGE_DEEP } },
      left: { style: "thin", color: { argb: ORANGE_DEEP } },
      right: { style: "thin", color: { argb: ORANGE_DEEP } },
    };
  }
}

function styleDataRows(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  cols: Col[],
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    const banded = (r - startRow) % 2 === 1;
    cols.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      cell.font = { name: "Inter", size: 10.5, color: { argb: INK } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? "left",
        wrapText: true,
      };
      if (col.numFmt) cell.numFmt = col.numFmt;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: banded ? PAPER_2 : WHITE },
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: RULE } },
      };
    });
  }
}

// ---------- Cover sheet ----------
function buildCoverSheet(wb: ExcelJS.Workbook, sections: Section[]) {
  const ws = wb.addWorksheet("Índice", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: ORANGE } },
  });

  ws.columns = [
    { width: 6 },
    { width: 40 },
    { width: 60 },
    { width: 14 },
  ];

  // Banner orange band
  ws.mergeCells("A1:D1");
  const banner = ws.getCell("A1");
  banner.value = "";
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  ws.getRow(1).height = 6;

  // Title
  ws.mergeCells("A3:D3");
  const title = ws.getCell("A3");
  title.value = "Fudo Churn Center";
  title.font = { name: "Inter", size: 28, bold: true, color: { argb: INK } };
  ws.getRow(3).height = 38;

  ws.mergeCells("A4:D4");
  const sub = ws.getCell("A4");
  sub.value = "Export consolidado · análisis Dic 2025 – May 2026";
  sub.font = { name: "Inter", size: 12, italic: true, color: { argb: INK_3 } };
  ws.getRow(4).height = 22;

  ws.mergeCells("A5:D5");
  const stamp = ws.getCell("A5");
  const now = new Date();
  stamp.value = `Generado el ${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  stamp.font = { name: "Inter", size: 10, color: { argb: INK_3 } };

  // Section index header
  const headerRow = 8;
  ws.mergeCells(`A${headerRow}:D${headerRow}`);
  const idxTitle = ws.getCell(`A${headerRow}`);
  idxTitle.value = "Contenido del archivo";
  idxTitle.font = { name: "Inter", size: 14, bold: true, color: { argb: ORANGE_DEEP } };
  ws.getRow(headerRow).height = 24;

  const tableHeader = headerRow + 2;
  const headers = ["#", "Pestaña", "Descripción", "Filas"];
  headers.forEach((h, i) => {
    const c = ws.getCell(tableHeader, i + 1);
    c.value = h;
    c.font = { name: "Inter", size: 10, bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    c.alignment = { vertical: "middle", horizontal: i === 0 || i === 3 ? "center" : "left" };
  });
  ws.getRow(tableHeader).height = 22;

  sections.forEach((s, i) => {
    const r = tableHeader + 1 + i;
    const banded = i % 2 === 1;
    const cells = [
      { v: i + 1, align: "center" as const },
      { v: s.sheetName, align: "left" as const, link: true },
      { v: s.title + (s.subtitle ? ` — ${s.subtitle}` : ""), align: "left" as const },
      { v: s.rows.length, align: "center" as const },
    ];
    cells.forEach((cell, idx) => {
      const c = ws.getCell(r, idx + 1);
      c.value = cell.v;
      c.font = { name: "Inter", size: 10.5, color: { argb: idx === 1 ? ORANGE_DEEP : INK } };
      c.alignment = { vertical: "middle", horizontal: cell.align };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: banded ? ORANGE_SOFT : PAPER },
      };
      c.border = { bottom: { style: "hair", color: { argb: RULE } } };
      if (cell.link) {
        c.value = {
          text: s.sheetName,
          hyperlink: `#'${s.sheetName.slice(0, 31)}'!A1`,
        };
        c.font = { name: "Inter", size: 10.5, bold: true, color: { argb: ORANGE_DEEP }, underline: true };
      }
    });
    ws.getRow(r).height = 20;
  });
}

// ---------- Section sheet ----------
function buildSectionSheet(wb: ExcelJS.Workbook, section: Section) {
  const safeName = section.sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  const ws = wb.addWorksheet(safeName, {
    views: [{ showGridLines: false, state: "frozen", ySplit: section.subtitle ? 4 : 3 }],
  });

  const cols = section.columns;
  ws.columns = cols.map((c) => ({ width: c.width ?? 16 }));

  styleTitleRow(ws, 1, section.title, cols.length);
  let headerRow = 2;
  if (section.subtitle) {
    styleSubtitleRow(ws, 2, section.subtitle, cols.length);
    headerRow = 3;
  }
  // Spacer row left intentionally blank between subtitle and header
  const realHeader = headerRow + 1;
  cols.forEach((c, idx) => ws.getCell(realHeader, idx + 1).value = c.header);
  styleHeaderRow(ws, realHeader, cols.length);

  const dataStart = realHeader + 1;
  section.rows.forEach((row, i) => {
    cols.forEach((c, idx) => {
      const v = row[c.key];
      ws.getCell(dataStart + i, idx + 1).value = v === null || v === undefined ? "" : (v as any);
    });
  });

  styleDataRows(ws, dataStart, dataStart + section.rows.length - 1, cols);

  // Autofilter on header
  const lastCol = String.fromCharCode(64 + cols.length);
  ws.autoFilter = `A${realHeader}:${lastCol}${realHeader}`;

  // Update freeze pane to keep title + header visible
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: realHeader }];

  // Tab color
  ws.properties.tabColor = { argb: ORANGE_SOFT };
}

// ---------- Public API ----------
export async function exportFullWorkbook(filename = "fudo-churn-center.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Fudo Churn Center";
  wb.created = new Date();

  const sections = buildSections();
  buildCoverSheet(wb, sections);
  sections.forEach((s) => buildSectionSheet(wb, s));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
