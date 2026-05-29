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
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie,
} from "recharts";

const MOTIVO_PALETTE = ["#6B7280", "#2563EB", "#D97706", "#F05A28", "#7C3AED", "#DB2777", "#0D9488", "#16A34A", "#9333EA", "#0EA5E9"];

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
  const mesActivo = useMesActivo();
  const { data: insights6m } = useSupabaseChurnInsights(mesActivo);
  const { selectedPais } = useCountry();
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
          <div className="bignum" style={{ fontSize: 72 }}>{nfmt(r.bajasMesActual)}</div>
          <div className="mt-12" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.monthDeltaPct != null && (
              <span className="callout">
                {r.monthDeltaPct >= 0 ? "↑" : "↓"} {pctFmt(r.monthDeltaPct)} vs {r.prevClosedLabel}
              </span>
            )}
            <span className="callout" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", fontSize: 11 }}>
              Bajas: bloqueadas con fecha de baja asignada en {r.latestClosedLabel} y en estado Bajas o Bajas Clientes
            </span>
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
        <MotivosDonutCard rows={insights6m?.rows ?? null} />
      </div>

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
          <div className="card lg" style={{
            borderLeft: `4px solid ${
              ret.proyectadoVsPlan == null ? "var(--rule)" :
              Math.abs(ret.proyectadoVsPlan) <= 5 ? "var(--orange)" :
              ret.proyectadoVsPlan > 5 ? "var(--red)" : "#2f7d4f"
            }`
          }}>
            <div className="card-eyebrow">Churn Neto vs Plan</div>
            <div className="bignum" style={{ fontSize: 52, marginTop: 8 }}>
              {ret.churnNeto.toFixed(1)}%
            </div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>
              churn neto actual · plan {ret.churnPlan != null ? `${ret.churnPlan.toFixed(1)}%` : "—"}
            </div>
            {ret.proyectadoVsPlan != null && (
              <div style={{ marginTop: 10 }}>
                <span className={`tag ${Math.abs(ret.proyectadoVsPlan) <= 5 ? "orange" : ret.proyectadoVsPlan > 5 ? "red" : "blue"}`}>
                  {ret.proyectadoVsPlan >= 0 ? "+" : ""}{ret.proyectadoVsPlan.toFixed(1)}% vs plan
                </span>
              </div>
            )}
            <div className="fs-12 muted" style={{ marginTop: 8 }}>
              churn bruto: <strong>{ret.churnBruto.toFixed(1)}%</strong>
            </div>
          </div>

          {/* # Recuperar on target */}
          <div className="card lg" style={{ borderLeft: "4px solid var(--amber)" }}>
            <div className="card-eyebrow"># Recuperar on target</div>
            <div className="bignum" style={{ fontSize: 52, marginTop: 8 }}>
              {ret.nRecuperar != null ? nfmt(ret.nRecuperar) : "—"}
            </div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>
              cuentas extra para cumplir el plan
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
              {nfmt(ret.aRecuperar)}
            </div>
            <div className="fs-12 muted" style={{ marginTop: 6 }}>
              cuentas en Engagement / Onboarding
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="callout" style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}>
                {nfmt(ret.aRecuperarConVentas)} con ≥10 ventas/mes
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

type ChurnRowLite = { motivo: string; fechaBaja: string | null };

function MotivosDonutCard({ rows }: { rows: ChurnRowLite[] | null }) {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Default range = min/max fechaBaja en rows
  const bounds = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    let min = "9999-12-31", max = "0000-01-01";
    for (const r of rows) {
      if (!r.fechaBaja) continue;
      const d = r.fechaBaja.slice(0, 10);
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { min, max };
  }, [rows]);

  const fromEff = from || bounds?.min || "";
  const toEff = to || bounds?.max || "";

  const motivos = useMemo(() => {
    if (!rows) return null;
    const filtered = rows.filter((x) => {
      if (/nps/i.test(x.motivo)) return false;
      if (!x.fechaBaja) return false;
      const d = x.fechaBaja.slice(0, 10);
      if (fromEff && d < fromEff) return false;
      if (toEff && d > toEff) return false;
      return true;
    });
    const map = new Map<string, number>();
    for (const x of filtered) map.set(x.motivo, (map.get(x.motivo) ?? 0) + 1);
    const total = filtered.length || 1;
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    let palIdx = 0;
    return sorted.map(([motivo, n]) => {
      const brecha = /sin (motivo|respuesta)/i.test(motivo);
      return {
        motivo, n,
        pct: +((n / total) * 100).toFixed(1),
        color: brecha ? "#DC2626" : MOTIVO_PALETTE[palIdx++ % MOTIVO_PALETTE.length]!,
        brecha,
      };
    });
  }, [rows, fromEff, toEff]);

  if (!motivos) {
    return (
      <div className="card lg" style={{ display: "grid", placeItems: "center", minHeight: 320 }}>
        <div className="muted fs-12">Cargando motivos…</div>
      </div>
    );
  }
  const total = motivos.reduce((s, m) => s + m.n, 0);
  const sinMotivo = motivos.find((m) => m.brecha);
  const pctSinMotivo = sinMotivo ? (sinMotivo.n / (total || 1)) * 100 : 0;

  const inputStyle: React.CSSProperties = {
    fontSize: 12, padding: "6px 8px", border: "1px solid var(--rule)",
    borderRadius: 8, background: "white", color: "var(--ink)", fontFamily: "inherit",
  };

  return (
    <div className="card lg">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div className="card-eyebrow">Distribución de motivos</div>
          <div className="card-title serif" style={{ fontStyle: "italic" }}>{nfmt(total)} bajas categorizadas</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span className="muted fs-11">Desde</span>
          <input type="date" value={fromEff} min={bounds?.min} max={bounds?.max} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          <span className="muted fs-11">Hasta</span>
          <input type="date" value={toEff} min={bounds?.min} max={bounds?.max} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} style={{ ...inputStyle, cursor: "pointer" }}>Limpiar</button>
          )}
        </div>
      </div>
      <div className="chart-wrap" style={{ height: 380, position: "relative", background: "white" }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={motivos}
              dataKey="n"
              nameKey="motivo"
              cx="50%"
              cy="50%"
              innerRadius={95}
              outerRadius={145}
              paddingAngle={1}
              stroke="white"
              strokeWidth={2}
            >
              {motivos.map((m, i) => <Cell key={i} fill={m.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
              formatter={(v: any, _n: any, p: any) => [`${Number(v).toLocaleString()} · ${p?.payload?.pct}%`, p?.payload?.motivo]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 40, color: "#DC2626", lineHeight: 1, letterSpacing: "-0.03em" }}>{pctSinMotivo.toFixed(1)}%</div>
          <div className="serif" style={{ fontSize: 16, color: "#DC2626", marginTop: 6, fontStyle: "italic" }}>sin motivo</div>
        </div>
      </div>
    </div>
  );
}
