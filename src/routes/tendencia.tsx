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

// Columnas calculadas que se agregan al export (no vienen de Supabase)
const CSV_CALC_HEADERS = ["hoy", "dias_desde_baja"] as const;

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

  // "hoy" fijo para toda la exportaci\u00F3n \u2014 referencia temporal consistente
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().slice(0, 10); // YYYY-MM-DD

  const allHeaders = [...CSV_HEADERS, ...CSV_CALC_HEADERS];
  const lines = [allHeaders.join(",")];
  for (const r of rows) {
    const diasDesdeBaja = r.fecha_baja
      ? Math.floor((hoy.getTime() - new Date(r.fecha_baja).getTime()) / 86_400_000)
      : "";
    const calcValues: Record<string, unknown> = {
      hoy: fechaHoy,
      dias_desde_baja: diasDesdeBaja,
    };
    lines.push(allHeaders.map((h) =>
      csvEscape(h in calcValues ? calcValues[h] : (r as any)[h])
    ).join(","));
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
  const { data: insights6m } = useSupabaseChurnInsights(mesActivo, selectedPais);
  const { selectedPeriod } = usePeriod();
  const { selectedPais } = useCountry();
  const { data: ret } = useRetention(selectedPeriod, selectedPais);
  const { data: snapshotRows, isLoading: snapshotLoading } = useSnapshot(selectedPeriod, selectedPais);

  // Marcador "hoy" en el gráfico
  const hoyLabel = mesCorto(new Date().toISOString().slice(0, 7));

  // Estado de búsqueda del snapshot
  const [snapshotQ, setSnapshotQ] = useState("");
  const [snapshotPlan, setSnapshotPlan] = useState<string>("Todos");
  const [snapshotPage, setSnapshotPage] = useState(0);
  const SNAPSHOT_PAGE_SIZE = 10;

  const snapshotFiltered = useMemo(() => {
    const filtered = (snapshotRows ?? []).filter((r) => {
      const qOk = !snapshotQ || [r.nombre, r.pais, r.id_hubspot, r.motivoCat, r.ejecutivo]
        .some(v => v.toLowerCase().includes(snapshotQ.toLowerCase()));
      const planOk = snapshotPlan === "Todos" || r.plan === snapshotPlan;
      return qOk && planOk;
    });
    // Ordenar: con fecha_baja primero (más reciente → más antigua), luego sin fecha
    return filtered.sort((a, b) => {
      if (!a.fecha_baja && !b.fecha_baja) return 0;
      if (!a.fecha_baja) return 1;
      if (!b.fecha_baja) return -1;
      return b.fecha_baja.localeCompare(a.fecha_baja);
    });
  }, [snapshotRows, snapshotQ, snapshotPlan]);

  const snapshotTotalPages = Math.max(1, Math.ceil(snapshotFiltered.length / SNAPSHOT_PAGE_SIZE));
  const snapshotPageRows = snapshotFiltered.slice(
    snapshotPage * SNAPSHOT_PAGE_SIZE,
    (snapshotPage + 1) * SNAPSHOT_PAGE_SIZE
  );

  // Motivos de baja (últimos 6 meses) — agrupados por categoría normalizada
  const prioridadFor = (cat: string): string => {
    if (cat === "Sin motivo")                    return "CRÍTICA";
    if (cat === "Precio" || cat === "Cierre temporal" ||
        cat === "Servicio" || cat === "Producto / Funcionalidades") return "ALTA";
    if (cat === "Eligió otro sistema")            return "Estrat.";
    return "Media";
  };
  const motivosLive = useMemo(() => {
    if (!insights6m) return null;
    const filtered = insights6m.rows.filter((r) => !/nps/i.test(r.motivo));
    // Normalizar cada fila a su categoría canónica antes de agrupar
    const map = new Map<string, number>();
    for (const r of filtered) {
      const cat = normalizarMotivo(r.motivo, null, null, null);
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    const total = filtered.length || 1;
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.map(([motivo, n]) => {
      const brecha = motivo === "Sin motivo";
      return {
        motivo,
        n,
        pct: +((n / total) * 100).toFixed(1),
        color: MOTIVO_COLORS[motivo as keyof typeof MOTIVO_COLORS] ?? "#9CA3AF",
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


  // Tendencia rate-based: incluye todos los campos de TrendRatePoint necesarios para los gráficos.
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
    // Campos para gráficos de motivos y neto/recuperadas
    motivoBreakdown: p.motivoBreakdown ?? {},
    planRates: p.planRates ?? {},
    rateNeto: p.rateNeto ?? null,
    ratioRecuperadas: p.ratioRecuperadas ?? null,
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

        {/* Card 3 — Projected Rate (3 meses) */}
        <div className="card">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center" }}>
            Tasa proyectada · 3m
            <Info tip="Tasa WMA aplicada compuestamente mes a mes sobre la base remanente. El bignum es la tasa %; los absolutos son referencia." />
          </div>
          <div className="bignum" style={{ marginTop: 8 }}>{pctfmt(wma)}</div>
          <div className="fs-12 muted" style={{ marginTop: 6 }}>
            ≈ {nfmt(proj3Total)} bajas · próximos 3 meses
          </div>
          {proj3.length > 0 && (
            <div className="fs-12 muted mono" style={{ marginTop: 8, lineHeight: 1.5 }}>
              {proj3.map((p) => (
                <div key={p.key} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{p.mes}</span>
                  <span>{pctfmt(p.rate, 1)} · {nfmt(p.bajas)} sobre {nfmt(p.activeBase)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 4 — Confidence Interval */}
        <div className="card ink">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
            Rango de confianza
            <Info tip="Tasa WMA ± 1.5 × σ de las últimas 6 tasas. El bignum es el rango en %; los absolutos son referencia sobre la base proyectada." />
          </div>
          <div className="bignum" style={{ marginTop: 8 }}>
            {pctfmt(ciLowRate, 1)}–{pctfmt(ciHighRate, 1)}
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
            ≈ {nfmt(ciMin)}–{nfmt(ciMax)} bajas · centro {nfmt(ciCenter)}
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            σ₆ ±{sixStdDev.toFixed(2)} pts
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
                  PLANES.map(pl => [`rate_${pl}`, p.planRates?.[pl] ?? null])
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
      {/* Barras horizontales rankeadas por motivo — sin leyenda, todo legible de un vistazo */}
      <div className="card lg" style={{ marginTop: 16 }}>
        <div className="minihead" style={{ marginBottom: 4 }}>
          <div>
            <div className="card-eyebrow">Motivos de baja · distribución del período</div>
            <div className="card-title">% sobre total de bajas categorizadas · ordenado por frecuencia</div>
          </div>
          <div className="fs-12 muted">{nfmt(totalCategorizadasDisplay)} bajas · brecha {pctSinMotivoDisplay.toFixed(1)}%</div>
        </div>
        <div style={{ height: motivosDisplay.length * 46 + 24 }}>
          <ResponsiveContainer>
            <BarChart
              data={motivosDisplay.map(m => ({
                motivo: m.motivo,
                pct: m.pct,
                n: m.n,
                color: MOTIVO_COLORS[m.motivo as keyof typeof MOTIVO_COLORS] ?? m.color,
                brecha: m.brecha,
              }))}
              layout="vertical"
              margin={{ top: 8, right: 110, left: 8, bottom: 8 }}
            >
              <XAxis
                type="number" domain={[0, 100]} unit="%" hide
              />
              <YAxis
                type="category" dataKey="motivo" width={190}
                tick={{ fontSize: 12.5, fill: "#2B2B27", fontWeight: 500 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(v: any, _: any, item: any) => [
                  `${Number(v).toFixed(1)}% · ${nfmt(item?.payload?.n ?? 0)} bajas`,
                  item?.payload?.motivo,
                ]}
                cursor={{ fill: "#F2F0E9" }}
              />
              <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={28} isAnimationActive={false}>
                {motivosDisplay.map((m, i) => (
                  <Cell
                    key={i}
                    fill={MOTIVO_COLORS[m.motivo as keyof typeof MOTIVO_COLORS] ?? m.color}
                    fillOpacity={m.brecha ? 1 : 0.82}
                  />
                ))}
                <LabelList
                  content={({ x, y, width, height, value, index }) => {
                    const m = motivosDisplay[index as number];
                    if (!m) return null;
                    const xNum = Number(x ?? 0);
                    const yNum = Number(y ?? 0);
                    const w = Number(width ?? 0);
                    const h = Number(height ?? 0);
                    return (
                      <text
                        x={xNum + w + 8}
                        y={yNum + h / 2 + 1}
                        fontSize={12}
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight={600}
                        fill={m.brecha ? "#DC2626" : "#2B2B27"}
                        dominantBaseline="middle"
                      >
                        {`${Number(value).toFixed(1)}%`}
                        <tspan fontSize={10.5} fontWeight={400} fill="#6E6D66"> ({nfmt(m.n)})</tspan>
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bruto vs Neto — comparación del período actual (datos exactos) + evolución base activa */}
      <div className="card lg" style={{ marginTop: 16 }}>
        <div className="minihead" style={{ marginBottom: 16 }}>
          <div>
            <div className="card-eyebrow">Churn Bruto · Neto · Recuperadas</div>
            <div className="card-title">Período actual · y evolución base activa 12 meses</div>
          </div>
        </div>

        {/* Pills de comparación para el período actual */}
        {ret && ret.mpcsMesPasado > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Churn Bruto", value: ret.churnBruto.toFixed(2) + "%", sub: `${nfmt(ret.mpcsMesPasado - ret.activasHoy - (ret.mpcsMesPasado - ret.activasHoy > 0 ? 0 : 0))} bajas / ${nfmt(ret.mpcsMesPasado)} base`, color: ORANGE },
              { label: "Churn Neto", value: ret.churnNeto.toFixed(2) + "%", sub: `caída neta · ${nfmt(ret.mpcsMesPasado)} → ${nfmt(ret.activasHoy)} activas`, color: "#2563EB" },
              { label: "Recuperadas", value: `${Math.max(0, ret.churnBruto - ret.churnNeto).toFixed(2)}%`, sub: `bruto − neto · cuentas que volvieron al activo`, color: "#16A34A" },
            ].map((p) => (
              <div key={p.label} style={{ background: "var(--paper-2)", borderRadius: 12, padding: "14px 16px", borderLeft: `3px solid ${p.color}` }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-3)", fontWeight: 500 }}>{p.label}</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: p.color }}>{p.value}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{p.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fs-12 muted" style={{ marginBottom: 16 }}>
            Importá el período anterior para ver comparación Bruto vs Neto.
          </div>
        )}

        {/* Evolución 12m: base activa (línea) + bajas mensuales (barras) */}
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>Evolución base activa + bajas mensuales · 12 meses</div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart
              data={chartData.filter(p => !p.proyectado).map(p => ({
                mes: p.mes,
                activas: p.activeBase,
                bajas: p.bajas,
              }))}
              margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="base" tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} orientation="left" />
              <YAxis yAxisId="bajas" tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} orientation="right" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(v: any, name: any) => [
                  nfmt(Number(v)),
                  name === "activas" ? "Base activa inicio mes" : "Bajas del mes",
                ]}
              />
              <Bar yAxisId="bajas" dataKey="bajas" fill={ORANGE} fillOpacity={0.7} barSize={20} radius={[3, 3, 0, 0]} name="bajas" />
              <Line yAxisId="base" type="monotone" dataKey="activas" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: "#2563EB" }} name="activas" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          {[["#2563EB", "Base activa inicio mes (eje izq.)"], [ORANGE, "Bajas del mes (eje der.)"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-3)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
            </span>
          ))}
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
              onChange={e => { setSnapshotPlan(e.target.value); setSnapshotPage(0); }}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 12.5, fontFamily: "inherit" }}
            >
              <option value="Todos">Todos los planes</option>
              {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              value={snapshotQ}
              onChange={e => { setSnapshotQ(e.target.value); setSnapshotPage(0); }}
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
                {snapshotPageRows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>Sin resultados</td></tr>
                ) : snapshotPageRows.map((r, i) => (
                  <tr key={`${r.id_hubspot}-${i}`}>
                    <td className="strong">{r.nombre}</td>
                    <td className="mono fs-11" style={{ color: "var(--ink-3)" }}>{r.id_hubspot}</td>
                    <td>{r.pais}</td>
                    <td><span className="tag outline">{r.plan}</span></td>
                    <td className="mono">{r.fecha_baja ?? "—"}</td>
                    <td className="mono" style={{ textAlign: "right", color: r.diasDesdeBaja != null && r.diasDesdeBaja > 30 ? "var(--red)" : "var(--ink-2)" }}>
                      {r.diasDesdeBaja != null ? r.diasDesdeBaja : "—"}
                    </td>
                    <td><span className="fs-11" style={{ color: "var(--ink-2)" }}>{r.motivoCat}</span></td>
                    <td className="fs-11 muted">{r.ejecutivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginación */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", marginTop: 8, borderTop: "1px solid var(--rule)" }}>
              <span className="fs-12 muted">
                {snapshotFiltered.length === 0
                  ? "Sin resultados"
                  : `${snapshotPage * SNAPSHOT_PAGE_SIZE + 1}–${Math.min((snapshotPage + 1) * SNAPSHOT_PAGE_SIZE, snapshotFiltered.length)} de ${nfmt(snapshotFiltered.length)} cuentas`}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  className="btn ghost"
                  disabled={snapshotPage === 0}
                  onClick={() => setSnapshotPage(p => Math.max(0, p - 1))}
                  style={{ padding: "5px 12px", fontSize: 12 }}
                >← Anterior</button>
                <span className="fs-12 muted" style={{ minWidth: 80, textAlign: "center" }}>
                  Pág {snapshotPage + 1} / {snapshotTotalPages}
                </span>
                <button
                  className="btn ghost"
                  disabled={snapshotPage >= snapshotTotalPages - 1}
                  onClick={() => setSnapshotPage(p => Math.min(snapshotTotalPages - 1, p + 1))}
                  style={{ padding: "5px 12px", fontSize: 12 }}
                >Siguiente →</button>
              </div>
            </div>
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
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{ret.pctActivasConVentas.toFixed(1)}%</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>{nfmt(ret.activasConVentas)} cuentas · de {nfmt(ret.activasHoy)} activas</div>
          </div>
          <div className="card">
            <div className="card-eyebrow">Login &lt;7 días</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{ret.pctLoginMenos7.toFixed(1)}%</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>{nfmt(ret.loginMenos7)} cuentas · de {nfmt(ret.activasHoy)} activas</div>
          </div>
          <div className="card">
            <div className="card-eyebrow">A Recuperar</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>
              {ret.activasHoy ? ((ret.aRecuperar / ret.activasHoy) * 100).toFixed(1) : "—"}%
            </div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>{nfmt(ret.aRecuperar)} cuentas · Engagement + Onboarding</div>
            <div className="fs-12 muted">
              {ret.aRecuperar ? `${((ret.aRecuperarConVentas / ret.aRecuperar) * 100).toFixed(0)}%` : "0%"} con ≥10 ventas
              <span style={{ marginLeft: 4, color: "var(--ink-4)" }}>({nfmt(ret.aRecuperarConVentas)})</span>
            </div>
          </div>
          <div className="card">
            <div className="card-eyebrow">Base activa anterior</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 8 }}>{nfmt(ret.mpcsMesPasado)}</div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>denominador del churn · mes anterior</div>
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
