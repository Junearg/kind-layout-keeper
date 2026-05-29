// Insights de churn calculados desde Supabase: GMV perdido, evitable vs
// no evitable, señales de adopción y ranking de cuentas críticas.
// Filtra cuentas con estado_dash='Bloqueado' del snapshot activo, y para
// la mayoría de los bloques restringe a fecha_baja en los últimos 6 meses
// terminando en el mes activo.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;

async function pageAll<T>(builder: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await builder().range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

const EVITABLE = new Set(
  [
    "dejó de usar sistema",
    "dejo de usar sistema",
    "precio",
    "price",
    "eligió otro sistema",
    "eligio otro sistema",
    "falta de funcionalidad",
    "functionalities",
    "mal servicio",
  ].map((s) => s.toLowerCase()),
);

const NO_EVITABLE = new Set(
  [
    "cierre definitivo del negocio",
    "cierre temporal del negocio",
    "closed",
    "temporal_closed",
    "venta de comercio / cambio dueño",
    "venta de comercio / cambio dueno",
  ].map((s) => s.toLowerCase()),
);

export type EvitabilidadTipo = "Evitable" | "No evitable" | "Sin clasificar";

export function classifyMotivo(m: string | null | undefined): EvitabilidadTipo {
  const t = (m ?? "").trim().toLowerCase();
  if (!t) return "Sin clasificar";
  if (EVITABLE.has(t)) return "Evitable";
  if (NO_EVITABLE.has(t)) return "No evitable";
  return "Sin clasificar";
}

export type ChurnRow = {
  id: number | string;
  nombre: string;
  pais: string;
  plan: string;
  ejecutivo: string;
  motivo: string;
  tipo: EvitabilidadTipo;
  gmv: number;
  contactos: number;
  productos: number;
  usuarios: number;
  npsLtr: number | null;
  vSalon: number;
  vDelivery: number;
  vMostrador: number;
  fechaBaja: string | null;
  scoreRiesgo: number;
};

export type GmvPoint = { key: string; mes: string; gmv: number };

export type ChurnInsights = {
  total: number;
  totalUltimos6m: number;
  gmvTotal: number;
  gmvPromedioMensual: number;
  mesMayorPerdida: { key: string; mes: string; gmv: number } | null;
  trendMensual: GmvPoint[];
  evitable: { n: number; gmv: number };
  noEvitable: { n: number; gmv: number };
  sinClasificar: { n: number; gmv: number };
  pctEvitable: number;
  pctSinClasificar: number;
  // Señales de adopción
  pctSinContacto: number;
  pctMonoCanal: number;
  pctDejaronUsarSinContacto: number;
  // Adopción alta que igual churnea
  altaAdopcionN: number;
  altaAdopcionGmv: number;
  altaAdopcionTopMotivo: { motivo: string; n: number } | null;
  // Risk flag summary
  monoCanalN: number;
  gmvBajoN: number;
  sinContactoN: number;
  pocosUsuariosN: number;
  // Ranking
  rows: ChurnRow[];
  ejecutivos: string[];
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function monthKeyToShort(k: string): string {
  const [, m] = k.split("-").map(Number);
  return MONTH_NAMES[(m ?? 1) - 1] ?? k;
}
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function prevMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = (y ?? 0) * 12 + ((m ?? 1) - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function scoreRiesgo(r: {
  contactos: number;
  productos: number;
  usuarios: number;
  gmv: number;
  npsLtr: number | null;
  tipo: EvitabilidadTipo;
}): number {
  let s = 0;
  if (r.contactos === 0) s += 3;
  if (r.productos < 50) s += 2;
  if (r.usuarios <= 2) s += 1;
  if (r.gmv > 30000) s += 2;
  if (r.npsLtr != null && r.npsLtr < 7) s += 3;
  if (r.tipo === "Evitable") s += 2;
  return s;
}

type Raw = {
  id_cuenta_dash: number | null;
  nombre: string | null;
  pais: string | null;
  plan: string | null;
  ejecutivo: string | null;
  motivo_baja: string | null;
  gmv: number | string | null;
  cant_contactos: number | null;
  productos: number | null;
  usuarios: number | null;
  nps_score: number | null;
  v_salon: number | null;
  v_delivery: number | null;
  v_mostrador: number | null;
  fecha_baja: string | null;
};

async function fetchInsights(mesActivo: string): Promise<ChurnInsights> {
  const since = prevMonth(mesActivo, 5); // últimos 6 meses inclusive
  const raws = await pageAll<Raw>(() => supabase
    .from("clientes")
    .select(
      "id_cuenta_dash,nombre,pais,plan,ejecutivo,motivo_baja,gmv,cant_contactos,productos,usuarios,nps_score,v_salon,v_delivery,v_mostrador,fecha_baja",
    )
    .eq("mes_exportacion", mesActivo)
    .eq("estado_dash", "Bloqueado")
    .not("fecha_baja", "is", null));

  const rows: ChurnRow[] = [];
  const trendMap = new Map<string, number>();
  // Inicializar últimos 6 meses
  for (let i = 5; i >= 0; i--) {
    trendMap.set(prevMonth(mesActivo, i), 0);
  }

  for (const r of raws) {
    if (!r.fecha_baja) continue;
    const d = new Date(r.fecha_baja);
    const k = monthKey(d);
    if (k < since || k > mesActivo) continue;
    const gmv = typeof r.gmv === "number" ? r.gmv : parseFloat(r.gmv ?? "0") || 0;
    const tipo = classifyMotivo(r.motivo_baja);
    const npsLtr = r.nps_score != null && Number.isFinite(Number(r.nps_score)) ? Number(r.nps_score) : null;
    const row: ChurnRow = {
      id: r.id_cuenta_dash ?? r.nombre ?? Math.random().toString(36).slice(2),
      nombre: r.nombre ?? "—",
      pais: r.pais ?? "—",
      plan: r.plan ?? "—",
      ejecutivo: r.ejecutivo?.trim() || "Sin asignar",
      motivo: r.motivo_baja?.trim() || "Sin respuesta",
      tipo,
      gmv,
      contactos: Number(r.cant_contactos) || 0,
      productos: Number(r.productos) || 0,
      usuarios: Number(r.usuarios) || 0,
      npsLtr,
      vSalon: Number(r.v_salon) || 0,
      vDelivery: Number(r.v_delivery) || 0,
      vMostrador: Number(r.v_mostrador) || 0,
      fechaBaja: r.fecha_baja,
      scoreRiesgo: 0,
    };
    row.scoreRiesgo = scoreRiesgo(row);
    rows.push(row);
    trendMap.set(k, (trendMap.get(k) ?? 0) + gmv);
  }

  const total = rows.length;
  const gmvTotal = rows.reduce((s, r) => s + r.gmv, 0);
  const trendMensual: GmvPoint[] = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, gmv]) => ({ key, mes: monthKeyToShort(key), gmv }));
  const gmvPromedioMensual = trendMensual.length ? gmvTotal / trendMensual.length : 0;
  const mesMayorPerdida = trendMensual.length
    ? trendMensual.reduce((m, p) => (p.gmv > m.gmv ? p : m))
    : null;

  const evitableRows = rows.filter((r) => r.tipo === "Evitable");
  const noEvitableRows = rows.filter((r) => r.tipo === "No evitable");
  const sinClasifRows = rows.filter((r) => r.tipo === "Sin clasificar");

  const evitable = { n: evitableRows.length, gmv: evitableRows.reduce((s, r) => s + r.gmv, 0) };
  const noEvitable = { n: noEvitableRows.length, gmv: noEvitableRows.reduce((s, r) => s + r.gmv, 0) };
  const sinClasificar = { n: sinClasifRows.length, gmv: sinClasifRows.reduce((s, r) => s + r.gmv, 0) };
  const pctEvitable = total ? (evitable.n / total) * 100 : 0;
  const pctSinClasificar = total ? (sinClasificar.n / total) * 100 : 0;

  // Señales
  const sinContacto = rows.filter((r) => r.contactos === 0).length;
  const monoCanal = rows.filter((r) => {
    const c = (r.vSalon > 0 ? 1 : 0) + (r.vDelivery > 0 ? 1 : 0) + (r.vMostrador > 0 ? 1 : 0);
    return c <= 1;
  }).length;
  const dejaronUsar = rows.filter((r) => /dej(ó|o) de usar/i.test(r.motivo));
  const dejaronSinContacto = dejaronUsar.filter((r) => r.contactos === 0).length;

  // Alta adopción
  const altaAdop = rows.filter((r) => r.productos > 100 && r.usuarios > 3);
  const altaMotivoCount = new Map<string, number>();
  for (const r of altaAdop) altaMotivoCount.set(r.motivo, (altaMotivoCount.get(r.motivo) ?? 0) + 1);
  const altaTop = [...altaMotivoCount.entries()].sort((a, b) => b[1] - a[1])[0];

  // Risk flag summary
  const gmvBajoN = rows.filter((r) => r.gmv < 25000).length;
  const pocosUsuariosN = rows.filter((r) => r.usuarios <= 2).length;

  // Ejecutivos
  const ejecutivos = Array.from(new Set(rows.map((r) => r.ejecutivo))).sort();

  return {
    total,
    totalUltimos6m: total,
    gmvTotal,
    gmvPromedioMensual,
    mesMayorPerdida,
    trendMensual,
    evitable,
    noEvitable,
    sinClasificar,
    pctEvitable,
    pctSinClasificar,
    pctSinContacto: total ? (sinContacto / total) * 100 : 0,
    pctMonoCanal: total ? (monoCanal / total) * 100 : 0,
    pctDejaronUsarSinContacto: dejaronUsar.length ? (dejaronSinContacto / dejaronUsar.length) * 100 : 0,
    altaAdopcionN: altaAdop.length,
    altaAdopcionGmv: altaAdop.reduce((s, r) => s + r.gmv, 0),
    altaAdopcionTopMotivo: altaTop ? { motivo: altaTop[0], n: altaTop[1] } : null,
    monoCanalN: monoCanal,
    gmvBajoN,
    sinContactoN: sinContacto,
    pocosUsuariosN,
    rows,
    ejecutivos,
  };
}

export function useSupabaseChurnInsights(mesActivo: string) {
  return useQuery({
    queryKey: ["supabase-churn-insights", mesActivo],
    queryFn: () => fetchInsights(mesActivo),
    enabled: Boolean(mesActivo),
    staleTime: 60_000,
  });
}

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatMoneyFull(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
