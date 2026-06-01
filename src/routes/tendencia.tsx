import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { ORANGE } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import { useDerived } from "@/data/derived";
import { useMotivosMes, useResumenMes, useMesActivo } from "@/data/dataset-store";
import { useSupabaseChurnInsights } from "@/data/supabase-churn-insights";
import { SegmentacionChurn } from "@/components/SegmentacionChurn";
import { useRetention } from "@/data/supabase-retention";
import { useCountry } from "@/contexts/CountryContext";
import { usePeriod } from "@/contexts/PeriodContext";
import { mesLargo } from "@/data/schema";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Area, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ErrorBar, Cell,
  Line, ReferenceLine, Legend,
} from "recharts";
import { MOTIVO_CATS, MOTIVO_COLORS, AREA_ESTRATEGICA } from "@/lib/motivo-normalizer";
import { PLANES } from "@/data/supabase-trend";
import { useSnapshot } from "@/data/supabase-snapshot";
import { mesCorto } from "@/data/schema";

const PLAN_COLORS: Record<string, string> = {
  "Inicial":   "#2563EB",
  "Avanzado":  "#D97706",
  "Pro":       "#7C3AED",
};



export const Route = createFileRoute("/tendencia")({
  head: () => ({ meta: [{ title: "Tendencia · Churn Hub" }] }),
  component: Tendencia,
});
const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctfmt = (n: number, d = 2) => `${n.toFixed(d)}%`;

