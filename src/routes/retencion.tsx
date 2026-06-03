import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  listFechasDiarias,
  useKpiSnapshotMultipais,
  type KpiDiario,
} from "@/data/supabase-kpis-diarios";

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
  { label: "Activas",                    group: "Cuentas",      get: k => fmt(k.activas) },
  { label: "Pago Pendiente",                                    get: k => fmt(k.pagoPendiente),   highlight: k => k.pagoPendiente > k.activas * 0.2 ? "red" : null },
  { label: "Bajas Confirmadas",                                 get: k => fmt(k.bajas),           highlight: k => k.bajas > 100 ? "red" : null },
  { label: "Cuentas a Recuperar",                               get: k => fmt(k.aRecuperar) },
  { label: "  · Onboarding",                                   get: k => fmt(k.onboarding) },
  { label: "  · Engagement",                                   get: k => fmt(k.engagement) },
  { label: "C/ vtas últimos 7 días",     group: "Actividad",   get: k => fmt(k.activasConVentas) },
  { label: "S/ vtas últimos 7 días",                           get: k => fmt(k.sinVentas),       highlight: k => k.sinVentas > k.activas * 0.1 ? "red" : null },
  { label: "% Retenido",                                        get: k => pct(k.pctRetenido),     highlight: k => k.pctRetenido < 94 ? "red" : k.pctRetenido >= 97 ? "green" : null },
  { label: "Activas ≥10 ventas/mes",                            get: k => fmt(k.activasConVentas) },
  { label: "A Recuperar ≥10v/mes",                              get: k => fmt(k.recuperar10v) },
  { label: "% ≥10v mensual",                                    get: k => pct(k.pct10v),          highlight: k => k.pct10v < 50 ? "red" : null },
  { label: "% Retenido Activo ≥10v",                            get: k => pct(k.pctRetenido10v),  highlight: k => k.pctRetenido10v < 45 ? "red" : null },
  { label: "Login < 7 días (n)",                                get: k => fmt(k.loginMenos7) },
  { label: "% Login < 7 días",                                  get: k => pct(k.loginPct),        highlight: k => k.loginPct < 85 ? "red" : k.loginPct >= 95 ? "green" : null },
  { label: "MPCs mes pasado",            group: "Churn / Plan", get: k => fmt(k.mpcsMesPasado) },
  { label: "Churn Bruto Proyectado",                            get: k => pct2(k.churnBruto),     highlight: k => k.churnBruto > 7 ? "red" : k.churnBruto < 3 ? "green" : null },
  { label: "Churn Neto Proyectado",                             get: k => pct2(k.churnNeto),      highlight: k => k.churnNeto > 7 ? "red" : k.churnNeto < 3 ? "green" : null },
  { label: "Churn Plan",                                        get: k => pct(k.churnPlan) },
  { label: "Proyectado Neto vs Plan",                           get: k => k.proyectadoVsPlan == null ? "—" : `${k.proyectadoVsPlan >= 0 ? "+" : ""}${k.proyectadoVsPlan.toFixed(1)}%`, highlight: k => (k.proyectadoVsPlan ?? 0) > 50 ? "red" : (k.proyectadoVsPlan ?? 0) < -10 ? "green" : null },
  { label: "# Recuperar para on-target",                        get: k => k.nRecuperar == null ? "—" : fmt(k.nRecuperar) },
  { label: "MPCs Retenidos Proyectados",                        get: k => fmt(k.mpcsRetenidosProyectados) },
  { label: "MPCs vs Plan",                                      get: k => k.mpcsVsPlan == null ? "—" : `${k.mpcsVsPlan >= 0 ? "+" : ""}${k.mpcsVsPlan.toFixed(1)}%`, highlight: k => (k.mpcsVsPlan ?? 0) < -3 ? "red" : (k.mpcsVsPlan ?? 0) >= 0 ? "green" : null },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, sub, value, delta, deltaLabel, tone, large = false,
}: {
  label: string; sub?: string; value: string; delta?: number | null;
  deltaLabel?: string; tone?: "green" | "red" | "neutral"; large?: boolean;
}) {
  const mainColor = tone === "green" ? "#16A34A" : tone === "red" ? "#DC2626" : "var(--ink)";
  const deltaColor = delta == null ? "var(--ink-3)"
    : delta > 0 ? "#16A34A" : delta < 0 ? "#DC2626" : "var(--ink-3)";
  const deltaSign = delta == null ? "" : delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "= ";
  return (
    <div className="card" style={{ padding: "18px 22px", minWidth: 180, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-3)", marginBottom: 4 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 8 }}>{sub}</div>}
      <div style={{ fontSize: large ? 48 : 36, fontWeight: 800, lineHeight: 1, color: mainColor, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {delta != null && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>
            {deltaSign}{Math.abs(delta).toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{deltaLabel ?? "vs mes anterior"}</span>
        </div>
      )}
    </div>
  );
}

// ── Diagnóstico (colapsado por defecto) ───────────────────────────────────────
function DiagPanel({ fechaHoy }: { fechaHoy: string }) {
  const { data: debug } = useQuery({
    queryKey: ["debug-fecha-v2", fechaHoy],
    queryFn: async () => {
      if (!fechaHoy) return null;
      const PAGE = 1000;
      const allRows: { estado_dash: string|null; etapa: string|null; temas_contacto: string|null; motivos_contacto: string|null }[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from("clientes")
          .select("estado_dash,etapa,temas_contacto,motivos_contacto")
          .eq("mes_exportacion", fechaHoy).range(from, from + PAGE - 1);
        if (error) break;
        const batch = data ?? [];
        allRows.push(...batch as any);
        if (batch.length < PAGE) break;
      }
      const countBy = (field: keyof typeof allRows[0]) => {
        const map: Record<string, number> = {};
        for (const r of allRows) { const v = String(r[field] ?? "(null)"); map[v] = (map[v] ?? 0) + 1; }
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
      };
      return { total: allRows.length, estado_dash: countBy("estado_dash"), etapa: countBy("etapa"), temas_contacto: countBy("temas_contacto"), motivos_contacto: countBy("motivos_contacto") };
    },
    enabled: Boolean(fechaHoy), staleTime: 60_000,
  });
  if (!debug) return null;
  return (
    <details style={{ marginBottom: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--ink-4)", padding: "6px 0" }}>
        🔍 Diagnóstico · {debug.total} filas para {fechaHoy}{debug.total === 0 && " — ⚠️ SIN DATOS"}
      </summary>
      <div className="card" style={{ padding: 14, marginTop: 6, fontSize: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {[["estado_dash", debug.estado_dash],["etapa", debug.etapa],["temas_contacto", debug.temas_contacto],["motivos_contacto", debug.motivos_contacto]].map(([label, vals]: any) => (
          <div key={label}>
            <div style={{ fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>{label}</div>
            {vals.slice(0,6).map(([v, n]: any) => (
              <div key={v} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid var(--rule)" }}>
                <span style={{ color: "var(--ink-3)", fontFamily: "monospace", fontSize: 11 }}>{v}</span>
                <span style={{ fontWeight: 600 }}>{n}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function RetencionPage() {
  const { data: fechas, isLoading: fechasLoading } = useQuery({
    queryKey: ["fechas-diarias"],
    queryFn: listFechasDiarias,
    staleTime: 300_000,
  });
  const [fechaSel, setFechaSel] = useState<string>("");
  const [tablaAbierta, setTablaAbierta] = useState(false);

  const fechaHoy  = fechaSel || fechas?.[0] || "";

  // Referencia "mes anterior": último snapshot disponible del mes calendario anterior.
  // Si importaste el último día hábil de ese mes, ese queda como baseline automático.
  const { fechaAnt, mesPrevKey } = useMemo(() => {
    if (!fechas || !fechaHoy) return { fechaAnt: "", mesPrevKey: "" };
    const [y, m] = fechaHoy.split("-").map(Number);
    const py = m === 1 ? y! - 1 : y!;
    const pm = m === 1 ? 12 : m! - 1;
    const mesPrev = `${py}-${String(pm).padStart(2, "0")}`;
    // fechas está ordenado descendente → primer match es el más reciente del mes anterior
    const best = fechas.find(f => f.startsWith(mesPrev)) ?? "";
    return { fechaAnt: best, mesPrevKey: mesPrev };
  }, [fechas, fechaHoy]);

  const { data: kpis,     isLoading } = useKpiSnapshotMultipais(fechaHoy);
  const { data: kpisAnt               } = useKpiSnapshotMultipais(fechaAnt);

  const kpiMap    = useMemo(() => { const m = new Map<string, KpiDiario>(); if (kpis)    for (const k of kpis)    m.set(k.pais, k); return m; }, [kpis]);
  const kpiAntMap = useMemo(() => { const m = new Map<string, KpiDiario>(); if (kpisAnt) for (const k of kpisAnt) m.set(k.pais, k); return m; }, [kpisAnt]);

  const region    = kpiMap.get("Región");
  const regionAnt = kpiAntMap.get("Región");

  if (fechasLoading) return <Layout><div className="card" style={{ padding: 20 }}>Cargando…</div></Layout>;

  if (!fechas || fechas.length === 0) {
    return (
      <Layout>
        <div className="card" style={{ padding: 24, background: "#FFFBEB", border: "1px solid #FDE68A", maxWidth: 560 }}>
          <div className="card-eyebrow">Sin datos diarios</div>
          <div style={{ marginTop: 10, fontSize: 14, color: "#92400E", lineHeight: 1.6 }}>
            Importá el archivo diario desde <strong>/importar</strong> en modo <strong>Diario</strong>.
          </div>
        </div>
      </Layout>
    );
  }

  // Deltas para tarjetas
  const deltaRet     = region && regionAnt ? region.pctRetenido - regionAnt.pctRetenido : null;
  const deltaChurnB  = region && regionAnt ? region.churnBruto  - regionAnt.churnBruto  : null;
  const deltaChurnN  = region && regionAnt ? region.churnNeto   - regionAnt.churnNeto   : null;
  const deltaActivas = region && regionAnt ? ((region.activas - regionAnt.activas) / (regionAnt.activas || 1)) * 100 : null;

  const retTone = region == null ? undefined
    : region.pctRetenido >= 97 ? "green"
    : region.pctRetenido < 94  ? "red"
    : undefined;

  const antLabel = fechaAnt
    ? `vs ${fechaAnt} (último snapshot de ${mesPrevKey})`
    : `vs mes anterior`;

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: fechaAnt ? 12 : 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>
            Retención <span className="alt">/ snapshot diario</span>
          </h1>
          <p className="fs-12 muted" style={{ marginTop: 4 }}>
            {fechas.length} snapshot{fechas.length !== 1 ? "s" : ""} · Región
            {fechaAnt
              ? <span style={{ marginLeft: 8, opacity: 0.7 }}>baseline: <strong>{fechaAnt}</strong> (último snapshot de {mesPrevKey})</span>
              : <span style={{ marginLeft: 8, color: "var(--amber, #B45309)", opacity: 0.8 }}>⚠ Sin snapshot del mes anterior para comparar</span>
            }
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="fs-12 muted">Fecha:</span>
          <select value={fechaHoy} onChange={e => setFechaSel(e.target.value)}
            style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontFamily: "inherit", fontWeight: 500 }}>
            {fechas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* ── Banner: último día hábil ── */}
      {!fechaAnt && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12.5, color: "#92400E", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span>
            <strong>Tip: baseline mensual.</strong> Para que el "vs mes anterior" funcione, importá el <code>base_hubspot</code> el <strong>último día hábil de cada mes</strong> en modo Diario. Ese snapshot queda como referencia automática para todos los días del mes siguiente.
          </span>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="fs-12 muted">Calculando métricas…</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          {/* Principal — % Retención */}
          <div className="card" style={{
            padding: "22px 28px", minWidth: 220, flex: "0 0 auto",
            borderLeft: `4px solid ${retTone === "green" ? "#16A34A" : retTone === "red" ? "#DC2626" : "var(--orange)"}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-3)", marginBottom: 2 }}>
              % Retención
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 10 }}>Región · {fechaHoy}</div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: retTone === "green" ? "#16A34A" : retTone === "red" ? "#DC2626" : "var(--ink)", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
              {region ? pct(region.pctRetenido) : "—"}
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, minHeight: 22 }}>
              {deltaRet != null ? (
                <>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: deltaRet > 0 ? "#16A34A" : deltaRet < 0 ? "#DC2626" : "var(--ink-3)",
                  }}>
                    {deltaRet > 0 ? "▲ +" : deltaRet < 0 ? "▼ " : "= "}{Math.abs(deltaRet).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{antLabel}</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>
                  Sin snapshot anterior — importá más fechas para ver tendencia
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-4)" }}>
              {region ? `${fmt(region.activas)} activas · base ${fmt(region.mpcsMesPasado)}` : ""}
            </div>
          </div>

          {/* Churn Bruto */}
          <KpiCard
            label="Churn Bruto"
            sub={`Proyectado · ${fechaHoy}`}
            value={region ? pct2(region.churnBruto) : "—"}
            delta={deltaChurnB != null ? -deltaChurnB : null}
            deltaLabel={antLabel}
            tone={region == null ? undefined : region.churnBruto > 7 ? "red" : region.churnBruto < 3 ? "green" : undefined}
          />

          {/* Churn Neto */}
          <KpiCard
            label="Churn Neto"
            sub={`Proyectado · ${fechaHoy}`}
            value={region ? pct2(region.churnNeto) : "—"}
            delta={deltaChurnN != null ? -deltaChurnN : null}
            deltaLabel={antLabel}
            tone={region == null ? undefined : region.churnNeto > 7 ? "red" : region.churnNeto < 3 ? "green" : undefined}
          />

          {/* Cuentas activas */}
          <KpiCard
            label="Cuentas Activas"
            sub="Estado Activo"
            value={region ? fmt(region.activas) : "—"}
            delta={deltaActivas}
            deltaLabel={antLabel}
          />

          {/* A Recuperar */}
          <KpiCard
            label="A Recuperar"
            sub="Engagement + Onboarding"
            value={region ? fmt(region.aRecuperar) : "—"}
          />
        </div>
      )}

      {/* ── Tabla colapsable ── */}
      <div className="card lg" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header de la tabla con toggle */}
        <button
          onClick={() => setTablaAbierta(v => !v)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", textAlign: "left",
            borderBottom: tablaAbierta ? "1px solid var(--rule)" : "none",
          }}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Tabla detallada — todos los países</span>
            <span style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 10 }}>{METRICAS.length} métricas · {PAISES_COLS.length} países</span>
          </div>
          <span style={{ fontSize: 16, color: "var(--ink-3)", transition: "transform 0.2s", transform: tablaAbierta ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </button>

        {tablaAbierta && (
          isLoading ? (
            <div className="fs-12 muted" style={{ padding: 24 }}>Calculando métricas para todos los países…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--paper-2)" }}>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 500, fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5, minWidth: 240, position: "sticky", left: 0, background: "var(--paper-2)", borderRight: "2px solid var(--rule)" }}>
                      Métrica
                    </th>
                    {PAISES_COLS.map(p => (
                      <th key={p} style={{ padding: "12px 20px", textAlign: "right", fontSize: 13, fontWeight: p === "Región" ? 700 : 500, color: p === "Región" ? "var(--orange)" : "var(--ink)", minWidth: 120, borderLeft: "1px solid var(--rule)" }}>
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
                            <td colSpan={PAISES_COLS.length + 1} style={{ padding: "10px 20px 4px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--ink-4)", fontWeight: 600, background: "var(--paper-2)", borderTop: "2px solid var(--rule)" }}>
                              {m.group}
                            </td>
                          </tr>
                        )}
                        <tr key={m.label} style={{ borderTop: "1px solid var(--rule)" }}>
                          <td style={{ padding: "10px 20px", color: m.label.startsWith("  ·") ? "var(--ink-3)" : "var(--ink-2)", fontSize: m.label.startsWith("  ·") ? 11.5 : 12.5, position: "sticky", left: 0, background: "var(--paper)", borderRight: "2px solid var(--rule)" }}>
                            {m.label.startsWith("  ·") ? m.label.replace("  ·", "↳") : m.label}
                          </td>
                          {PAISES_COLS.map(p => {
                            const k = kpiMap.get(p);
                            const val = k ? m.get(k) : "—";
                            const tone = k ? (m.highlight?.(k) ?? null) : null;
                            return (
                              <td key={p} style={{ padding: "10px 20px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: tone === "red" ? "#DC2626" : tone === "green" ? "#16A34A" : p === "Región" ? "var(--ink)" : "var(--ink-2)", fontWeight: tone ? 700 : p === "Región" ? 600 : 400, background: tone === "red" ? "rgba(220,38,38,0.04)" : tone === "green" ? "rgba(22,163,74,0.04)" : undefined, borderLeft: "1px solid var(--rule)" }}>
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
          )
        )}
      </div>

      <DiagPanel fechaHoy={fechaHoy} />

      <div className="fs-11 muted" style={{ marginTop: 12 }}>
        Importá cada día desde <strong>/importar</strong> en modo Diario para acumular historial.
      </div>
    </Layout>
  );
}
