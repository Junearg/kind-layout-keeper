// Normalización de motivos de baja.
// Fuente única de verdad: importar desde acá en todos los archivos que necesiten la lógica.

export type MotivoCat =
  | "Precio"
  | "Producto / Funcionalidades"
  | "Cierre definitivo"
  | "Cierre temporal"
  | "Eligió otro sistema"
  | "Servicio"
  | "Problemas técnicos"
  | "Sin motivo"
  | "Otro";

export const MOTIVO_CATS: MotivoCat[] = [
  "Cierre definitivo",
  "Cierre temporal",
  "Precio",
  "Producto / Funcionalidades",
  "Eligió otro sistema",
  "Servicio",
  "Problemas técnicos",
  "Otro",
  "Sin motivo",
];

export const MOTIVO_COLORS: Record<MotivoCat, string> = {
  "Precio":                    "#F05A28",
  "Producto / Funcionalidades": "#7C3AED",
  "Cierre definitivo":          "#6B7280",
  "Cierre temporal":            "#2563EB",
  "Eligió otro sistema":        "#DB2777",
  "Servicio":                   "#0D9488",
  "Problemas técnicos":         "#D97706",
  "Sin motivo":                 "#DC2626",
  "Otro":                       "#9CA3AF",
};

export const AREA_ESTRATEGICA: Record<MotivoCat, string> = {
  "Precio":                    "Producto & Pricing",
  "Producto / Funcionalidades": "Producto & Pricing",
  "Eligió otro sistema":        "Competencia",
  "Problemas técnicos":         "Tecnología",
  "Cierre definitivo":          "Mercado",
  "Cierre temporal":            "Mercado",
  "Servicio":                   "CS & Servicio",
  "Sin motivo":                 "Sin clasificar",
  "Otro":                       "Sin clasificar",
};

function matchCat(text: string): MotivoCat | null {
  const t = text.trim();
  if (!t) return null;
  const u = t.toUpperCase();

  if (/^precio$/i.test(t) || u === "PRICE")                          return "Precio";
  if (/falta de funcionalidad/i.test(t) || u === "FUNCTIONALITIES")  return "Producto / Funcionalidades";
  if (/cierre temporal/i.test(t) || /contrató por evento/i.test(t) ||
      /local no inaugurado/i.test(t) || u === "TEMPORAL_CLOSED")     return "Cierre temporal";
  if (/cierre definitivo/i.test(t) || /negocio no gastronómico/i.test(t) ||
      /venta de comercio/i.test(t) || u === "CLOSED")                return "Cierre definitivo";
  if (/eligió otro sistema/i.test(t) || /dejó de usar sistema/i.test(t)) return "Eligió otro sistema";
  if (/mal servicio/i.test(t) || u === "SERVICE")                    return "Servicio";
  if (/impresora|hardware|sin internet|problem[ao]s?\s+técnic|integraci/i.test(t)) return "Problemas técnicos";
  if (/sin respuesta/i.test(t) || u === "OTHER")                     return "Sin motivo";
  return null;
}

function matchComentario(texto: string): MotivoCat | null {
  const t = texto.toLowerCase();
  if (/\bpreci[o]?\b|caro|costoso|mensualidad|muy\s+alto|cobr[oa]|tarifa/i.test(t))       return "Precio";
  if (/funci[oó]n|funcionalidad|feature|m[oó]dulo|no\s+tiene|le\s+falta|necesita/i.test(t)) return "Producto / Funcionalidades";
  if (/cerr[oó]\s+(el\s+)?local|cerr[oó]\s+(el\s+)?negocio|vendi[oó]|quiebra|quebr[oó]|no\s+abr[ei]|no\s+sigui[oó]/i.test(t)) return "Cierre definitivo";
  if (/temporal|event[o]?|temporad|vacacion|reform|remodelac|mudanz|no\s+(está\s+)?inaug/i.test(t)) return "Cierre temporal";
  if (/otro\s+sistema|cambi[oó]\s+de\s+(sistema|software)|migraron|se\s+fue\s+a|compe(t|tenci)/i.test(t)) return "Eligió otro sistema";
  if (/atenci[oó]n|soporte|servicio|mal\s+trato|no\s+respond|demora|lento/i.test(t))       return "Servicio";
  if (/impresora|hardware|internet|integraci[oó]n|técnico|no\s+funciona|falla|error\s+de\s+sistem/i.test(t)) return "Problemas técnicos";
  return null;
}

/** Prioridad: J (motivo_baja) → K (submotivo_baja) → N (motivo_metabase) → O (comentarios, keywords) */
export function normalizarMotivo(
  motivo: string | null | undefined,
  submotivo: string | null | undefined,
  motivoMetabase: string | null | undefined,
  comentarios: string | null | undefined,
): MotivoCat {
  const catJ = motivo?.trim()         ? matchCat(motivo.trim())         : null;
  if (catJ && catJ !== "Sin motivo" && catJ !== "Otro") return catJ;

  const catK = submotivo?.trim()      ? matchCat(submotivo.trim())      : null;
  if (catK && catK !== "Sin motivo" && catK !== "Otro") return catK;

  const catN = motivoMetabase?.trim() ? matchCat(motivoMetabase.trim()) : null;
  if (catN && catN !== "Sin motivo" && catN !== "Otro") return catN;

  const catO = comentarios?.trim()    ? matchComentario(comentarios.trim()) : null;
  if (catO) return catO;

  if (catJ) return catJ;
  if (catK) return catK;
  if (catN) return catN;

  const hayTexto = !!(motivo?.trim() || submotivo?.trim() || motivoMetabase?.trim() || comentarios?.trim());
  return hayTexto ? "Otro" : "Sin motivo";
}
