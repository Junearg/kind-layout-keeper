import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { ORANGE } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import { useDerived } from "@/data/derived";
import { useMotivosMes, useResumenMes, useMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import {
  ResponsiveContainer, ComposedChart, Bar, Area, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ErrorBar,
  PieChart, Pie, Cell,
} from "recharts";


export const Route = createFileRoute("/tendencia")({
  head: () => ({ meta: [{ title: "Tendencia · Churn Hub" }] }),
  component: Tendencia,
});
const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctfmt = (n: number, d = 2) => `${n.toFixed(d)}%`;


function exportEmptyCsv() {
  const headers = ["dash_id", "pais", "plan", "fecha_baja", "responsable_asignacion"];
  const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cuentas_sin_motivo.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Tendencia() {
  const { motivosBaja } = useDashboardData();

  const d = useDerived();
  const motivos = useMotivosMes();
  const resumen = useResumenMes();
  const mesActivo = useMesActivo();
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
          { name: "Motivos de baja", rows: motivosBaja },
        ]}
      />
    }>
      {!hasData ? (
        <EmptyPeriod section="Tendencia mensual" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      {/* Sección Churn Rate */}
      <div className="divider">
        <span className="kicker">Churn Rate</span>
        <span className="alt">· análisis y proyección</span>
        {d.wmaRate !== null && (
          <span className="sub">WMA {pctfmt(d.wmaRate)} · σ₆ ±{sixStdDev.toFixed(2)} pts</span>
        )}
        <span className="rule" />
      </div>

      {/* Fila 1 — Grid 2×2 Churn Rate */}
      <div className="bento equal-2" style={{ marginBottom: 20 }}>

        {/* Card 1 — Monthly Churn Rate */}
        <div className="card lg">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center" }}>
            Monthly Churn Rate
            <Info tip="Bajas del mes en curso / cuentas activas al inicio del mes. El badge muestra la variación vs el mes anterior en puntos porcentuales." />
          </div>
          <div className="bignum" style={{ marginTop: 10 }}>
            {latestRateP ? pctfmt(latestRateP.rate) : "—"}
          </div>
          <div className="fs-12 muted" style={{ marginTop: 8 }}>
            {latestRateP
              ? <>{nfmt(latestRateP.bajas)} bajas / base {nfmt(latestRateP.activeBase)} · {latestRateP.mes}</>
              : "sin datos"}
          </div>
          {d.monthDeltaRatePts !== null && (
            <div style={{ marginTop: 14 }}>
              <span className={`tag ${d.monthDeltaRatePts > 0 ? "red" : "blue"}`}>
                {d.monthDeltaRatePts >= 0 ? "+" : ""}{d.monthDeltaRatePts.toFixed(2)} pts vs {prevRateP?.mes ?? "anterior"}
              </span>
            </div>
          )}
        </div>

        {/* Card 2 — WMA Projected Rate */}
        {firstProj ? (
          <div className="card orange lg">
            <div className="card-eyebrow" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.85)" }}>
              WMA Projected Rate
              <Info tip="Promedio ponderado móvil de las últimas 3 tasas mensuales (pesos 50% / 30% / 20%). Suaviza picos atípicos para estimar el próximo mes." />
            </div>
            <div className="bignum" style={{ marginTop: 10 }}>{pctfmt(firstProj.rate)}</div>
            <div className="fs-12" style={{ color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
              proyección {firstProj.mes} · ≈ {nfmt(firstProj.bajas)} bajas
            </div>
            <div className="fs-12" style={{ color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              suaviza picos atípicos (pesos 50/30/20)
            </div>
            <div style={{ marginTop: 14 }}>
              <span className="callout" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                base inicial {nfmt(firstProj.activeBase)}
              </span>
            </div>
            <div className="bubble-wrap"><div className="bubble" /></div>
          </div>
        ) : <div className="card lg" />}

        {/* Card 3 — Projected Churns (3 meses, compuesto) */}
        <div className="card lg">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center" }}>
            Projected Churns · 3 meses (compuesto)
            <Info tip="Aplica la tasa WMA mes a mes sobre la base activa remanente del mes anterior (no sobre la base actual fija). Total = suma de los 3 meses proyectados." />
          </div>
          <div className="bignum" style={{ marginTop: 10 }}>{nfmt(proj3Total)}</div>
          <div className="fs-12 muted" style={{ marginTop: 8 }}>
            bajas proyectadas próximos 3 meses · tasa {pctfmt(wma)}
          </div>
          {proj3.length > 0 && (
            <table className="tbl" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: "right" }}>Activos inicio</th>
                  <th style={{ textAlign: "right" }}>Bajas proy.</th>
                </tr>
              </thead>
              <tbody>
                {proj3.map((p) => (
                  <tr key={p.key}>
                    <td className="strong">{p.mes}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{nfmt(p.activeBase)}</td>
                    <td className="mono strong" style={{ textAlign: "right" }}>{nfmt(p.bajas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Card 4 — Confidence Interval */}
        <div className="card ink lg">
          <div className="card-eyebrow" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
            Confidence Interval
            <Info tip="Desvío estándar de las últimas 6 tasas mensuales. Rango = tasa WMA ± 1.5 × σ, expresado en bajas absolutas sobre la base del próximo mes." />
          </div>
          <div className="bignum" style={{ marginTop: 10 }}>
            {nfmt(ciMin)}–{nfmt(ciMax)}
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
            centro {nfmt(ciCenter)} · σ₆ ±{sixStdDev.toFixed(2)} pts
          </div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            rango tasa {pctfmt(ciLowRate)} – {pctfmt(ciHighRate)}
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="callout" style={{
              background: sixStdDev > 0.8 ? "rgba(220,38,38,0.25)" : sixStdDev < 0.4 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.12)",
              color: "white",
            }}>
              {variabilityLabel}
            </span>
          </div>
        </div>
      </div>


      {/* Fila 2 — Chart grande */}
      <div className="card lg">
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Bajas mensuales + proyección rate-based</div>
            <div className="card-title">
              {d.firstClosed && d.latestClosed
                ? `De ${nfmt(d.firstClosed.bajas)} a ${nfmt(chartData[chartData.length - 1]?.bajas ?? d.latestClosed.bajas)} en ${chartData.length} meses`
                : "Bajas mensuales"}
            </div>
          </div>
          {d.seriesGrowthLabel && <span className="callout orange">↑ {d.seriesGrowthLabel}</span>}
        </div>
        <div className="chart-wrap" style={{ height: 360, position: "relative" }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 36, right: 24, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(value: any, name: any, item: any) => {
                  const row = item?.payload ?? {};
                  if (name === "bajas") {
                    const rate = typeof row.rate === "number" ? ` (${row.rate.toFixed(2)}%)` : "";
                    const band = row.proyectado && row.bajasMin != null && row.bajasMax != null
                      ? ` · banda ${nfmt(row.bajasMin)}–${nfmt(row.bajasMax)}`
                      : "";
                    return [`${nfmt(Number(value))}${rate}${band}`, row.proyectado ? "proyección" : "bajas"];
                  }
                  if (name === "rangoY") return [null, null] as any;
                  return [value, name];
                }}
              />
              {forecastX.length > 0 && (
                <ReferenceArea x1={forecastX[0]} x2={forecastX[forecastX.length - 1]} fill="#0B0B0A" fillOpacity={0.04} label={{ value: "Forecast WMA", position: "insideTop", fill: "#6E6D66", fontSize: 11 }} />
              )}
              <Area type="monotone" dataKey="bajas" stroke="none" fill="url(#areaFill)" />
              {/* Banda de confianza (sólo proyectados) */}
              <Area
                type="monotone"
                dataKey="rangoY"
                stroke="none"
                fill={ORANGE}
                fillOpacity={0.12}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Bar dataKey="bajas" radius={[6, 6, 0, 0]} barSize={42}>
                {chartData.map((dd, i) => (
                  <Cell
                    key={i}
                    fill={dd.proyectado ? "#FFB089" : ORANGE}
                    fillOpacity={dd.proyectado ? 0.7 : 1}
                  />
                ))}
                <ErrorBar dataKey="bajasError" width={6} strokeWidth={1.5} stroke="#7A3A12" direction="y" />
                <LabelList
                  dataKey="bajas"
                  position="top"
                  style={{ fontSize: 11, fill: "#0B0B0A", fontWeight: 500 }}
                  formatter={(v: any) => Number(v).toLocaleString()}
                />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {d.wmaRate !== null && (
          <div className="fs-12 muted" style={{ marginTop: 10 }}>
            WMA 3 meses: <strong>{pctfmt(d.wmaRate)}</strong> · stdDev ±{d.rateStdDev.toFixed(2)} pts · base actual {nfmt(d.activeAccounts)}
          </div>
        )}
      </div>


      {/* Divider */}
      <div className="divider">
        <span className="kicker">Motivos</span>
        <span className="alt">· de baja</span>
        <span className="sub">brecha de atribución {d.pctSinMotivo.toFixed(1)}%</span>
        <span className="rule" />
      </div>

      {/* Fila 3 — Donut + Tabla */}
      <div className="bento equal-2">
        {/* Donut */}
        <div className="card lg">
          <div className="card-eyebrow">Distribución de motivos</div>
          <div className="card-title" style={{ marginBottom: 12 }}>{nfmt(d.totalCategorizadas)} bajas categorizadas</div>
          <div className="chart-wrap" style={{ height: 320, position: "relative", background: "white" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={motivosBaja}
                  dataKey="n"
                  nameKey="motivo"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={1}
                  stroke="white"
                  strokeWidth={2}
                >
                  {motivosBaja.map((m, i) => (
                    <Cell key={i} fill={m.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                  formatter={(v: any, _n: any, p: any) => [`${Number(v).toLocaleString()} · ${p?.payload?.pct}%`, p?.payload?.motivo]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 32, color: "#DC2626", lineHeight: 1, letterSpacing: "-0.03em" }}>{d.pctSinMotivo.toFixed(1)}%</div>
              <div className="serif" style={{ fontSize: 16, color: "#DC2626", marginTop: 4 }}>sin motivo</div>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {motivosBaja.map((m) => (
              <div key={m.motivo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span className="tier-dot" style={{ background: m.color }} />
                <span style={{ flex: 1, color: m.brecha ? "#DC2626" : "var(--ink-2)", fontWeight: m.brecha ? 500 : 400 }}>{m.motivo}</span>
                <span className="mono muted">{m.n.toLocaleString()}</span>
                <span className="mono" style={{ color: m.brecha ? "#DC2626" : "var(--ink-3)", width: 42, textAlign: "right" }}>{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>


        {/* Tabla */}
        <div className="card lg">
          <div className="card-eyebrow">Detalle por motivo</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Atribución y prioridad</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Motivo</th>
                <th style={{ textAlign: "right" }}>n</th>
                <th style={{ textAlign: "right" }}>%</th>
                <th>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {motivosBaja.map((m) => {
                const prioTag =
                  m.prioridad === "CRÍTICA" ? "red" :
                  m.prioridad === "ALTA" ? "orange" :
                  m.prioridad === "Media" ? "amber" : "blue";
                return (
                  <tr key={m.motivo} className={m.brecha ? "row-alert" : ""}>
                    <td className="strong" style={{ color: m.brecha ? "#DC2626" : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="tier-dot" style={{ background: m.color }} />
                        {m.motivo}
                        {m.brecha && <span className="tag red" style={{ marginLeft: 4 }}>BRECHA CRÍTICA</span>}
                      </div>
                    </td>
                    <td className="mono strong" style={{ textAlign: "right" }}>{m.n.toLocaleString()}</td>
                    <td className="mono" style={{ textAlign: "right", color: m.brecha ? "#DC2626" : undefined }}>{m.pct}%</td>
                    <td><span className={`tag ${prioTag}`}>{m.prioridad}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div className="fs-12 muted">
              {sinMotivo.n.toLocaleString()} cuentas dadas de baja sin razón registrada.
            </div>
            <button className="btn" onClick={exportEmptyCsv}>
              Exportar {sinMotivo.n.toLocaleString()} cuentas sin motivo →
            </button>
          </div>
        </div>
      </div>
      </>
      )}
    </Layout>
  );
}
