import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

// Mapeo: header del Excel -> columna en tabla `clientes`
const COLUMN_MAP: Record<string, string> = {
  "ID Cuenta (dash)": "id_cuenta_dash",
  "ID HubSpot": "id_hubspot",
  "Nombre": "nombre",
  "País": "pais",
  "Ejecutivo": "ejecutivo",
  "Propietario HubSpot": "propietario_hubspot",
  "Etapa": "etapa",
  "GMV": "gmv",
  "Plan": "plan",
  "Fecha de Baja": "fecha_baja",
  "Motivo de Baja": "motivo_baja",
  "Sub-motivo de Baja": "submotivo_baja",
  "Estado en Dash": "estado_dash",
  "Motivo Metabase": "motivo_metabase",
  "Comentarios Metabase": "comentarios_metabase",
  "NPS Período": "nps_periodo",
  "NPS Score (LTR)": "nps_score",
  "NPS Categoría": "nps_categoria",
  "NPS Motivo": "nps_motivo",
  "NPS Submotivo": "nps_submotivo",
  "Cant. Contactos": "cant_contactos",
  "Meses con contacto": "meses_con_contacto",
  "Primera fecha contacto": "primera_fecha_contacto",
  "Última fecha contacto": "ultima_fecha_contacto",
  "Temas contacto": "temas_contacto",
  "Motivos contacto": "motivos_contacto",
  "CSAT ONB (promedio gral)": "csat_onb_promedio",
  "CSAT ONB (N respuestas)": "csat_onb_n",
  "CSAT CS+Soporte (promedio gral)": "csat_cs_promedio",
  "CSAT CS+Soporte (N respuestas)": "csat_cs_n",
  "CSAT Período Cubierto": "csat_periodo",
  "Mesas": "mesas",
  "Salas": "salas",
  "Productos": "productos",
  "Cat. Productos": "cat_productos",
  "Pr. con stock": "pr_con_stock",
  "Pr. con costo": "pr_con_costo",
  "Ingredientes": "ingredientes",
  "Cat. Ingredientes": "cat_ingredientes",
  "Ing. con stock": "ing_con_stock",
  "Ing. con costo": "ing_con_costo",
  "Ing. en recetas": "ing_en_recetas",
  "Sub-ing. en recetas": "sub_ing_en_recetas",
  "Usuarios": "usuarios",
  "V Salon": "v_salon",
  "V Delivery": "v_delivery",
  "V Mostrador": "v_mostrador",
  "V Menu Online": "v_menu_online",
  "V PedidosYa": "v_pedidosya",
  "V UberEats": "v_ubereats",
  "V Rappi": "v_rappi",
  "V Justo": "v_justo",
  "V iFood": "v_ifood",
  "V DiDi": "v_didi",
  "Ad. PC": "ad_pc",
  "Ad. Tablet": "ad_tablet",
  "Ad. Lista Precio": "ad_lista_precio",
  "Ad. Combo": "ad_combo",
  "Arqueos": "arqueos",
  "Propinas": "propinas",
  "Movimientos Caja": "movimientos_caja",
  "Gastos": "gastos",
  "Fiscal": "fiscal",
  "Menu Online Habilitado": "menu_online_habilitado",
  "Carta QR Habilitado": "carta_qr_habilitado",
  "Zonas Delivery": "zonas_delivery",
  "Descuentos": "descuentos",
  "Ventas con clientes": "ventas_con_clientes",
  "Ventas pagadas MP": "ventas_pagadas_mp",
  "Cantidad Proveedores": "cantidad_proveedores",
  "Cantidad Clientes": "cantidad_clientes",
  "Cantidad Cajas": "cantidad_cajas",
  "Cantidad Turnos": "cantidad_turnos",
  "Ventas Deli con repartidor": "ventas_deli_con_repartidor",
  "Cat. Gastos Financiera": "cat_gastos_financiera",
  "Cat. Gastos": "cat_gastos",
  "Sub-cat. Gastos": "sub_cat_gastos",
};

