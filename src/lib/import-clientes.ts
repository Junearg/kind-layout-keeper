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

function normalizeText(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .normalize("NFKC")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeaderKey(v: unknown): string {
  return normalizeText(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR");
}

function firstColumnValue(row: Record<string, unknown>): unknown {
  return Object.values(row)[0] ?? null;
}

function normalizeEstadoDash(v: unknown): string | null {
  const s = normalizeText(v);
  if (!s) return null;
  const lower = s.toLocaleLowerCase("es-AR");
  if (lower === "activo") return "Activo";
  if (lower === "bloqueado") return "Bloqueado";
  return s;
}

function estadoPriority(v: unknown): number {
  const s = normalizeEstadoDash(v);
  if (s === "Activo") return 2;
  if (s === "Bloqueado") return 1;
  return 0;
}

export type ImportProgress = {
  phase: "reading" | "uploading" | "done" | "error";
  totalRows: number;
  uploadedRows: number;
  message?: string;
};

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // arrayBuffer() falla con NotReadableError en archivos grandes si el handle expiró.
  // FileReader suele funcionar como fallback.
  try {
    return await file.arrayBuffer();
  } catch (e) {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? e);
      reader.readAsArrayBuffer(file);
    });
  }
}

export async function parseClientesSheet(file: File | ArrayBuffer): Promise<Record<string, unknown>[]> {
  const buf = file instanceof ArrayBuffer ? file : await readFileAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("base general")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`No se encontró la hoja "Base general" en el archivo.`);

  // range from row 2 (index 1): row 1 = "DATOS CHURN BASE", row 2 = headers, row 3+ = data
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    range: 1,
    defval: null,
    raw: true,
  });


  return rows;
}



export function mapRowsToClientes(
  rows: Record<string, unknown>[],
  mesExportacion: string
): Record<string, unknown>[] {
  // Build header -> dbCol resolver tolerant to whitespace/accents and force column A as ID Cuenta (dash).
  const normalizedMap = new Map<string, string>();
  for (const [k, v] of Object.entries(COLUMN_MAP)) {
    normalizedMap.set(normalizeHeaderKey(k), v);
  }
  normalizedMap.set("id cuenta dash", "id_cuenta_dash");
  normalizedMap.set("id cuenta (dash)", "id_cuenta_dash");

  const mapped: Record<string, unknown>[] = [];
  for (const row of rows) {
    const out: Record<string, unknown> = { mes_exportacion: mesExportacion };
    let hasAny = false;
    for (const [header, raw] of Object.entries(row)) {
      const dbCol = normalizedMap.get(normalizeHeaderKey(header));
      if (!dbCol) continue;
      let value: unknown = raw;
      if (DATE_COLS.has(dbCol)) value = excelDateToISO(raw);
      else if (NUMERIC_COLS.has(dbCol)) value = toNumber(raw);
      else if (dbCol === "estado_dash") value = normalizeEstadoDash(raw);
      else if (typeof raw === "string") value = normalizeText(raw) || null;
      if (value !== null && value !== undefined && value !== "") hasAny = true;
      out[dbCol] = value;
    }
    if (out.id_cuenta_dash == null) {
      const idFromColumnA = toNumber(firstColumnValue(row));
      if (idFromColumnA != null) {
        out.id_cuenta_dash = idFromColumnA;
        hasAny = true;
      }
    }
    // Skip totally empty rows o filas sin ID Cuenta (dash): es la clave lógica del import.
    if (!hasAny) continue;
    if (out.id_cuenta_dash == null) continue;
    mapped.push(out);
  }
  return mapped;
}

export type BatchLog = {
  batch: number;
  uploaded: number;
  failed: number;
  attempts: number;
  error?: string;
};

export type ImportSummary = {
  totalRead: number;
  totalDeduped: number;
  totalInserted: number;
  totalFailed: number;
  batches: BatchLog[];
};

