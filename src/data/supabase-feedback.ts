import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeedbackRow = {
  id: string;
  negocio: string;
  id_cuenta: number | null;
  feedback: string;
  mes: string;
  autor: string | null;
  created_at: string;
};

// ── Categorización por keywords ───────────────────────────────────────────────

export const FEEDBACK_CATS = [
  "Reportes / Estadísticas",
  "Delivery / Envíos",
  "Carta / Menú QR",
  "Notificaciones",
  "Integraciones",
  "Arqueos / Caja",
  "Reservas / Mesas",
  "Stock / Insumos",
  "Multisucursal",
  "Usuarios / Permisos",
  "Otros",
] as const;

export type FeedbackCat = (typeof FEEDBACK_CATS)[number];

const RULES: [FeedbackCat, RegExp][] = [
  ["Reportes / Estadísticas", /reporte|estadística|ticket medio|factura|fiscal|cierre|cierre m|tiquet/i],
  ["Delivery / Envíos",       /delivery|envío|envio|dirección|ifood|pedido|rappi|uber/i],
  ["Carta / Menú QR",         /carta|qr|menú|menu|idioma|producto.*disponib|disponib.*producto/i],
  ["Notificaciones",           /alarma|notificac|alerta|aviso/i],
  ["Integraciones",            /chatbot|integrac|facebook|meta|sistema|api/i],
  ["Arqueos / Caja",           /arqueo|caja|cobro|venta.*elimina|elimina.*venta/i],
  ["Reservas / Mesas",         /reserva|mesa|turno/i],
  ["Stock / Insumos",          /stock|ingrediente|insumo|receta|elabora/i],
  ["Multisucursal",            /multisucursal|sucursal|central/i],
  ["Usuarios / Permisos",      /usuario|permiso|acceso|rol /i],
];

export function categorizarFeedback(text: string): FeedbackCat {
  for (const [cat, re] of RULES) {
    if (re.test(text)) return cat;
  }
  return "Otros";
}

export const FEEDBACK_CAT_COLORS: Record<FeedbackCat, string> = {
  "Reportes / Estadísticas": "#6366F1",
  "Delivery / Envíos":       "#F59E0B",
  "Carta / Menú QR":         "#10B981",
  "Notificaciones":           "#EF4444",
  "Integraciones":            "#8B5CF6",
  "Arqueos / Caja":           "#0EA5E9",
  "Reservas / Mesas":         "#EC4899",
  "Stock / Insumos":          "#84CC16",
  "Multisucursal":            "#F97316",
  "Usuarios / Permisos":      "#64748B",
  "Otros":                    "#CBD5E1",
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

import { FEEDBACK_STATIC } from "./feedback-static";

const MESES_STATIC = Array.from(new Set(FEEDBACK_STATIC.map(r => r.mes))).sort().reverse();

export function useFeedbackMeses() {
  return useQuery({
    queryKey: ["feedback-meses"],
    queryFn: async () => MESES_STATIC,
    staleTime: Infinity,
  });
}

export function useFeedback(mes: string) {
  return useQuery({
    queryKey: ["feedback-usuarios", mes],
    queryFn: async () => {
      if (!mes) return [];
      const hasName = (r: FeedbackRow) => r.negocio && r.negocio !== "EMPTY";
      return FEEDBACK_STATIC
        .filter(r => r.mes === mes)
        .sort((a, b) => {
          const ha = hasName(a) ? 0 : 1, hb = hasName(b) ? 0 : 1;
          if (ha !== hb) return ha - hb;
          return a.negocio.localeCompare(b.negocio);
        });
    },
    enabled: Boolean(mes),
    staleTime: Infinity,
  });
}
