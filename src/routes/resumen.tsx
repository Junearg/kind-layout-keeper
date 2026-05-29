import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";

import { ExportButton } from "@/components/ExportButton";
import { usePeriod, periodLabel } from "@/contexts/PeriodContext";
import { useSupabaseResumen } from "@/data/supabase-resumen";
import { ORANGE } from "@/data/mockData";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie,
} from "recharts";

export const Route = createFileRoute("/resumen")({
  head: () => ({ meta: [{ title: "Fudo Customer Center" }] }),
  component: Resumen,
});

const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctFmt = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
const tierClass = (t: string) => (t === "At Risk" ? "tier-AtRisk" : t);

function Resumen() {
  const { selectedPeriod } = usePeriod();
  const { data: r, isLoading, error } = useSupabaseResumen(selectedPeriod);

  return (
    <Layout actions={
      <ExportButton
        filename="resumen-ejecutivo.xlsx"
        sheets={r ? [
          { name: "Tendencia bajas", rows: r.churnTrend },
          { name: "Distribución tiers", rows: r.tierDist.map((t) => ({ tier: t.tier, count: t.count, pct: t.pct })) },
          { name: "KPIs período", rows: [
            { kpi: "NPS", valor: r.npsScore.toFixed(2) },
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
      <div className="bento cols-3">
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
          <div className="bignum" style={{ fontSize: 72 }}>{nfmt(r.bajasMesActual)}</div>
          <div className="mt-12" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.monthDeltaPct != null && (
              <span className="callout">
                {r.monthDeltaPct >= 0 ? "↑" : "↓"} {pctFmt(r.monthDeltaPct)} vs {r.prevClosedLabel}
              </span>
            )}
            {r.ytdClosed > 0 && (
              <span className="callout" style={{ background: "rgba(255,255,255,0.18)" }}>
                {nfmt(r.ytdClosed)} YTD
              </span>
            )}
          </div>
          <div className="mt-16" style={{ display: "flex", gap: 8, position: "relative", zIndex: 2 }}>
            <Link to="/cola" className="btn" style={{ background: "white", color: "var(--orange-deep)" }}>Plan retención</Link>
            <Link to="/tendencia" className="btn ghost" style={{ borderColor: "rgba(255,255,255,0.4)", color: "white" }}>Ver detalle</Link>
          </div>
        </div>

        {/* NPS por país */}
        <div className="card lg">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">NPS por país</div>
              <div className="card-title">{nfmt(r.npsResponses)} respuestas</div>
            </div>
            <div className="arrow-up">⌁</div>
          </div>

          {/* NPS por país */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            {r.npsByPais.length === 0 ? (
              <div className="muted fs-12">Sin segmentación por país (n &lt; 10)</div>
            ) : (
              [...r.npsByPais].sort((a, b) => b.nps - a.nps).map((p) => (
                <NpsPaisRow key={p.pais} pais={p.pais} nps={p.nps} n={p.n} />
              ))
            )}
          </div>
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

      <div className="bento cols-2">
        <TrendCard trend={r.churnTrend} delta={r.monthDeltaPct} prevLabel={r.prevClosedLabel} latestLabel={r.latestClosedLabel} />
        <TierDonutCard tierDist={r.tierDist} total={r.activeAccounts} />
      </div>
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
function NpsPaisRow({ pais, nps, n }: { pais: string; nps: number; n: number }) {
  // Escala visual: -100 a 100 → 0 a 100% del ancho, con 50% como cero
  const pct = Math.max(0, Math.min(100, (nps + 100) / 2));
  const color = nps >= 50 ? "var(--green, #2f7d4f)" : nps >= 0 ? "var(--orange)" : "var(--red)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px", alignItems: "center", gap: 10, fontSize: 12 }}>
      <span style={{ color: "var(--ink-2)" }}>{pais}</span>
      <div style={{ position: "relative", height: 6, background: "var(--paper-2)", borderRadius: 99 }}>
        <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 10, background: "var(--rule-2)" }} />
        <div style={{ position: "absolute", left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%`, top: 0, bottom: 0, background: color, borderRadius: 99 }} />
      </div>
      <span className="mono" style={{ textAlign: "right" }}>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>{nps.toFixed(1)}</span>
        <span className="muted" style={{ marginLeft: 4, fontSize: 10 }}>n={n}</span>
      </span>
    </div>
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
  const pctVals = trend.map((x) => x.pctMotivo).filter((v): v is number => v != null);
  const rMin = pctVals.length ? Math.max(0, Math.floor(Math.min(...pctVals) - 5)) : 0;
  const rMax = pctVals.length ? Math.ceil(Math.max(...pctVals) + 5) : 100;

  return (
    <div className="card lg">
      <div className="minihead">
        <div>
          <div className="card-eyebrow">Bajas vs % registrado con motivo</div>
          <div className="card-title">Evolución mensual</div>
        </div>
        {delta != null && (
          <span className={`delta-pill ${delta >= 0 ? "bad" : ""}`}>
            {delta >= 0 ? "↑" : "↓"} {pctFmt(delta)} {prevLabel}→{latestLabel}
          </span>
        )}
      </div>
      <div className="chart-wrap" style={{ height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={trend} margin={{ top: 24, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="trendG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ORANGE} stopOpacity={0.25} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E8E6DC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="L" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="R" orientation="right" domain={[rMin, rMax]} tick={{ fontSize: 11, fill: "#B5740F" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />
            <Area yAxisId="L" type="monotone" dataKey="bajas" stroke="none" fill="url(#trendG)" />
            <Bar yAxisId="L" dataKey="bajas" radius={[6, 6, 0, 0]} barSize={28}>
              {trend.map((_, i) => <Cell key={i} fill={ORANGE} />)}
            </Bar>
            <Line yAxisId="R" type="monotone" dataKey="pctMotivo" stroke="#B5740F" strokeWidth={2} dot={{ r: 3, fill: "#B5740F" }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TierDonutCard({ tierDist, total }: { tierDist: { tier: string; count: number; pct: number; color: string }[]; total: number }) {
  return (
    <div className="card cream lg">
      <div className="minihead">
        <div>
          <div className="card-eyebrow">Salud de la base</div>
          <div className="card-title">Distribución por tier</div>
        </div>
      </div>
      <div style={{ position: "relative", height: 240 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={tierDist} dataKey="count" nameKey="tier" innerRadius={70} outerRadius={110} paddingAngle={2} stroke="none">
              {tierDist.map((t) => <Cell key={t.tier} fill={t.color} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
          <div>
            <div className="bignum" style={{ fontSize: 40, justifyContent: "center" }}>{nfmt(total)}</div>
            <div className="muted fs-11" style={{ marginTop: 4 }}>cuentas activas</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {tierDist.map((t) => (
          <div key={t.tier} className="row-flex" style={{ justifyContent: "space-between", fontSize: 12 }}>
            <span className="row-flex" style={{ gap: 8 }}>
              <span className="tier-dot" style={{ background: t.color }} />
              <span className={`tag tier-${tierClass(t.tier)}`}>{t.tier}</span>
            </span>
            <span className="mono">{nfmt(t.count)} · {t.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
