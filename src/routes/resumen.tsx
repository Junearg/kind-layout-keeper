import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { ORANGE } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, ReferenceArea, ReferenceLine,
} from "recharts";
import type { ReactNode } from "react";

export const Route = createFileRoute("/resumen")({
  head: () => ({ meta: [{ title: "Fudo Churn Center" }] }),
  component: Resumen,
});

const tierClass = (t: string) => (t === "At Risk" ? "tier-AtRisk" : t);

function Resumen() {
  const { churnTrend, tierDist } = useDashboardData();
  const cuentasActivas = tierDist.reduce((s, t) => s + t.count, 0);

  return (
    <Layout actions={
      <ExportButton
        filename="resumen-ejecutivo.xlsx"
        sheets={[
          { name: "Tendencia churn", rows: churnTrend },
          { name: "Distribución tiers", rows: tierDist },
          { name: "KPIs Q1", rows: [
            { kpi: "NPS Global", valor: 47.71 },
            { kpi: "CSAT", valor: 4.78 },
            { kpi: "CVR Neto", valor: "19.9%" },
            { kpi: "Cuentas activas", valor: cuentasActivas },
            { kpi: "Bajas del mes", valor: 1446 },
          ] },
        ]}
      />
    }>
      {/* ── Fila 1: Alertas activas (2×2) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <AlertBanner tone="red"   icon="●" text="Chile NPS 37.05 — gap -16.9 pts vs Argentina"  to="/nps" />
        <AlertBanner tone="red"   icon="●" text="52.1% de bajas sin motivo (3,048 cuentas)"   to="/tendencia" />
        <AlertBanner tone="amber" icon="●" text="Aceleración churn Feb→Abr +43.6% en 3 meses" to="/tendencia" />
        <AlertBanner tone="amber" icon="●" text="63 cuentas en tier Critical — intervención urgente" to="/cola" />
      </div>

      {/* ── Fila 2: Bento cols-3 ── */}
      <div className="bento cols-3">
        {/* Hero orange */}
        <div className="card orange lg" style={{ minHeight: 280 }}>
          <div className="bubble-wrap"><div className="bubble" /></div>
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Bajas del mes</div>
              <div className="card-title" style={{ color: "white" }}>Abril 2026</div>
            </div>
            <div className="arrow-up">↗</div>
          </div>
          <div className="bignum" style={{ fontSize: 72 }}>1,446</div>
          <div className="mt-12" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="callout">↑ +13.6% vs Mar</span>
            <span className="callout" style={{ background: "rgba(255,255,255,0.18)" }}>5,860 YTD</span>
          </div>
          <div className="mt-16" style={{ display: "flex", gap: 8, position: "relative", zIndex: 2 }}>
            <button className="btn" style={{ background: "white", color: "var(--orange-deep)" }}>Plan retención</button>
            <button className="btn ghost" style={{ borderColor: "rgba(255,255,255,0.4)", color: "white" }}>Ver detalle</button>
          </div>
        </div>

        {/* Métricas Q1 */}
        <div className="card lg">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Métricas calidad · Q1</div>
              <div className="card-title">7,044 respuestas</div>
            </div>
            <div className="arrow-up">⌁</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 24 }}>
            <Q1Metric label="NPS"  value="47.71"   tone="orange" />
            <Q1Metric label="CSAT" value="4.78/5"  tone="ink" />
            <Q1Metric label="CVR"  value="19.9%"   tone="cream" />
          </div>
          <div className="mt-16 muted fs-12">
            Argentina y México lideran · Chile bajo objetivo
          </div>
        </div>

        {/* Cuentas activas */}
        <div className="card lg">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Cuentas activas</div>
              <div className="card-title">May. 2026</div>
            </div>
            <div className="arrow-up">●</div>
          </div>
          <div className="bignum" style={{ fontSize: 64 }}>{cuentasActivas}</div>
          <div className="mt-12">
            <span className="delta-pill">▲ +63 vs Abr</span>
          </div>
          <TierMiniBars />
        </div>
      </div>

      {/* ── Fila 3: Bento 60/40 ── */}
      <div className="divider">
        <span className="kicker">Tendencia</span>
        <span className="alt">/ bajas mensuales</span>
        <span className="sub">Dic 2025 – Jun 2026 (proyectado)</span>
        <span className="rule" />
      </div>

      <div className="bento cols-2">
        <TrendCard />
        <TierDonutCard total={cuentasActivas} />
      </div>
    </Layout>
  );
}

/* ─────────────────────────────────────────── */