const NUMERIC_COLS = new Set([
  "id_cuenta_dash", "gmv", "nps_score", "cant_contactos",
  "csat_onb_promedio", "csat_onb_n", "csat_cs_promedio", "csat_cs_n",
  "mesas", "salas", "productos", "cat_productos", "pr_con_stock", "pr_con_costo",
  "ingredientes", "cat_ingredientes", "ing_con_stock", "ing_con_costo",
  "ing_en_recetas", "sub_ing_en_recetas", "usuarios",
  "v_salon", "v_delivery", "v_mostrador", "v_menu_online", "v_pedidosya",
  "v_ubereats", "v_rappi", "v_justo", "v_ifood", "v_didi",
  "ad_pc", "ad_tablet", "ad_lista_precio", "ad_combo",
  "arqueos", "propinas", "movimientos_caja", "gastos", "fiscal",
  "menu_online_habilitado", "carta_qr_habilitado", "zonas_delivery",
  "descuentos", "ventas_con_clientes", "ventas_pagadas_mp",
  "cantidad_proveedores", "cantidad_clientes", "cantidad_cajas", "cantidad_turnos",
  "ventas_deli_con_repartidor", "cat_gastos_financiera", "cat_gastos", "sub_cat_gastos",
]);

const DATE_COLS = new Set(["fecha_baja", "primera_fecha_contacto", "ultima_fecha_contacto"]);

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const year = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy);
    const dt = new Date(year, Number(mm) - 1, Number(dd));
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  // Detect format: "1.234,56" (es) vs "1,234.56" (en) vs "4.78" (en) vs "4,78" (es)
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // last separator is decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // comma alone → decimal
    s = s.replace(",", ".");
  }
  // dot alone → leave as decimal separator (do NOT strip)
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type ImportProgress = {
  phase: "reading" | "uploading" | "done" | "error";
  totalRows: number;
  uploadedRows: number;
  message?: string;
};

export async function parseClientesSheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("base general")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`No se encontró la hoja "Base general" en el archivo.`);

  // range from row 3 (index 2): row 3 has headers, row 4+ data
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    range: 2,
    defval: null,
    raw: true,
  });

  return rows;
}

export function mapRowsToClientes(
  rows: Record<string, unknown>[],
  mesExportacion: string
): Record<string, unknown>[] {
  // Build header -> dbCol resolver tolerant to extra whitespace
  const normalizedMap = new Map<string, string>();
  for (const [k, v] of Object.entries(COLUMN_MAP)) {
    normalizedMap.set(k.trim().toLowerCase(), v);
  }

  const mapped: Record<string, unknown>[] = [];
  for (const row of rows) {
    const out: Record<string, unknown> = { mes_exportacion: mesExportacion };
    let hasAny = false;
    for (const [header, raw] of Object.entries(row)) {
      const dbCol = normalizedMap.get(String(header).trim().toLowerCase());
      if (!dbCol) continue;
      let value: unknown = raw;
      if (DATE_COLS.has(dbCol)) value = excelDateToISO(raw);
      else if (NUMERIC_COLS.has(dbCol)) value = toNumber(raw);
      else if (typeof raw === "string") value = raw.trim() || null;
      if (value !== null && value !== undefined && value !== "") hasAny = true;
      out[dbCol] = value;
    }
    // Skip totally empty rows or rows without id_cuenta_dash (upsert key requires it)
    if (!hasAny) continue;
    if (out.id_cuenta_dash == null) continue;
    mapped.push(out);
  }
  return mapped;
}

export async function upsertClientesInBatches(
  rows: Record<string, unknown>[],
  onProgress: (uploaded: number, total: number) => void,
  batchSize = 500
): Promise<void> {
  // Deduplicate by (id_cuenta_dash, mes_exportacion) — keep the LAST occurrence.
  // Postgres rejects ON CONFLICT when the same conflict key appears twice in one statement.
  const dedupMap = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = `${row.id_cuenta_dash}__${row.mes_exportacion}`;
    dedupMap.set(key, row);
  }
  const deduped = Array.from(dedupMap.values());

  const total = deduped.length;
  for (let i = 0; i < total; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    const { error } = await supabase
      .from("clientes")
      .upsert(batch as never, { onConflict: "id_cuenta_dash,mes_exportacion" });
    if (error) {
      throw new Error(`Error en lote ${i / batchSize + 1}: ${error.message}`);
    }
    onProgress(Math.min(i + batch.length, total), total);
  }
}

