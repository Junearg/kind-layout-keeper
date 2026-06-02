import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  listFechasDiarias,
  useKpiSnapshotMultipais,
  type KpiDiario,
} from "@/data/supabase-kpis-diarios";

/** Diagnóstico: cuenta exacta por campo usando paginación completa */
function useDebugFecha(fecha: string) {
  return useQuery({
    queryKey: ["debug-fecha-v2", fecha],
    queryFn: async () => {
      if (!fecha) return null;

      // Paginación completa para contar bien
      const PAGE = 1000;
      const allRows: { estado_dash: string|null; etapa: string|null; temas_contacto: string|null; motivos_contacto: string|null }[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("clientes")
          .select("estado_dash,etapa,temas_contacto,motivos_contacto")
          .eq("mes_exportacion", fecha)
          .range(from, from + PAGE - 1);
        if (error) break;
        const batch = data ?? [];
        allRows.push(...batch as any);
        if (batch.length < PAGE) break;
      }

      const total = allRows.length;
      const countBy = (field: keyof typeof allRows[0]) => {
        const map: Record<string, number> = {};
        for (const r of allRows) {
          const v = String(r[field] ?? "(null)");
          map[v] = (map[v] ?? 0) + 1;
        }
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
      };
      return {
        total,
        estado_dash: countBy("estado_dash"),
        etapa: countBy("etapa"),
        temas_contacto: countBy("temas_contacto"),
        motivos_contacto: countBy("motivos_contacto"),
      };
    },
    enabled: Boolean(fecha),
    staleTime: 60_000,
  });
}

export const Route = createFileRoute("/retencion")({
  head: () => ({ meta: [{ title: "Retención · Churn Hub" }] }),
  component: RetencionPage,
});

const PAISES_COLS = ["Región", "Argentina", "Chile", "México", "Colombia", "Brasil"] as const;

const fmt  = (n: number) => n.toLocaleString("es-AR");
const pct  = (n: number | null | undefined) => n == null ? "—" : `${n.toFixed(1)}%`;
const pct2 = (n: number | null | undefined) => n == null ? "—" : `${n.toFixed(2)}%`;

type MetricaDef = {
  label: string;
  group?: string;
  get: (k: KpiDiario) => string;
  highlight?: (k: KpiDiario) => "red" | "green" | null;
};