function AlertBanner({ tone, icon, text, to }: { tone: "red" | "amber"; icon: string; text: string; to: string }) {
  const color = tone === "red" ? "var(--red)" : "var(--amber)";
  const bg = tone === "red" ? "rgba(179,38,30,0.05)" : "rgba(181,116,15,0.06)";
  return (
    <Link
      to={to}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: bg, borderLeft: `3px solid ${color}`,
        borderRadius: "var(--radius-md)", padding: "10px 14px",
        color: "var(--ink-2)", fontSize: 12.5, textDecoration: "none",
      }}
    >
      <span style={{ color, fontSize: 10 }}>{icon}</span>
      <span style={{ flex: 1 }}>{text}</span>
      <span style={{ color, fontWeight: 500, fontSize: 12 }}>Ver →</span>
    </Link>
  );
}

function Q1Metric({ label, value, tone }: { label: string; value: string; tone: "orange" | "ink" | "cream" }) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "ink" ? "var(--ink)" : "var(--paper-2)";
  const color = tone === "cream" ? "var(--ink)" : "white";
  return (
    <div style={{
      background: bg, color, borderRadius: 14, padding: "14px 12px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div className="fs-11" style={{ opacity: tone === "cream" ? 0.6 : 0.8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function TierMiniBars() {
  const { tierDist } = useDashboardData();
  const total = tierDist.reduce((s, t) => s + t.count, 0);
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
            <span className="mono strong">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendCard() {
  const { churnTrend } = useDashboardData();
  // split real vs projected for stroke-dasharray rendering
  const data = churnTrend.map((d) => ({
    ...d,
    bajasReal: d.proyectado ? null : d.bajas,
    bajasProj: d.proyectado ? d.bajas : null,
  }));

  return (
    <div className="card lg">
      <div className="minihead">
        <div>
          <div className="card-eyebrow">Bajas vs % registrado con motivo</div>
          <div className="card-title">Crece la baja, crece la brecha</div>
        </div>
        <span className="delta-pill bad">↑ +43.6% Feb→Abr</span>
      </div>
      <div className="chart-wrap" style={{ height: 320, position: "relative" }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 24, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="trendG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={ORANGE} stopOpacity={0.25} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E8E6DC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="L" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="R" orientation="right" domain={[40, 55]} tick={{ fontSize: 11, fill: "#B5740F" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />

            <ReferenceArea yAxisId="L" x1="May*" x2="Jun*" fill="#0B0B0A" fillOpacity={0.04} label={{ value: "Forecast", position: "insideTop", fill: "#6E6D66", fontSize: 11 }} />
            <ReferenceLine yAxisId="L" y={1100} stroke="#0B0B0A" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "Target 3M (<1,100)", position: "insideTopRight", fill: "#0B0B0A", fontSize: 11 }} />

            <Area yAxisId="L" type="monotone" dataKey="bajas" stroke="none" fill="url(#trendG)" />
            <Bar yAxisId="L" dataKey="bajasReal" fill={ORANGE} radius={[6, 6, 0, 0]} barSize={28} />
            <Bar yAxisId="L" dataKey="bajasProj" radius={[6, 6, 0, 0]} barSize={28}>
              {data.map((_, i) => (
                <Cell key={i} fill={ORANGE} fillOpacity={0.35} stroke={ORANGE} strokeDasharray="3 3" />
              ))}
            </Bar>
            <Line yAxisId="R" type="monotone" dataKey="pctMotivo" stroke="#B5740F" strokeWidth={2} dot={{ r: 3, fill: "#B5740F" }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* callout flotante en Abr */}
        <div style={{
          position: "absolute", top: 36, left: "58%",
          background: "var(--ink)", color: "white",
          padding: "6px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        }}>
          ↑ +43.6% · Feb→Abr
        </div>
      </div>

      <div className="row-flex mt-16" style={{ gap: 14, fontSize: 11.5 }}>
        <LegendDot color={ORANGE} label="Bajas reales" />
        <LegendDot color={ORANGE} label="Bajas proyectadas" dashed />
        <LegendDot color="#B5740F" label="% con motivo" />
      </div>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="row-flex" style={{ gap: 6, color: "var(--ink-3)" }}>
      <span style={{
        width: 14, height: 8, borderRadius: 3,
        background: dashed ? "transparent" : color,
        border: dashed ? `1.5px dashed ${color}` : "none",
      }} />
      {label}
    </span>
  );
}

function TierDonutCard({ total }: { total: number }) {
  const { tierDist } = useDashboardData();
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
        <div style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          pointerEvents: "none", textAlign: "center",
        }}>
          <div>
            <div className="bignum" style={{ fontSize: 40, justifyContent: "center" }}>{total}</div>
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
            <span className="mono">{t.count} · {t.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// suppress unused import
void (null as ReactNode);
