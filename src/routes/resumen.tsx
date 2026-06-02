import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";

import { ExportButton } from "@/components/ExportButton";
import { usePeriod, periodLabel } from "@/contexts/PeriodContext";
import { useSupabaseResumen } from "@/data/supabase-resumen";
import { useSupabaseChurnInsights } from "@/data/supabase-churn-insights";
import { useRetention } from "@/data/supabase-retention";
import { useCountry } from "@/contexts/CountryContext";
import { useMesActivo } from "@/data/dataset-store";
import { useKpisDiarios, useKpiDelta, listFechasDiarias, type KpiDiario } from "@/data/supabase-kpis-diarios";
import { useQuery } from "@tanstack/react-query";
import { ORANGE } from "@/data/mockData";
import { mesCorto } from "@/data/schema";
import { normalizarMotivo, MOTIVO_CATS, MOTIVO_COLORS } from "@/lib/motivo-normalizer";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Cell,
  PieChart, Pie,
} from "recharts";

export const Route = createFileRoute("/resumen")({
  head: () => ({ meta: [{ title: "Fudo Customer Center" }] }),
  component: Resumen,
});

const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctFmt = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
function Resumen() {
  const { selectedPeriod } = usePeriod();
  const { data: r, isLoading, error } = useSupabaseResumen(selectedPeriod);
  const mesActivo = useMesActivo();
  const { selectedPais } = useCountry();
  const { data: insights6m } = useSupabaseChurnInsights(mesActivo, selectedPais);
  const { data: ret } = useRetention(selectedPeriod, selectedPais);


  return (
    <Layout actions={
      <ExportButton
        filename="resumen-ejecutivo.xlsx"
        sheets={r ? [
          { name: "Tendencia bajas", rows: r.churnTrend },
          { name: "Distribución tiers", rows: r.tierDist.map((t) => ({ tier: t.tier, count: t.count, pct: t.pct })) },
          { name: "KPIs período", rows: [
            { kpi: "CSAT", valor: r.csatAvg?.toFixed(2) ?? "—" },
            { kpi: "CVR", valor: `${r.cvr.toFixed(1)}%` },
            { kpi: "Cuentas activas", valor: r.activeAccounts },
            { kpi: "Bajas último mes", valor: r.bajasMesActual },
            { kpi: "Bajas YTD", valor: r.ytdClosed },
          ] },
        ] : []}
      />
    }>
      {!selectedPeriod ? null : isLoading ? (

        <div className="card" style={{ padding: 20 }}>Cargando datos de Supabase…</div>
      ) : error ? (
        <div className="card" style={{ padding: 20, color: "var(--red)" }}>Error: {(error as Error).message}</div>
      ) : !r ? null : (
      <>

      {/* Header — 2 tarjetas cuadradas compactas */}
      <div style={{ display: "flex", gap: 16, marginBottom: 0 }}>
        {/* Bajas del mes */}
        <div className="card orange" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: 11 }}>Bajas del mes</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{r.latestClosedLabel}</div>
            </div>
            <span style={{ fontSize: 16, opacity: 0.6 }}>↗</span>
          </div>
          {(() => {
            const baseExacta = ret && ret.mpcsMesPasado > 0;
            const baseEstimada = r.activeAccounts + r.bajasMesActual;
            const rateEstimado = baseEstimada > 0 ? (r.bajasMesActual / baseEstimada) * 100 : null;
            const rateDisplay = baseExacta ? ret!.churnBruto.toFixed(2) : rateEstimado?.toFixed(2) ?? null;
            return (
              <>
                <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                  {rateDisplay != null ? `${rateDisplay}%` : nfmt(r.bajasMesActual)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>
                  {baseExacta
                    ? `${nfmt(r.bajasMesActual)} bajas · base ${nfmt(ret!.mpcsMesPasado)}`
                    : rateDisplay != null
                      ? `${nfmt(r.bajasMesActual)} bajas · base ≈ ${nfmt(baseEstimada)} (est.)`
                      : "cargando…"}
                </div>
                {r.monthDeltaPct != null && (
                  <div style={{ marginTop: 10 }}>
                    <span className="callout" style={{ fontSize: 11 }}>
                      {r.monthDeltaPct >= 0 ? "↑" : "↓"} {pctFmt(r.monthDeltaPct)} vs {r.prevClosedLabel}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Cuentas activas */}
        <div className="card" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="card-eyebrow" style={{ fontSize: 11 }}>Cuentas activas</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{periodLabel(r.period)}</div>
            </div>
            <span style={{ fontSize: 16, opacity: 0.3 }}>●</span>
          </div>
          <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
            {nfmt(r.activeAccounts)}
          </div>
          <TierMiniBars tierDist={r.tierDist} />
        </div>
      </div>

      {/* Snapshot diario */}
      <DailySection pais={selectedPais} />

      {/* Tendencia */}
      <div className="divider">
        <span className="kicker">Tendencia</span>
        <span className="alt">/ bajas mensuales</span>
        <span className="sub">{r.churnTrend.length ? `${r.churnTrend[0]!.mes}–${r.churnTrend[r.churnTrend.length-1]!.mes}` : ""}</span>
        <span className="rule" />
      </div>

      <TrendCard trend={r.churnTrend.slice(-6)} delta={r.monthDeltaPct} prevLabel={r.prevClosedLabel} latestLabel={r.latestClosedLabel} />
      <MotivosStackedCard rows={insights6m?.rows ?? null} />

      {/* Retención vs Plan */}
      {ret && (
        <>
        <div className="divider">
          <span className="kicker">Retención</span>
          <span className="alt">/ vs plan · {selectedPais}</span>
          <span className="rule" />
        </div>
        <div className="bento cols-3">

          {/* Churn Neto vs Plan */}
          {(() => {
            const baseExacta = ret.mpcsMesPasado > 0;
            // Estimación neta: (activas_ayer - activas_hoy) / activas_ayer ≈ churn neto
            const baseEst = r.activeAccounts + r.bajasMesActual;
            const netoEst = baseEst > 0 ? ((baseEst - ret.activasHoy) / baseEst) * 100 : null;
            const netoDisplay = baseExacta ? ret.churnNeto : netoEst;
            const accentColor = netoDisplay == null ? "var(--rule)"
              : ret.churnPlan == null ? "var(--rule)"
              : netoDisplay > ret.churnPlan * 1.05 ? "var(--red)"
              : netoDisplay < ret.churnPlan * 0.95 ? "#2f7d4f"
              : "var(--orange)";
            return (
            <div className="card lg" style={{ borderLeft: `4px solid ${accentColor}` }}>
              <div className="card-eyebrow">Churn Neto vs Plan</div>
              <div className="bignum" style={{ fontSize: 52, marginTop: 8 }}>
                {netoDisplay != null ? `${netoDisplay.toFixed(2)}%` : "—"}
              </div>
              <div className="fs-12 muted" style={{ marginTop: 6 }}>
                {baseExacta
                  ? `churn neto actual · plan ${ret.churnPlan != null ? `${ret.churnPlan.toFixed(1)}%` : "—"}`
                  : netoDisplay != null
                    ? `estimado · plan ${ret.churnPlan != null ? `${ret.churnPlan.toFixed(1)}%` : "—"}`
                    : "sin datos suficientes"}
              </div>
              {netoDisplay != null && ret.churnPlan != null && (
                <div style={{ marginTop: 10 }}>
                  <span className={`tag ${Math.abs(ret.proyectadoVsPlan) <= 5 ? "orange" : ret.proyectadoVsPlan > 5 ? "red" : "blue"}`}>
                    {ret.proyectadoVsPlan >= 0 ? "+" : ""}{ret.proyectadoVsPlan.toFixed(1)}% vs plan
                  </span>
                </div>
              )}
              {netoDisplay != null && (
                <div className="fs-12 muted" style={{ marginTop: 8 }}>
                  bruto ≈ {baseExacta ? ret.churnBruto.toFixed(2) : ((r.bajasMesActual / baseEst) * 100).toFixed(2)}%
                  {!baseExacta && <span style={{ marginLeft: 6, opacity: 0.7 }}>(estimado)</span>}
                </div>
              )}
            </div>
            );
          })()}

          {/* # Recuperar on target */}
          <div className="card lg" style={{ borderLeft: "4px solid var(--amber)" }}>
            <div className="card-eyebrow"># Recuperar on target</div>
            <div className="bignum" style={{ fontSize: 52, marginTop: 8 }}>
              {ret.mpcsMeta != null && ret.nRecuperar != null
                ? `${((ret.nRecuperar / ret.mpcsMeta) * 100).toFixed(1)}%`
                : ret.nRecuperar != null ? nfmt(ret.nRecuperar) : "—"}
            </div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>
              {ret.nRecuperar != null ? nfmt(ret.nRecuperar) : "—"} cuentas · gap vs plan
            </div>
            <div className="fs-12 muted" style={{ marginTop: 8 }}>
              meta MPCs: <strong>{ret.mpcsMeta != null ? nfmt(ret.mpcsMeta) : "—"}</strong>
              <span style={{ marginLeft: 8 }}>actual: <strong>{nfmt(ret.activasHoy)}</strong></span>
            </div>
          </div>

          {/* A Recuperar */}
          <div className="card lg">
            <div className="card-eyebrow">A Recuperar</div>
            <div className="bignum" style={{ fontSize: 52, marginTop: 8 }}>
              {ret.activasHoy ? `${((ret.aRecuperar / ret.activasHoy) * 100).toFixed(1)}%` : nfmt(ret.aRecuperar)}
            </div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>
              {nfmt(ret.aRecuperar)} cuentas · de {nfmt(ret.activasHoy)} activas
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="callout" style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}>
                {ret.aRecuperar ? `${((ret.aRecuperarConVentas / ret.aRecuperar) * 100).toFixed(0)}%` : "0%"} con ≥10 ventas
                <span style={{ marginLeft: 4, opacity: 0.7 }}>({nfmt(ret.aRecuperarConVentas)})</span>
              </span>
            </div>
          </div>

        </div>
        </>
      )}
      </>
      )}
    </Layout>
  );
}

function AlertBanner({ tone, text, to }: { tone: "red" | "amber"; text: string; to: string }) {
  const color = tone === "red" ? "var(--red)" : "var(--amber)";
  const bg = tone === "red" ? "rgba(179,38,30,0.05)" : "rgba(181,116,15,0.06)";
  return (
    <Link to={to} style={{
      display: "flex", alignItems: "center", gap: 10,
      background: bg, borderLeft: `3px solid ${color}`,
      borderRadius: "var(--radius-md)", padding: "10px 14px",
      color: "var(--ink-2)", fontSize: 12.5, textDecoration: "none",
    }}>
      <span style={{ color, fontSize: 10 }}>●</span>
      <span style={{ flex: 1 }}>{text}</span>
      <span style={{ color, fontWeight: 500, fontSize: 12 }}>Ver →</span>
    </Link>
  );
}
function Q1Metric({ label, value, tone }: { label: string; value: string; tone: "orange" | "ink" | "cream" }) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "ink" ? "var(--ink)" : "var(--paper-2)";
  const color = tone === "cream" ? "var(--ink)" : "white";
  return (
    <div style={{ background: bg, color, borderRadius: 14, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="fs-11" style={{ opacity: tone === "cream" ? 0.6 : 0.8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function TierMiniBars({ tierDist }: { tierDist: { tier: string; count: number; color: string }[] }) {
  const total = tierDist.reduce((s, t) => s + t.count, 0) || 1;
  return (
    <div className="mt-16">
      <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", gap: 2 }}>
        {tierDist.map((t) => (
          <div key={t.tier} style={{ width: `${(t.count / total) * 100}%`, background: t.color }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11 }}>
        {tierDist.map((t) => (
          <div key={t.tier} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="row-flex" style={{ gap: 5 }}>
              <span className="tier-dot" style={{ background: t.color }} />
              <span className="muted">{t.tier}</span>
            </span>
            <span className="mono strong">{nfmt(t.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendCard({ trend, delta, prevLabel, latestLabel }: {
  trend: { mes: string; bajas: number; pctMotivo: number | null }[];
  delta: number | null; prevLabel: string; latestLabel: string;
}) {
  const SIN_COLOR = "#E8C9B8";
  const data = trend.map((d) => {
    const pct = d.pctMotivo ?? 0;
    const conMotivo = Math.round((d.bajas * pct) / 100);
    const sinMotivo = Math.max(0, d.bajas - conMotivo);
    const pctSinMotivo = d.bajas > 0 ? Math.round((sinMotivo / d.bajas) * 100) : 0;
    return { ...d, conMotivo, sinMotivo, pctSinMotivo };
  });
  const maxBajas = Math.max(...data.map((d) => d.bajas), 0);

  return (
    <div className="card lg">
      <div className="minihead">
        <div>
          <div className="card-eyebrow">Bajas mensuales por calidad del registro</div>
          <div className="card-title">Evolución mensual</div>
        </div>
        {delta != null && (
          <span className={`delta-pill ${delta >= 0 ? "bad" : ""}`}>
            {delta >= 0 ? "↑" : "↓"} {pctFmt(delta)} {prevLabel}→{latestLabel}
          </span>
        )}
      </div>

      {/* Leyenda explicativa */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4, marginBottom: 8, fontSize: 11.5, color: "var(--ink-2)" }}>
        <span className="row-flex" style={{ gap: 6 }}>
          <span style={{ width: 12, height: 12, background: ORANGE, borderRadius: 2, display: "inline-block" }} />
          <span><strong style={{ color: "var(--ink)" }}>Con motivo registrado</strong></span>
        </span>
        <span className="row-flex" style={{ gap: 6 }}>
          <span style={{ width: 12, height: 12, background: SIN_COLOR, borderRadius: 2, display: "inline-block" }} />
          <span><strong style={{ color: "var(--ink)" }}>Sin motivo</strong></span>
        </span>
        <span className="muted" style={{ fontSize: 11 }}>La altura total de cada barra = bajas del mes</span>
      </div>

      <div className="chart-wrap" style={{ height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 24, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#E8E6DC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
              formatter={(value: any, name: any, item: any) => {
                const total = item?.payload?.bajas ?? 0;
                const pct = total ? (Number(value) / total) * 100 : 0;
                const label = name === "conMotivo" ? "Con motivo" : name === "sinMotivo" ? "Sin motivo" : String(name);
                return [`${nfmt(Number(value))} (${pct.toFixed(0)}%)`, label];
              }}
              labelFormatter={(label: any, payload: any) => {
                const total = payload?.[0]?.payload?.bajas ?? 0;
                return `${label} · Total: ${nfmt(total)} bajas`;
              }}
            />
            <Bar dataKey="conMotivo" stackId="b" fill={ORANGE} radius={[0, 0, 0, 0]} barSize={28} />
            <Bar dataKey="sinMotivo" stackId="b" fill={SIN_COLOR} radius={[6, 6, 0, 0]} barSize={28}>
              <LabelList
                content={({ x, y, width, value, index }) => {
                  const d = data[index as number];
                  if (!d) return null;
                  const xNum = Number(x ?? 0) + Number(width ?? 0) / 2;
                  const yNum = Number(y ?? 0) - 8;
                  return (
                    <g>
                      <text x={xNum} y={yNum} textAnchor="middle" fontSize={12} fontWeight={700} fill="#DC2626">
                        {`${d.pctSinMotivo}% sin motivo`}
                      </text>
                      <text x={xNum} y={yNum - 16} textAnchor="middle" fontSize={11} fill="#6E6D66">
                        {nfmt(d.bajas)} bajas
                      </text>
                    </g>
                  );
                }}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}



type ChurnRowLite = { motivo: string; fechaBaja: string | null };

function MotivosStackedCard({ rows }: { rows: ChurnRowLite[] | null }) {
  const result = useMemo(() => {
    if (!rows) return null;
    const counts: Partial<Record<string, number>> = {};
    let total = 0;
    for (const r of rows) {
      if (!r.fechaBaja || /nps/i.test(r.motivo)) continue;
      const cat = normalizarMotivo(r.motivo, null, null, null);
      counts[cat] = (counts[cat] ?? 0) + 1;
      total++;
    }
    const pieData = MOTIVO_CATS
      .map((cat) => ({
        name: cat,
        value: counts[cat] ?? 0,
        pct: total > 0 ? +((counts[cat] ?? 0) / total * 100).toFixed(1) : 0,
        color: MOTIVO_COLORS[cat],
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    const pctSinMotivo = pieData.find((d) => d.name === "Sin motivo")?.pct ?? 0;
    return { pieData, total, pctSinMotivo };
  }, [rows]);

  if (!result) {
    return (
      <div className="card lg" style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
        <div className="muted fs-12">Cargando motivos…</div>
      </div>
    );
  }

  const { pieData, total, pctSinMotivo } = result;

  return (
    <div className="card lg" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="card-eyebrow">Distribución de motivos de baja</div>
          <div className="card-title">Acumulado del período · {nfmt(total)} bajas</div>
        </div>
        {pctSinMotivo > 0 && (
          <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1px solid #FECACA" }}>
            ⚠ {pctSinMotivo.toFixed(1)}% sin motivo
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
        {/* Donut */}
        <div style={{ position: "relative", width: 260, height: 260, flexShrink: 0 }}>
          <ResponsiveContainer width={260} height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="pct" nameKey="name"
                cx="50%" cy="50%" innerRadius={78} outerRadius={120}
                paddingAngle={2} stroke="white" strokeWidth={2}
              >
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                formatter={(v: any, _: any, p: any) => [
                  `${Number(v).toFixed(1)}% · ${nfmt(p?.payload?.value ?? 0)} bajas`,
                  p?.payload?.name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>{pctSinMotivo.toFixed(0)}%</div>
            <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4, fontWeight: 500 }}>sin motivo</div>
          </div>
        </div>

        {/* Lista rankeada — nombre visible directamente */}
        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 11 }}>
          {pieData.map((d) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{
                flex: 1, fontSize: 13,
                fontWeight: d.name === "Sin motivo" ? 700 : 400,
                color: d.name === "Sin motivo" ? "#DC2626" : "var(--ink)",
              }}>
                {d.name}
              </span>
              <div style={{ width: 90, background: "var(--paper-2)", borderRadius: 99, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${d.pct}%`, background: d.color, height: "100%", borderRadius: 99 }} />
              </div>
              <span style={{
                fontSize: 13, fontWeight: 600, minWidth: 48, textAlign: "right",
                color: d.name === "Sin motivo" ? "#DC2626" : "var(--ink-2)",
              }}>
                {d.pct.toFixed(1)}%
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 58, textAlign: "right" }}>
                {nfmt(d.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Snapshot Diario ────────────────────────────────────────────────────────
function DailySection({ pais }: { pais: import("@/contexts/CountryContext").Pais }) {
  // Última fecha diaria disponible
  const { data: fechas } = useQuery({
    queryKey: ["fechas-diarias"],
    queryFn: listFechasDiarias,
    staleTime: 300_000,
  });
  const fechaHoy = fechas?.[0] ?? "";
  const { data: delta, isLoading } = useKpiDelta(fechaHoy, pais);
  const { data: serie } = useKpisDiarios(pais, 30);

  if (!fechaHoy) return null;
  if (isLoading || !delta) {
    return (
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div className="card-eyebrow">Snapshot diario</div>
        <div className="fs-12 muted" style={{ marginTop: 8 }}>Cargando datos diarios…</div>
      </div>
    );
  }

  const { hoy, ayer: _ayer, delta: d } = delta;
  const nfmt2 = (n: number) => n.toLocaleString("es-AR");
  const sign = (n: number, invert = false) => {
    const bad = invert ? n > 0 : n < 0;
    return { prefix: n >= 0 ? "+" : "", color: bad ? "var(--red)" : n === 0 ? "var(--ink-3)" : "var(--green, #16A34A)" };
  };

  const cards: { label: string; value: string; delta: number; invert?: boolean; sub?: string }[] = [
    { label: "Activas", value: nfmt2(hoy.activas), delta: d.activas, sub: `% ret. ${hoy.pctRetenido.toFixed(2)}%` },
    { label: "Pago Pendiente", value: nfmt2(hoy.pagoPendiente), delta: d.pagoPendiente, invert: true },
    { label: "Bajas Confirmadas", value: nfmt2(hoy.bajas), delta: d.bajas, invert: true },
    { label: "A Recuperar", value: nfmt2(hoy.aRecuperar), delta: d.aRecuperar, invert: true,
      sub: `Onb ${hoy.onboarding} · Eng ${hoy.engagement}` },
    { label: "Sin ventas", value: nfmt2(hoy.sinVentas), delta: d.sinVentas, invert: true,
      sub: `Con ventas: ${nfmt2(hoy.activasConVentas)}` },
  ];

  return (
    <>
      <div className="divider" style={{ marginTop: 24 }}>
        <span className="kicker">Snapshot</span>
        <span className="alt">/ diario · {fechaHoy}</span>
        <span className="sub">vs ayer</span>
        <span className="rule" />
      </div>

      {/* KPI cards */}
      <div className="bento cols-5" style={{ marginBottom: 16 }}>
        {cards.map((c) => {
          const { prefix, color } = sign(c.delta, c.invert);
          return (
            <div key={c.label} className="card" style={{ padding: 16 }}>
              <div className="card-eyebrow" style={{ fontSize: 10.5 }}>{c.label}</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}>
                {c.value}
              </div>
              {c.delta !== 0 && (
                <div style={{ fontSize: 11, marginTop: 6, color, fontWeight: 500 }}>
                  {prefix}{nfmt2(c.delta)} vs ayer
                </div>
              )}
              {c.delta === 0 && (
                <div style={{ fontSize: 11, marginTop: 6, color: "var(--ink-3)" }}>
                  sin cambio
                </div>
              )}
              {c.sub && <div className="fs-11 muted" style={{ marginTop: 4 }}>{c.sub}</div>}
            </div>
          );
        })}
      </div>

      {/* Gráfico de evolución 30 días */}
      {serie && serie.length > 1 && (
        <div className="bento cols-2">
          {/* Absolutos: Activas + Pago Pendiente + A Recuperar */}
          <div className="card lg">
            <div className="card-eyebrow">Evolución absoluta · últimos 30 días</div>
            <div style={{ height: 240, marginTop: 12 }}>
              <ResponsiveContainer>
                <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#E8E6DC" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => mesCorto(v.slice(0, 7)) + " " + v.slice(8, 10)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6DC" }}
                    labelFormatter={(v) => v} />
                  <Line type="monotone" dataKey="activas" stroke="#2563EB" strokeWidth={2} dot={false} name="Activas" />
                  <Line type="monotone" dataKey="pagoPendiente" stroke="#D97706" strokeWidth={1.5} dot={false} name="Pago Pendiente" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="aRecuperar" stroke="#7C3AED" strokeWidth={1.5} dot={false} name="A Recuperar" />
                  <Bar dataKey="bajas" fill="#F05A28" fillOpacity={0.6} barSize={6} radius={[2,2,0,0]} name="Bajas" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {[["#2563EB","Activas"],["#D97706","Pago Pendiente"],["#7C3AED","A Recuperar"],["#F05A28","Bajas"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ink-3)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} /> {l}
                </span>
              ))}
            </div>
          </div>

          {/* % Retenido + Churn Neto */}
          <div className="card lg">
            <div className="card-eyebrow">Tasa diaria · últimos 30 días</div>
            <div style={{ height: 240, marginTop: 12 }}>
              <ResponsiveContainer>
                <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#E8E6DC" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => mesCorto(v.slice(0, 7)) + " " + v.slice(8, 10)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6DC" }}
                    formatter={(v: any) => [`${Number(v).toFixed(2)}%`, ""]} />
                  <Line type="monotone" dataKey="pctRetenido" stroke="#16A34A" strokeWidth={2} dot={false} name="% Retenido" />
                  <Line type="monotone" dataKey="churnNeto" stroke="#F05A28" strokeWidth={1.5} dot={false} name="Churn Neto %" strokeDasharray="3 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {[["#16A34A","% Retenido"],["#F05A28","Churn Neto"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ink-3)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} /> {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