const METRICAS: MetricaDef[] = [
  // ── Cuentas ────────────────────────────────────────────────
  { label: "Activas",                     group: "Cuentas",      get: k => fmt(k.activas) },
  { label: "Pago Pendiente",                                     get: k => fmt(k.pagoPendiente),    highlight: k => k.pagoPendiente > k.activas * 0.2 ? "red" : null },
  { label: "Bajas Confirmadas",                                  get: k => fmt(k.bajas),            highlight: k => k.bajas > 100 ? "red" : null },
  { label: "Cuentas a Recuperar",                                get: k => fmt(k.aRecuperar) },
  { label: "  · Onboarding",                                    get: k => fmt(k.onboarding) },
  { label: "  · Engagement",                                    get: k => fmt(k.engagement) },

  // ── Actividad ──────────────────────────────────────────────
  { label: "C/ vtas últimos 7 días",      group: "Actividad",    get: k => fmt(k.activasConVentas) },
  { label: "S/ vtas últimos 7 días",                             get: k => fmt(k.sinVentas),        highlight: k => k.sinVentas > k.activas * 0.1 ? "red" : null },
  { label: "% Retenido",                                         get: k => pct(k.pctRetenido),      highlight: k => k.pctRetenido < 94 ? "red" : k.pctRetenido >= 97 ? "green" : null },
  { label: "Activas ≥10 ventas/mes",                             get: k => fmt(k.activasConVentas) },
  { label: "A Recuperar ≥10v/mes",                               get: k => fmt(k.recuperar10v) },
  { label: "% ≥10v mensual",                                     get: k => pct(k.pct10v),           highlight: k => k.pct10v < 50 ? "red" : null },
  { label: "% Retenido Activo ≥10v",                             get: k => pct(k.pctRetenido10v),   highlight: k => k.pctRetenido10v < 45 ? "red" : null },
  { label: "Login < 7 días (n)",                                 get: k => fmt(k.loginMenos7) },
  { label: "% Login < 7 días",                                   get: k => pct(k.loginPct),         highlight: k => k.loginPct < 85 ? "red" : k.loginPct >= 95 ? "green" : null },

  // ── Churn y Plan ───────────────────────────────────────────
  { label: "MPCs mes pasado",             group: "Churn / Plan", get: k => fmt(k.mpcsMesPasado) },
  { label: "Churn Bruto",                                        get: k => pct2(k.churnBruto),      highlight: k => k.churnBruto > 5 ? "red" : k.churnBruto < 2 ? "green" : null },
  { label: "Churn Neto",                                         get: k => pct2(k.churnNeto),       highlight: k => k.churnNeto > 5 ? "red" : k.churnNeto < 2 ? "green" : null },
  { label: "Churn Plan",                                         get: k => pct(k.churnPlan) },
  { label: "Proyectado vs Plan",                                 get: k => k.proyectadoVsPlan == null ? "—" : `${k.proyectadoVsPlan >= 0 ? "+" : ""}${k.proyectadoVsPlan.toFixed(1)}%`, highlight: k => (k.proyectadoVsPlan ?? 0) > 10 ? "red" : (k.proyectadoVsPlan ?? 0) < -5 ? "green" : null },
  { label: "# Recuperar para on-target",                         get: k => k.nRecuperar == null ? "—" : fmt(k.nRecuperar) },
  { label: "MPCs Retenidos (meta)",                              get: k => k.mpcsMeta == null ? "—" : fmt(k.mpcsMeta) },
  { label: "MPCs vs Plan",                                       get: k => k.mpcsVsPlan == null ? "—" : `${k.mpcsVsPlan >= 0 ? "+" : ""}${k.mpcsVsPlan.toFixed(1)}%`, highlight: k => (k.mpcsVsPlan ?? 0) < -3 ? "red" : (k.mpcsVsPlan ?? 0) >= 0 ? "green" : null },
];

