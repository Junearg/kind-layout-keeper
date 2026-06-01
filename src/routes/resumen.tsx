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
import { ORANGE } from "@/data/mockData";
import { mesCorto } from "@/data/schema";
import { normalizarMotivo, MOTIVO_CATS, MOTIVO_COLORS } from "@/lib/motivo-normalizer";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
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

      {/* Bento 3 cols */}
      <div className="bento cols-2">
        {/* Bajas del mes */}
        <div className="card orange lg" style={{ minHeight: 280 }}>
          <div className="bubble-wrap"><div className="bubble" /></div>
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Bajas del mes</div>
              <div className="card-title" style={{ color: "white" }}>{r.latestClosedLabel}</div>
            </div>
            <div className="arrow-up">↗</div>
          </div>
          {/* Tasa % solo cuando la base es válida (mpcsMesPasado > 0) */}
          {(() => {
            const baseValida = ret && ret.mpcsMesPasado > 0;
            return (
              <>
                <div className="bignum" style={{ fontSize: baseValida ? 64 : 72, marginTop: 4 }}>
                  {baseValida ? `${ret!.churnBruto.toFixed(2)}%` : nfmt(r.bajasMesActual)}
                </div>
                <div className="fs-12" style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
                  {baseValida
                    ? `${nfmt(r.bajasMesActual)} bajas · base ${nfmt(ret!.mpcsMesPasado)}`
                    : ret
                      ? `${nfmt(r.bajasMesActual)} bajas · sin datos del período anterior`
                      : "bajas absolutas · cargando tasa…"}
                </div>
                <div className="mt-12" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {r.monthDeltaPct != null && (
                    <span className="callout">
                      {r.monthDeltaPct >= 0 ? "↑" : "↓"} {pctFmt(r.monthDeltaPct)} vs {r.prevClosedLabel}
                    </span>
                  )}
                  {baseValida && ret!.mpcsMesPasado > 0 && Math.abs(ret!.churnNeto - ret!.churnBruto) > 0.01 && (
                    <span className="callout" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
                      neto {ret!.churnNeto.toFixed(2)}%
                    </span>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Cuentas activas */}
        <div className="card lg">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Cuentas activas</div>
              <div className="card-title">{periodLabel(r.period)}</div>
            </div>
            <div className="arrow-up">●</div>
          </div>
          <div className="bignum" style={{ fontSize: 64 }}>{nfmt(r.activeAccounts)}</div>
          <TierMiniBars tierDist={r.tierDist} />
        </div>
      </div>

      {/* Tendencia */}
      <div className="divider">
        <span className="kicker">Tendencia</span>
        <span className="alt">/ bajas mensuales</span>
        <span className="sub">{r.churnTrend.length ? `${r.churnTrend[0]!.mes}–${r.churnTrend[r.churnTrend.length-1]!.mes}` : ""}</span>
        <span className="rule" />
      </div>

      <TrendCard trend={r.churnTrend} delta={r.monthDeltaPct} prevLabel={r.prevClosedLabel} latestLabel={r.latestClosedLabel} />
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
            const baseValida = ret.mpcsMesPasado > 0;
            return (
            <div className="card lg" style={{
              borderLeft: `4px solid ${
                !baseValida ? "var(--rule)" :
                ret.proyectadoVsPlan == null ? "var(--rule)" :
                Math.abs(ret.proyectadoVsPlan) <= 5 ? "var(--orange)" :
                ret.proyectadoVsPlan > 5 ? "var(--red)" : "#2f7d4f"
              }`
            }}>
              <div className="card-eyebrow">Churn Neto vs Plan</div>
              <div className="bignum" style={{ fontSize: 52, marginTop: 8 }}>
                {baseValida ? `${ret.churnNeto.toFixed(2)}%` : "—"}
              </div>
              <div className="fs-12 muted" style={{ marginTop: 6 }}>
                {baseValida
                  ? `churn neto actual · plan ${ret.churnPlan != null ? `${ret.churnPlan.toFixed(1)}%` : "—"}`
                  : "sin datos del período anterior"}
              </div>
              {baseValida && ret.proyectadoVsPlan != null && (
                <div style={{ marginTop: 10 }}>
                  <span className={`tag ${Math.abs(ret.proyectadoVsPlan) <= 5 ? "orange" : ret.proyectadoVsPlan > 5 ? "red" : "blue"}`}>
                    {ret.proyectadoVsPlan >= 0 ? "+" : ""}{ret.proyectadoVsPlan.toFixed(1)}% vs plan
                  </span>
                </div>
              )}
              {baseValida && (
                <div className="fs-12 muted" style={{ marginTop: 8 }}>
                  churn bruto: <strong>{ret.churnBruto.toFixed(2)}%</strong>
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
    return { ...d, conMotivo, sinMotivo };
  });

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
            <Bar dataKey="sinMotivo" stackId="b" fill={SIN_COLOR} radius={[6, 6, 0, 0]} barSize={28} />
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
    const byMonth = new Map<string, Partial<Record<string, number>>>();
    for (const r of rows) {
      if (!r.fechaBaja || /nps/i.test(r.motivo)) continue;
      const mes = r.fechaBaja.slice(0, 7);
      const cat = normalizarMotivo(r.motivo, null, null, null);
      const m = byMonth.get(mes) ?? {};
      m[cat] = (m[cat] ?? 0) + 1;
      byMonth.set(mes, m);
    }
    const months = Array.from(byMonth.keys()).sort().slice(-12);

    // Totales por mes (separados del chartData para no contaminar el eje Y)
    const totals: Record<string, number> = {};
    const chartRows = months.map((mes) => {
      const counts = byMonth.get(mes) ?? {};
      const total = MOTIVO_CATS.reduce((s, c) => s + (counts[c] ?? 0), 0) || 1;
      totals[mesCorto(mes)] = total;
      const row: Record<string, unknown> = { mes: mesCorto(mes) };
      for (const cat of MOTIVO_CATS) {
        row[cat] = +((( counts[cat] ?? 0) / total) * 100).toFixed(1);
      }
      return row;
    });

    // Stats del último mes para el header
    const lastKey = months[months.length - 1] ?? "";
    const lastCounts = byMonth.get(lastKey) ?? {};
    const lastTotal = MOTIVO_CATS.reduce((s, c) => s + (lastCounts[c] ?? 0), 0) || 1;
    const pctSinMotivo = ((lastCounts["Sin motivo"] ?? 0) / lastTotal) * 100;
    const topMotivo = MOTIVO_CATS
      .filter((c) => c !== "Sin motivo")
      .map((c) => ({ cat: c, pct: ((lastCounts[c] ?? 0) / lastTotal) * 100 }))
      .sort((a, b) => b.pct - a.pct)[0];
    const lastLabel = mesCorto(lastKey);

    return { chartRows, totals, pctSinMotivo, topMotivo, lastLabel };
  }, [rows]);

  if (!result) {
    return (
      <div className="card lg" style={{ display: "grid", placeItems: "center", minHeight: 380 }}>
        <div className="muted fs-12">Cargando motivos…</div>
      </div>
    );
  }

  const { chartRows, totals, pctSinMotivo, topMotivo, lastLabel } = result;

  return (
    <div className="card lg" style={{ marginTop: 16 }}>
      {/* Header con stats clave del último mes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="card-eyebrow">Distribución de motivos de baja</div>
          <div className="card-title">Composición mensual · últimos 12 meses</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {pctSinMotivo > 0 && (
            <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1px solid #FECACA" }}>
              ⚠ {pctSinMotivo.toFixed(1)}% sin motivo · {lastLabel}
            </span>
          )}
          {topMotivo && (
            <span style={{ background: "var(--paper-2)", color: "var(--ink-2)", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
              mayor causa: {topMotivo.cat} {topMotivo.pct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Gráfico full-width, más alto */}
      <div style={{ height: 400 }}>
        <ResponsiveContainer>
          <BarChart data={chartRows} margin={{ top: 8, right: 20, left: 0, bottom: 8 }} barCategoryGap="20%">
            <CartesianGrid stroke="#E8E6DC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false}
              unit="%" domain={[0, 100]} tickCount={6}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
              formatter={(v: any, name: any, item: any) => {
                const mes = item?.payload?.mes as string;
                const total = totals[mes] ?? 0;
                const abs = Math.round(Number(v) * total / 100);
                return [`${Number(v).toFixed(1)}% · ${nfmt(abs)} bajas`, name];
              }}
              labelFormatter={(label: any) =>
                `${label} · ${nfmt(totals[label as string] ?? 0)} bajas totales`
              }
            />
            {MOTIVO_CATS.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="m" fill={MOTIVO_COLORS[cat]}
                radius={i === MOTIVO_CATS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              >
                <LabelList
                  dataKey={cat}
                  position="center"
                  style={{ fontSize: 11, fill: "#2B2B27", fontWeight: 700, pointerEvents: "none" }}
                  formatter={(v: unknown) => Number(v) >= 10 ? `${Number(v).toFixed(0)}%` : ""}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 14 }}>
        {MOTIVO_CATS.map((cat) => (
          <span key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: MOTIVO_COLORS[cat], flexShrink: 0 }} />
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}