export async function upsertClientesInBatches(
  rows: Record<string, unknown>[],
  onProgress: (uploaded: number, total: number) => void,
  batchSize = 500,
  onLog?: (line: string) => void,
): Promise<ImportSummary> {
  // Clave de dedupe: ID Cuenta (dash) + mes_exportacion. ID HubSpot es solo un atributo informativo.
  const dedupeKeyOf = (row: Record<string, unknown>): string => {
    const dash = row.id_cuenta_dash;
    const idPart = `D:${String(dash ?? "").trim()}`;
    return `${idPart}__${row.mes_exportacion}`;
  };

  // ===== Análisis del Excel CRUDO (antes de cualquier dedupe / upsert) =====
  let nActivo = 0;
  let nBloqueado = 0;
  let nVacio = 0;
  let nOtro = 0;
  const otrosEstados = new Map<string, number>();
  const statesByKey = new Map<string, Set<string>>();
  for (const row of rows) {
    const raw = row.estado_dash;
    const est = raw == null || raw === "" ? "" : String(raw).trim();
    if (est === "Activo") nActivo++;
    else if (est === "Bloqueado") nBloqueado++;
    else if (est === "") nVacio++;
    else {
      nOtro++;
      otrosEstados.set(est, (otrosEstados.get(est) || 0) + 1);
    }
    const key = dedupeKeyOf(row).split("__")[0]!;
    const set = statesByKey.get(key) ?? new Set<string>();
    set.add(est || "(vacío)");
    statesByKey.set(key, set);
  }
  const idsUnicos = statesByKey.size;
  let dupMismoEstado = 0;
  let dupCambianEstado = 0;
  for (const [, set] of statesByKey) {
    // (solo cuentan los duplicados; las cuentas únicas se miden aparte abajo)
    if (set.size === 1) continue;
    // este id aparece >1 vez con estados distintos
    dupCambianEstado++;
  }
  // duplicados con mismo estado = (apariciones por id > 1) - (cambian estado)
  const apariciones = new Map<string, number>();
  for (const row of rows) {
    const key = dedupeKeyOf(row).split("__")[0]!;
    apariciones.set(key, (apariciones.get(key) || 0) + 1);
  }
  let idsDuplicados = 0;
  for (const [, n] of apariciones) if (n > 1) idsDuplicados++;
  dupMismoEstado = idsDuplicados - dupCambianEstado;

  onLog?.(`──── Análisis del Excel crudo ────`);
  onLog?.(`1) Total filas leídas: ${rows.length}`);
  onLog?.(
    `2) Por estado_dash → Activo: ${nActivo} · Bloqueado: ${nBloqueado} · ` +
      `vacío/null: ${nVacio}${nOtro > 0 ? ` · otros: ${nOtro}` : ""}`,
  );
  if (nOtro > 0) {
    const muestra = Array.from(otrosEstados.entries())
      .map(([k, v]) => `"${k}"×${v}`)
      .join(", ");
    onLog?.(`   Otros estados encontrados: ${muestra}`);
  }
  onLog?.(`3) ID Cuenta (dash) únicos: ${idsUnicos} (sobre ${rows.length} filas válidas)`);
  onLog?.(
    `4) IDs duplicados: ${idsDuplicados} → ` +
      `mismo estado en todas sus apariciones: ${dupMismoEstado} · ` +
      `cambian de estado entre apariciones: ${dupCambianEstado}`,
  );
  onLog?.(`──────────────────────────────────`);
  // Prioridad: Activo (2) > Bloqueado (1) > null/empty/otro (0).
  const dedupMap = new Map<string, Record<string, unknown>>();
  const seenCount = new Map<string, number>();
  const activeKeysInRaw = new Set<string>();
  for (const row of rows) {
    const key = dedupeKeyOf(row);
    seenCount.set(key, (seenCount.get(key) || 0) + 1);
    if (estadoPriority(row.estado_dash) === 2) activeKeysInRaw.add(key);
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, row);
    } else if (estadoPriority(row.estado_dash) > estadoPriority(existing.estado_dash)) {
      dedupMap.set(key, row);
    }
  }
  const deduped = Array.from(dedupMap.values());
  const activeKeysAfterDedupe = new Set(
    deduped
      .filter((row) => estadoPriority(row.estado_dash) === 2)
      .map((row) => dedupeKeyOf(row)),
  );
  const lostActiveKeys = Array.from(activeKeysInRaw).filter((key) => !activeKeysAfterDedupe.has(key));
  if (lostActiveKeys.length > 0) {
    throw new Error(
      `Dedupe inválido: se perdieron ${lostActiveKeys.length} cuentas con estado_dash=Activo. ` +
        `Ejemplos: ${lostActiveKeys.slice(0, 10).join(", ")}`,
    );
  }
  const duplicateKeys = Array.from(seenCount.entries()).filter(([, n]) => n > 1);
  const duplicateRowsRemoved = duplicateKeys.reduce((sum, [, n]) => sum + (n - 1), 0);

  const total = deduped.length;
  const summary: ImportSummary = {
    totalRead: rows.length,
    totalDeduped: total,
    totalInserted: 0,
    totalFailed: 0,
    batches: [],
  };

  onLog?.(
    `Dedupe por ID Cuenta (dash) + mes. ` +
    `Claves duplicadas: ${duplicateKeys.length} ` +
    `(${duplicateRowsRemoved} filas extra descartadas).`,
  );
  if (duplicateKeys.length > 0) {
    const sample = duplicateKeys
      .slice(0, 10)
      .map(([k, n]) => `${k.split("__")[0]}×${n}`)
      .join(", ");
    onLog?.(`Ejemplos de claves repetidas: ${sample}${duplicateKeys.length > 10 ? "…" : ""}`);
  }
  onLog?.(
    `Tras dedupe por prioridad → Activo: ${activeKeysAfterDedupe.size} · ` +
      `Bloqueado: ${deduped.filter((row) => estadoPriority(row.estado_dash) === 1).length} · ` +
      `vacío/otro: ${deduped.filter((row) => estadoPriority(row.estado_dash) === 0).length}`,
  );
  onLog?.(`Inicio: ${rows.length} leídas, ${total} únicas tras dedupe. Batch=${batchSize}.`);

  // Borrar filas previas del/los mes(es) presentes en este import antes de insertar.
  const mesesAfectados = Array.from(new Set(deduped.map((r) => String(r.mes_exportacion))));
  for (const mes of mesesAfectados) {
    const { error: delErr } = await supabase.from("clientes").delete().eq("mes_exportacion", mes);
    if (delErr) {
      onLog?.(`No se pudieron borrar filas previas de ${mes}: ${delErr.message}`);
    } else {
      onLog?.(`Borradas filas previas de ${mes}.`);
    }
  }

  for (let i = 0; i < total; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    const batchNum = i / batchSize + 1;
    let attempts = 0;
    let lastError = "";
    let ok = false;

    while (attempts < 3 && !ok) {
      attempts++;
      const { error } = await supabase
        .from("clientes")
        .insert(batch as never);
      if (!error) {
        ok = true;
        break;
      }
      lastError = error.message;
      onLog?.(`Batch ${batchNum} intento ${attempts} falló: ${lastError}`);
      await new Promise((r) => setTimeout(r, 300 * attempts));
    }

    if (ok) {
      summary.totalInserted += batch.length;
      summary.batches.push({ batch: batchNum, uploaded: batch.length, failed: 0, attempts });
      onLog?.(`Batch ${batchNum} completado: ${batch.length} filas subidas, error: 0 (intentos: ${attempts})`);
    } else {
      summary.totalFailed += batch.length;
      summary.batches.push({ batch: batchNum, uploaded: 0, failed: batch.length, attempts, error: lastError });
      onLog?.(`Batch ${batchNum} completado: 0 filas subidas, error: ${batch.length} (tras ${attempts} intentos) — ${lastError}`);
    }
    onProgress(Math.min(i + batch.length, total), total);
  }


  onLog?.(
    `Final: leídas=${summary.totalRead}, únicas=${summary.totalDeduped}, ` +
    `insertadas=${summary.totalInserted}, fallidas=${summary.totalFailed}.`,
  );
  return summary;
}