function RetencionPage() {
  const { data: fechas, isLoading: fechasLoading } = useQuery({
    queryKey: ["fechas-diarias"],
    queryFn: listFechasDiarias,
    staleTime: 300_000,
  });
  const [fechaSel, setFechaSel] = useState<string>("");
  const fechaHoy = fechaSel || fechas?.[0] || "";
  const { data: kpis, isLoading } = useKpiSnapshotMultipais(fechaHoy);

  const kpiMap = new Map<string, KpiDiario>();
  if (kpis) for (const k of kpis) kpiMap.set(k.pais, k);

  const { data: debug } = useDebugFecha(fechaHoy);

  if (fechasLoading) {
    return (
      <Layout>
        <div className="card" style={{ padding: 20 }}>Cargando…</div>
      </Layout>
    );
  }

  if (!fechas || fechas.length === 0) {
    return (
      <Layout>
        <div className="card" style={{ padding: 24, background: "#FFFBEB", border: "1px solid #FDE68A", maxWidth: 560 }}>
          <div className="card-eyebrow">Sin datos diarios</div>
          <div style={{ marginTop: 10, fontSize: 14, color: "#92400E", lineHeight: 1.6 }}>
            Para ver el snapshot de retención, importá el archivo diario desde{" "}
            <strong>/importar</strong> en modo <strong>Diario</strong>. <br />
            Usá el mismo XLSX que exportás desde HubSpot, seleccioná la fecha de hoy y subilo.
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>
            Retención <span className="alt">/ snapshot diario</span>
          </h1>
          <p className="fs-12 muted" style={{ marginTop: 6 }}>
            {fechas.length} snapshot{fechas.length !== 1 ? "s" : ""} importado{fechas.length !== 1 ? "s" : ""} · réplica de la columna J del dashboard de retención
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="fs-12 muted">Fecha:</span>
          <select
            value={fechaHoy}
            onChange={e => setFechaSel(e.target.value)}
            style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontFamily: "inherit", fontWeight: 500 }}
          >
            {fechas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Panel de diagnóstico — muestra valores reales en Supabase */}
      {debug && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--ink-3)", padding: "8px 0" }}>
            🔍 Diagnóstico · {debug.total} filas encontradas para {fechaHoy}
            {debug.total === 0 && " — ⚠️ SIN DATOS para esta fecha"}
          </summary>
          <div className="card" style={{ padding: 16, marginTop: 8, fontSize: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {[
              { label: "estado_dash", vals: debug.estado_dash },
              { label: "etapa", vals: debug.etapa },
              { label: "temas_contacto (ventas?)", vals: debug.temas_contacto },
              { label: "motivos_contacto (login?)", vals: debug.motivos_contacto },
            ].map(({ label, vals }) => (
              <div key={label}>
                <div style={{ fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{label}</div>
                {vals.slice(0, 6).map(([v, n]) => (
                  <div key={v} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid var(--rule)" }}>
                    <span style={{ color: "var(--ink-3)", fontFamily: "monospace" }}>{v}</span>
                    <span style={{ fontWeight: 600 }}>{n}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Tabla multi-país */}
      <div className="card lg" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div className="fs-12 muted" style={{ padding: 24 }}>Calculando métricas para todos los países…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--paper-2)" }}>
                  <th style={{
                    padding: "12px 20px", textAlign: "left", fontWeight: 500, fontSize: 11,
                    color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5,
                    minWidth: 240, position: "sticky", left: 0, background: "var(--paper-2)",
                    borderRight: "2px solid var(--rule)",
                  }}>
                    Métrica
                  </th>
                  {PAISES_COLS.map((p) => (
                    <th key={p} style={{
                      padding: "12px 20px", textAlign: "right", fontSize: 13,
                      fontWeight: p === "Región" ? 700 : 500,
                      color: p === "Región" ? "var(--orange)" : "var(--ink)",
                      minWidth: 120, borderLeft: "1px solid var(--rule)",
                    }}>
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICAS.map((m, i) => {
                  const prevGroup = i > 0 ? METRICAS[i - 1]?.group : undefined;
                  const showGroupHeader = m.group !== undefined && m.group !== prevGroup;
                  return (
                    <>
                      {showGroupHeader && (
                        <tr key={`grp-${m.group}`}>
                          <td colSpan={PAISES_COLS.length + 1} style={{
                            padding: "10px 20px 4px", fontSize: 10.5, textTransform: "uppercase",
                            letterSpacing: 1, color: "var(--ink-4)", fontWeight: 600,
                            background: "var(--paper-2)", borderTop: "2px solid var(--rule)",
                          }}>
                            {m.group}
                          </td>
                        </tr>
                      )}
                      <tr key={m.label} style={{ borderTop: "1px solid var(--rule)" }}>
                        <td style={{
                          padding: "10px 20px", color: m.label.startsWith("  ·") ? "var(--ink-3)" : "var(--ink-2)",
                          fontSize: m.label.startsWith("  ·") ? 11.5 : 12.5,
                          position: "sticky", left: 0, background: "var(--paper)",
                          borderRight: "2px solid var(--rule)",
                        }}>
                          {m.label.startsWith("  ·") ? m.label.replace("  ·", "↳") : m.label}
                        </td>
                        {PAISES_COLS.map((p) => {
                          const k = kpiMap.get(p);
                          const val = k ? m.get(k) : "—";
                          const tone = k ? (m.highlight?.(k) ?? null) : null;
                          return (
                            <td key={p} style={{
                              padding: "10px 20px", textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12.5,
                              color: tone === "red" ? "#DC2626" : tone === "green" ? "#16A34A" : p === "Región" ? "var(--ink)" : "var(--ink-2)",
                              fontWeight: tone ? 700 : p === "Región" ? 600 : 400,
                              background: tone === "red" ? "rgba(220,38,38,0.04)" : tone === "green" ? "rgba(22,163,74,0.04)" : undefined,
                              borderLeft: "1px solid var(--rule)",
                            }}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="fs-11 muted" style={{ marginTop: 12 }}>
        Importá cada día desde <strong>/importar</strong> en modo Diario para acumular historial. Los valores se calculan directamente desde Supabase.
      </div>
    </Layout>
  );
}