const CSV_HEADERS = [
  "id_hubspot", "id_cuenta_dash", "nombre", "pais", "plan", "ejecutivo",
  "fecha_baja", "motivo_baja", "submotivo_baja", "comentarios_metabase",
] as const;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportBajasConMotivo(mesActivo: string): Promise<number> {
  const PAGE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("clientes")
      .select(CSV_HEADERS.join(","))
      .eq("mes_exportacion", mesActivo)
      .eq("estado_dash", "Bloqueado")
      .not("motivo_baja", "is", null)
      .not("fecha_baja", "is", null)
      .order("fecha_baja", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(CSV_HEADERS.map((h) => csvEscape((r as any)[h])).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bajas_con_motivo_${mesActivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}

function Tendencia() {
  const [exporting, setExporting] = useState(false);
  const { motivosBaja } = useDashboardData();

  const d = useDerived();
  const motivos = useMotivosMes();
  const resumen = useResumenMes();
  const mesActivo = useMesActivo();
  const { selectedPeriod } = usePeriod();
  const { selectedPais } = useCountry();
  const { data: insights6m } = useSupabaseChurnInsights(mesActivo, selectedPais);
  const { data: ret } = useRetention(selectedPeriod, selectedPais);
  const { data: snapshotRows, isLoading: snapshotLoading } = useSnapshot(selectedPeriod, selectedPais);

  // Marcador "hoy" en el gráfico
  const hoyLabel = mesCorto(new Date().toISOString().slice(0, 7));

  // Estado de búsqueda del snapshot
  const [snapshotQ, setSnapshotQ] = useState("");
  const [snapshotPlan, setSnapshotPlan] = useState<string>("Todos");
  const snapshotFiltered = (snapshotRows ?? []).filter((r) => {
    const qOk = !snapshotQ || [r.nombre, r.pais, r.id_hubspot, r.motivoCat, r.ejecutivo]
      .some(v => v.toLowerCase().includes(snapshotQ.toLowerCase()));
    const planOk = snapshotPlan === "Todos" || r.plan === snapshotPlan;
    return qOk && planOk;
  });

  // Motivos de baja (últimos 6 meses, excluyendo NPS)
  const PALETTE = ["#6B7280", "#2563EB", "#D97706", "#F05A28", "#7C3AED", "#DB2777", "#0D9488", "#16A34A", "#9333EA", "#0EA5E9"];
  const prioridadFor = (m: string): string => {
    const t = m.toLowerCase();
    if (/sin (motivo|respuesta)/.test(t)) return "CRÍTICA";
    if (/cierre temporal|dej(ó|o) de usar|precio|mal servicio|falta/.test(t)) return "ALTA";
    if (/eligi(ó|o) otro/.test(t)) return "Estrat.";
    return "Media";
  };
  const motivosLive = useMemo(() => {
    if (!insights6m) return null;
    const filtered = insights6m.rows.filter((r) => !/nps/i.test(r.motivo));
    const map = new Map<string, number>();
    for (const r of filtered) map.set(r.motivo, (map.get(r.motivo) ?? 0) + 1);
    const total = filtered.length || 1;
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    let palIdx = 0;
    return sorted.map(([motivo, n]) => {
      const brecha = /sin (motivo|respuesta)/i.test(motivo);
      return {
        motivo,
        n,
        pct: +((n / total) * 100).toFixed(1),
        color: brecha ? "#DC2626" : PALETTE[palIdx++ % PALETTE.length]!,
        brecha,
        prioridad: prioridadFor(motivo),
        accionable: "—",
      };
    });
  }, [insights6m]);

  const motivosDisplay = motivosLive ?? motivosBaja;
  const totalCategorizadasDisplay = motivosDisplay.reduce((s, m) => s + m.n, 0);
  const sinMotivoRow = motivosDisplay.find((m) => m.brecha) ?? motivosDisplay[0];
  const pctSinMotivoDisplay = sinMotivoRow ? (sinMotivoRow.n / (totalCategorizadasDisplay || 1)) * 100 : 0;

  const sinMotivo = d.sinMotivo ?? motivosBaja[0];
  const hasData = !!resumen || (motivos !== null);


  // Tendencia rate-based: cada fila trae bajas, rate%, activeBase y banda min/max.
  const chartData = d.trendRate.points.map((p) => ({
    mes: p.proyectado ? `${p.mes}*` : p.mes,
    key: p.key,
    bajas: p.bajas,
    rate: p.rate,
    activeBase: p.activeBase,
    proyectado: p.proyectado,
    bajasMin: p.bajasMin ?? null,
    bajasMax: p.bajasMax ?? null,
    rangoY: p.bajasMin != null && p.bajasMax != null ? [p.bajasMin, p.bajasMax] : null,
    bajasError: p.bajasError ?? null,
  }));
  const forecastX = chartData.filter((x) => x.proyectado).map((x) => x.mes);

  const firstProj = d.trendRate.projected[0] ?? null;
  const latestRateP = d.trendRate.closed[d.trendRate.closed.length - 1] ?? null;
  const prevRateP = d.trendRate.closed[d.trendRate.closed.length - 2] ?? null;

  // Std dev de las últimas 6 tasas cerradas (en pp).
  const last6Rates = d.trendRate.closed.slice(-6).map((p) => p.rate);
  const sixStdDev = (() => {
    if (last6Rates.length < 2) return 0;
    const mean = last6Rates.reduce((s, v) => s + v, 0) / last6Rates.length;
    return Math.sqrt(last6Rates.reduce((s, v) => s + (v - mean) ** 2, 0) / last6Rates.length);
  })();

  // Proyección 3 meses compuesta (ya viene compuesta en projected).
  const proj3 = d.trendRate.projected.slice(0, 3);
  const proj3Total = proj3.reduce((s, p) => s + p.bajas, 0);

  // IC ±1.5σ sobre tasa WMA aplicado a base del primer mes proyectado.
  const wma = d.wmaRate ?? 0;
  const ciBase = firstProj?.activeBase ?? d.activeAccounts ?? 0;
  const ciLowRate = Math.max(0, wma - 1.5 * sixStdDev);
  const ciHighRate = wma + 1.5 * sixStdDev;
  const ciCenter = Math.max(0, Math.round((ciBase * wma) / 100));
  const ciMin = Math.max(0, Math.round((ciBase * ciLowRate) / 100));
  const ciMax = Math.max(0, Math.round((ciBase * ciHighRate) / 100));
  const variabilityLabel =
    sixStdDev > 0.8 ? "Alta variabilidad" :
    sixStdDev < 0.4 ? "Baja variabilidad — pronóstico confiable" :
    "Variabilidad moderada";

  const Info = ({ tip }: { tip: string }) => (
    <span
      title={tip}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--rule)",
        fontSize: 10, color: "var(--ink-3)", cursor: "help", marginLeft: 6,
      }}
    >ⓘ</span>
  );

  return (
    <Layout actions={
      <ExportButton
        filename="tendencia-churn.xlsx"
        sheets={[
          { name: "Tendencia mensual", rows: chartData },
          { name: "Motivos de baja", rows: motivosDisplay },
        ]}
      />
    }>
      {!hasData ? (
        <EmptyPeriod section="Tendencia mensual" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      {/* Fila 1 — Churn Rate · 4 tarjetas */}
      <div className="bento cols-4" style={{ marginBottom: 20 }}>

        {/* Card 1 — Monthly Churn Rate */}
        <div className="card">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center" }}>
            Monthly Churn Rate
            <Info tip="Bajas del mes en curso / cuentas activas al inicio del mes. El badge muestra la variación vs el mes anterior en puntos porcentuales." />
          </div>
          <div className="bignum" style={{ marginTop: 8 }}>
            {latestRateP ? pctfmt(latestRateP.rate) : "—"}
          </div>
          <div className="fs-12 muted" style={{ marginTop: 6 }}>
            {latestRateP
              ? <>{nfmt(latestRateP.bajas)} bajas · {latestRateP.mes}</>
              : "sin datos"}
          </div>
          {d.monthDeltaRatePts !== null && (
            <div style={{ marginTop: 10 }}>
              <span className={`tag ${d.monthDeltaRatePts > 0 ? "red" : "blue"}`}>
                {d.monthDeltaRatePts >= 0 ? "+" : ""}{d.monthDeltaRatePts.toFixed(2)} pts vs ant.
              </span>
            </div>
          )}
        </div>

        {/* Card 2 — WMA Projected Rate */}
        <div className="card orange">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.85)" }}>
            WMA Projected Rate
            <Info tip="Promedio ponderado móvil de las últimas 3 tasas mensuales (pesos 50% / 30% / 20%). Suaviza picos atípicos para estimar el próximo mes." />
          </div>
          <div className="bignum" style={{ marginTop: 8 }}>
            {firstProj ? pctfmt(firstProj.rate) : d.wmaRate !== null ? pctfmt(d.wmaRate) : "—"}
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
            {firstProj ? <>proy. {firstProj.mes} · ≈ {nfmt(firstProj.bajas)} bajas</> : "sin proyección"}
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            suaviza picos (50/30/20)
          </div>
        </div>

        {/* Card 3 — Projected Churns (3 meses, compuesto) */}
        <div className="card">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center" }}>
            Projected 3m (compuesto)
            <Info tip="Aplica la tasa WMA mes a mes sobre la base activa remanente del mes anterior (no sobre la base actual fija). Total = suma de los 3 meses proyectados." />
          </div>
          <div className="bignum" style={{ marginTop: 8 }}>{nfmt(proj3Total)}</div>
          <div className="fs-12 muted" style={{ marginTop: 6 }}>
            próximos 3 meses · tasa {pctfmt(wma)}
          </div>
          {proj3.length > 0 && (
            <div className="fs-12 muted mono" style={{ marginTop: 8, lineHeight: 1.5 }}>
              {proj3.map((p) => (
                <div key={p.key} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{p.mes}</span>
                  <span>base {nfmt(p.activeBase)} · {nfmt(p.bajas)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 4 — Confidence Interval */}
        <div className="card ink">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
            Confidence Interval
            <Info tip="Desvío estándar de las últimas 6 tasas mensuales. Rango = tasa WMA ± 1.5 × σ, expresado en bajas absolutas sobre la base del próximo mes." />
          </div>
          <div className="bignum" style={{ marginTop: 8 }}>
            {nfmt(ciMin)}–{nfmt(ciMax)}
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
            centro {nfmt(ciCenter)} · σ₆ ±{sixStdDev.toFixed(2)} pts
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            tasa {pctfmt(ciLowRate)}–{pctfmt(ciHighRate)}
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="callout" style={{
              background: sixStdDev > 0.8 ? "rgba(220,38,38,0.25)" : sixStdDev < 0.4 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.12)",
              color: "white",
            }}>
              {variabilityLabel}
            </span>
          </div>
        </div>
      </div>



      {/* Segmentación */}
      <SegmentacionChurn />

      {/* Gráfico SUPERIOR — Churn Rate % por mes + líneas por plan (métrica primaria) */}
      <div className="card lg">
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Evolución del Churn Rate mensual · por plan</div>
            <div className="card-title">Porcentaje de bajas sobre base activa · últimos 12 meses</div>
          </div>
          {d.seriesGrowthLabel && <span className="callout orange">↑ {d.seriesGrowthLabel}</span>}
        </div>
        <div className="chart-wrap" style={{ height: 320, position: "relative" }}>
          <ResponsiveContainer>
            <ComposedChart
              data={chartData.filter(p => !p.proyectado).map(p => ({
                mes: p.mes,
                rate: p.rate,
                bajas: p.bajas,
                activeBase: p.activeBase,
                ...Object.fromEntries(
                  PLANES.map(pl => [`rate_${pl}`, (p as any).planRates?.[pl] ?? null])
                ),
              }))}
              margin={{ top: 32, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(value: any, name: any, item: any) => {
                  const row = item?.payload ?? {};
                  if (name === "rate") return [`${Number(value).toFixed(2)}% (${nfmt(row.bajas)} bajas)`, "Total"];
                  const plan = String(name).replace("rate_", "");
                  return [`${Number(value).toFixed(2)}%`, plan];
                }}
              />
              <Legend formatter={(v) => v === "rate" ? "Total" : v.replace("rate_", "")} />
              {/* Marcador "hoy" */}
              <ReferenceLine x={hoyLabel} stroke="var(--orange)" strokeDasharray="4 3" label={{ value: "hoy", position: "top", fill: "var(--orange)", fontSize: 11 }} />
              {/* Barras totales */}
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={28} fill={ORANGE} fillOpacity={0.35}>
                <LabelList dataKey="rate" position="top" style={{ fontSize: 10, fill: "#0B0B0A", fontWeight: 500 }} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
              </Bar>
              {/* Líneas por plan */}
              {PLANES.map(plan => (
                <Line
                  key={plan}
                  type="monotone"
                  dataKey={`rate_${plan}`}
                  stroke={PLAN_COLORS[plan]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: PLAN_COLORS[plan] }}
                  connectNulls
                  name={`rate_${plan}`}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {d.wmaRate !== null && (
          <div className="fs-12 muted" style={{ marginTop: 10 }}>
            WMA 3 meses: <strong>{pctfmt(d.wmaRate)}</strong> · stdDev ±{d.rateStdDev.toFixed(2)} pts · base actual {nfmt(d.activeAccounts)}
          </div>
        )}
      </div>

      {/* Gráfico INFERIOR — Composición % de motivos (100% stacked) */}
      <div className="card lg" style={{ marginTop: 16 }}>
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Composición de motivos de baja · % sobre total de bajas</div>
            <div className="card-title">Referencia — proporción de cada causa por mes</div>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: 280, position: "relative" }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData.filter(p => !p.proyectado).map(p => {
                const bd = (p as any).motivoBreakdown ?? {};
                const total = MOTIVO_CATS.reduce((s, c) => s + (bd[c] ?? 0), 0) || 1;
                const row: Record<string, unknown> = { mes: p.mes, _total: p.bajas };
                for (const cat of MOTIVO_CATS) {
                  row[cat] = +((( bd[cat] ?? 0) / total) * 100).toFixed(1);
                }
                return row;
              })}
              margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(v: any, name: any, item: any) => {
                  const total = item?.payload?._total ?? 0;
                  const abs = Math.round(Number(v) * (total as number) / 100);
                  return [`${Number(v).toFixed(1)}% (${nfmt(abs)})`, name];
                }}
                labelFormatter={(label: any, payload: any) =>
                  `${label} · ${nfmt(payload?.[0]?.payload?._total ?? 0)} bajas totales`
                }
              />
              {MOTIVO_CATS.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="motivo" fill={MOTIVO_COLORS[cat]}
                  radius={i === MOTIVO_CATS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Leyenda de colores */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 12 }}>
          {MOTIVO_CATS.map((cat) => (
            <span key={cat} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: MOTIVO_COLORS[cat], flexShrink: 0 }} />
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Gráfico — Churn Bruto · Neto · Recuperadas */}
      <div className="card lg" style={{ marginTop: 16 }}>
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Churn Bruto · Neto · Recuperadas</div>
            <div className="card-title">Evolución mensual · últimos 12 meses</div>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart
              data={chartData.filter(p => !p.proyectado).map(p => ({
                mes: p.mes,
                rateBruto: p.rate,
                rateNeto: (p as any).rateNeto ?? null,
                ratioRecuperadas: (p as any).ratioRecuperadas ?? null,
              }))}
              margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(v: any, name: any) => {
                  const labels: Record<string, string> = {
                    rateBruto: "Churn Bruto",
                    rateNeto: "Churn Neto",
                    ratioRecuperadas: "Recuperadas",
                  };
                  return [`${Number(v).toFixed(2)}%`, labels[name as string] ?? name];
                }}
              />
              <Legend formatter={(v) =>
                ({ rateBruto: "Churn Bruto", rateNeto: "Churn Neto", ratioRecuperadas: "Recuperadas" } as Record<string,string>)[v] ?? v
              } />
              <Bar dataKey="ratioRecuperadas" fill="#16A34A" fillOpacity={0.55} barSize={18} radius={[4, 4, 0, 0]} name="ratioRecuperadas" />
              <Line type="monotone" dataKey="rateBruto" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3, fill: ORANGE }} name="rateBruto" connectNulls />
              <Line type="monotone" dataKey="rateNeto" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: "#2563EB" }} strokeDasharray="5 3" name="rateNeto" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="fs-12 muted" style={{ marginTop: 10 }}>
          Bruto = bajas / base inicio mes · Neto = caída neta de activas · Recuperadas = bruto − neto (cuentas que volvieron al activo)
        </div>
      </div>


      {/* Divider */}
      <div className="divider">
        <span className="kicker">Motivos</span>
        <span className="alt">· de baja</span>
        <span className="sub">brecha de atribución {pctSinMotivoDisplay.toFixed(1)}%</span>
        <span className="rule" />
      </div>

      {/* Tabla full-width con área estratégica */}
      <div className="card lg">
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Detalle por motivo</div>
            <div className="card-title">{nfmt(totalCategorizadasDisplay)} bajas categorizadas · brecha atribución {pctSinMotivoDisplay.toFixed(1)}%</div>
          </div>
          <button
            className="btn"
            disabled={exporting}
            onClick={async () => {
              try {
                setExporting(true);
                await exportBajasConMotivo(mesActivo);
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "Exportando…" : "Exportar bajas con ID →"}
          </button>
        </div>
        <table className="tbl" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Motivo</th>
              <th>Área estratégica</th>
              <th style={{ textAlign: "right" }}>n</th>
              <th style={{ textAlign: "right" }}>%</th>
              <th>Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {motivosDisplay.map((m) => {
              const area = AREA_ESTRATEGICA[m.motivo as keyof typeof AREA_ESTRATEGICA] ?? "Sin clasificar";
              const color = MOTIVO_COLORS[m.motivo as keyof typeof MOTIVO_COLORS] ?? m.color;
              const prioTag =
                m.prioridad === "CRÍTICA" ? "red" :
                m.prioridad === "ALTA" ? "orange" :
                m.prioridad === "Media" ? "amber" : "blue";
              return (
                <tr key={m.motivo} className={m.brecha ? "row-alert" : ""}>
                  <td className="strong" style={{ color: m.brecha ? "#DC2626" : undefined }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="tier-dot" style={{ background: color }} />
                      {m.motivo}
                      {m.brecha && <span className="tag red" style={{ marginLeft: 4 }}>BRECHA CRÍTICA</span>}
                    </div>
                  </td>
                  <td className="fs-12" style={{ color: "var(--ink-3)" }}>{area}</td>
                  <td className="mono strong" style={{ textAlign: "right" }}>{m.n.toLocaleString()}</td>
                  <td className="mono" style={{ textAlign: "right", color: m.brecha ? "#DC2626" : undefined }}>{m.pct}%</td>
                  <td><span className={`tag ${prioTag}`}>{m.prioridad}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="fs-12 muted" style={{ marginTop: 14 }}>
          {(sinMotivoRow?.n ?? 0).toLocaleString()} bajas sin razón registrada · export incluye id_hubspot para acciones directas.
        </div>
      </div>

      {/* ── Snapshot de cuentas dadas de baja ── */}
      <div className="divider">
        <span className="kicker">Snapshot</span>
        <span className="alt">/ cuentas dadas de baja · {selectedPais}</span>
        <span className="sub">{snapshotRows ? `${nfmt(snapshotRows.length)} cuentas` : ""}</span>
        <span className="rule" />
      </div>

      <div className="card lg">
        <div className="minihead" style={{ marginBottom: 14 }}>
          <div>
            <div className="card-eyebrow">Detalle por cuenta</div>
            <div className="card-title">Todas las bajas del período · filtrable</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={snapshotPlan}
              onChange={e => setSnapshotPlan(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 12.5, fontFamily: "inherit" }}
            >
              <option value="Todos">Todos los planes</option>
              {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              value={snapshotQ}
              onChange={e => setSnapshotQ(e.target.value)}
              placeholder="Buscar nombre, país, motivo…"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 12.5, fontFamily: "inherit", width: 220 }}
            />
          </div>
        </div>
        {snapshotLoading ? (
          <div className="fs-12 muted">Cargando cuentas…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>ID HubSpot</th>
                  <th>País</th>
                  <th>Plan</th>
                  <th>Fecha baja</th>
                  <th style={{ textAlign: "right" }}>Días</th>
                  <th>Motivo</th>
                  <th>Ejecutivo</th>
                </tr>
              </thead>
              <tbody>
                {snapshotFiltered.slice(0, 200).map((r, i) => (
                  <tr key={`${r.id_hubspot}-${i}`}>
                    <td className="strong">{r.nombre}</td>
                    <td className="mono fs-11" style={{ color: "var(--ink-3)" }}>{r.id_hubspot}</td>
                    <td>{r.pais}</td>
                    <td><span className="tag outline">{r.plan}</span></td>
                    <td className="mono">{r.fecha_baja ?? "—"}</td>
                    <td className="mono" style={{ textAlign: "right", color: r.diasDesdeBaja != null && r.diasDesdeBaja > 30 ? "var(--red)" : "var(--ink-2)" }}>
                      {r.diasDesdeBaja != null ? r.diasDesdeBaja : "—"}
                    </td>
                    <td>
                      <span className="fs-11" style={{ color: "var(--ink-2)" }}>{r.motivoCat}</span>
                    </td>
                    <td className="fs-11 muted">{r.ejecutivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshotFiltered.length > 200 && (
              <div className="fs-12 muted" style={{ marginTop: 10, textAlign: "center" }}>
                Mostrando 200 de {nfmt(snapshotFiltered.length)} — exportá para ver todas
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Actividad operativa ── */}
      {ret && (
        <>
        <div className="divider">
          <span className="kicker">Actividad</span>
          <span className="alt">/ operativa · {selectedPais}</span>
          <span className="rule" />
        </div>

        {/* Fila KPIs operativos */}
        <div className="bento cols-4">
          <div className="card">
            <div className="card-eyebrow">Activas ≥10 ventas/mes</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{nfmt(ret.activasConVentas)}</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>{ret.pctActivasConVentas.toFixed(1)}% de activas</div>
          </div>
          <div className="card">
            <div className="card-eyebrow">Login &lt;7 días</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{nfmt(ret.loginMenos7)}</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>{ret.pctLoginMenos7.toFixed(1)}% de activas</div>
          </div>
          <div className="card">
            <div className="card-eyebrow">A Recuperar</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{nfmt(ret.aRecuperar)}</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>Engagement + Onboarding</div>
            <div className="fs-12 muted">{nfmt(ret.aRecuperarConVentas)} con ≥10 ventas</div>
          </div>
          <div className="card">
            <div className="card-eyebrow">MPCs mes pasado</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{nfmt(ret.mpcsMesPasado)}</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>base para cálculo de churn</div>
          </div>
        </div>

        {/* Login distribución */}
        <div className="card lg" style={{ marginTop: 16 }}>
          <div className="card-eyebrow">Distribución por último login</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Actividad reciente de cuentas activas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ret.loginDist.map((l) => (
              <div key={l.label} style={{ display: "grid", gridTemplateColumns: "160px 1fr 60px 50px", alignItems: "center", gap: 12, fontSize: 12 }}>
                <span style={{ color: "var(--ink-2)" }}>{l.label}</span>
                <div style={{ height: 8, background: "var(--paper-2)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${l.pct}%`, height: "100%", background: "var(--orange)", borderRadius: 99 }} />
                </div>
                <span className="mono" style={{ textAlign: "right", color: "var(--ink)" }}>{nfmt(l.n)}</span>
                <span className="mono muted" style={{ textAlign: "right" }}>{l.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
        </>
      )}
      </>
      )}
    </Layout>
  );
}
