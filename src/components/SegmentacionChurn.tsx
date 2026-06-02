import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Cell, LabelList,
} from "recharts";
import { ORANGE } from "@/data/mockData";
import { useMesActivo } from "@/data/dataset-store";
import { useState } from "react";
import {
  useSupabaseSegmentacion,
  PAISES_ORDER, PLANES_ORDER, GMVS_ORDER,
  type SegmentacionData, type BajaRow, type GmvSeg,
} from "@/data/supabase-segmentacion";

const COUNTRY_COLORS: Record<string, string> = {
  Argentina: "#F4A07A", Chile: "#7BAEE8", México: "#6FCFB2",
  Colombia: "#E4B06E", Brasil: "#B48FD9", Otros: "#C8C7C4",
};
const PLAN_COLORS: Record<string, string> = {
  Inicial: "#7BAEE8", Avanzado: "#F4A07A", Pro: "#B48FD9", Base: "#C8C7C4",
};
const GMV_COLORS: Record<string, string> = {
  Alto: "#F4A07A", Medio: "#6FCFB2", Bajo: "#B48FD9",
};
const EJ_COLORS = [
  "#F05A28", "#1E5DBF", "#0E9F6E", "#B5740F", "#7B3FBF",
  "#B3261E", "#3A7D9E", "#9E563A", "#5E3A9E", "#3A9E5E",
];

const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctfmt = (n: number, d = 2) => `${n.toFixed(d)}%`;

type Tab = "pais" | "plan" | "gmv" | "ejecutivo";

export function SegmentacionChurn() {
  const mesActivo = useMesActivo();
  const { data, isLoading, error } = useSupabaseSegmentacion(mesActivo);
  const [tab, setTab] = useState<Tab>("pais");

  return (
    <div className="card lg" style={{ marginBottom: 20 }}>
      <div className="minihead" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-eyebrow">Segmentación</div>
          <div className="card-title">Bajas por dimensión</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {([ ["pais", "Por país"], ["plan", "Por plan"], ["gmv", "Por GMV"], ["ejecutivo", "Por ejecutivo"] ] as [Tab, string][]).map(([k, label]) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "8px 16px", borderRadius: 999,
              border: active ? "1px solid var(--orange)" : "1px solid var(--rule)",
              background: active ? "var(--orange)" : "white",
              color: active ? "white" : "var(--ink-2)",
              fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {isLoading && <div className="fs-12 muted">Cargando segmentación…</div>}
      {error && <div className="fs-12" style={{ color: "#DC2626" }}>Error cargando datos</div>}
      {data && (
        <>
          {tab === "pais"      && <PaisTab      data={data} />}
          {tab === "plan"      && <PlanTab      data={data} />}
          {tab === "gmv"       && <GmvTab       data={data} />}
          {tab === "ejecutivo" && <EjecutivoTab data={data} />}
        </>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, tone = "default" }: {
  label: string; value: string; sub?: string; tone?: "default" | "orange" | "ink";
}) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "ink" ? "var(--ink)" : "white";
  const fg = tone === "default" ? "var(--ink)" : "white";
  const subFg = tone === "default" ? "var(--ink-3)" : "rgba(255,255,255,0.75)";
  return (
    <div style={{ background: bg, color: fg, border: tone === "default" ? "1px solid var(--rule)" : "none", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: subFg, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, lineHeight: 1.1, wordBreak: "break-word" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 6, color: subFg }}>{sub}</div>}
    </div>
  );
}

// ── Evolución apilada 100% por dimensión ─────────────────────────────────────
// Normaliza cada mes a 100% para que todas las barras tengan la misma altura.
// El tooltip muestra tanto el % como el absoluto (contexto sin eje inflado).
function StackedEvolution({
  data, dimensionKeys, getKey, colors, title,
}: {
  data: SegmentacionData;
  dimensionKeys: string[];
  getKey: (r: BajaRow) => string | null;
  colors: Record<string, string>;
  title: string;
}) {
  const chartData = useMemo(() => data.months.map((mm) => {
    const counts: Record<string, number> = {};
    for (const k of dimensionKeys) {
      counts[k] = data.rows.filter((r) => r.mesKey === mm.key && getKey(r) === k).length;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    const row: Record<string, unknown> = { mes: mm.label, _total: total };
    for (const k of dimensionKeys) {
      row[k] = +((( counts[k] ?? 0) / total) * 100).toFixed(1);
    }
    return row;
  }), [data, dimensionKeys, getKey]);

  return (
    <div>
      <div className="card-eyebrow" style={{ marginBottom: 8 }}>{title} · composición mensual</div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#E8E6DC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false}
              unit="%" domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
              formatter={(v: any, name: any, item: any) => {
                const total = item?.payload?._total ?? 0;
                const abs = Math.round(Number(v) * total / 100);
                return [`${Number(v).toFixed(1)}% (${nfmt(abs)} bajas)`, name];
              }}
              labelFormatter={(label: any, payload: any) =>
                `${label} · ${nfmt(payload?.[0]?.payload?._total ?? 0)} bajas totales`
              }
            />
            {dimensionKeys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="a"
                fill={colors[k] ?? EJ_COLORS[i % EJ_COLORS.length]!}
                radius={i === dimensionKeys.length - 1 ? [4, 4, 0, 0] : 0}
              >
                <LabelList
                  dataKey={k}
                  position="center"
                  style={{ fontSize: 10, fill: "#2B2B27", fontWeight: 600, pointerEvents: "none" }}
                  formatter={(v: unknown) => Number(v) >= 8 ? k : ""}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
        {dimensionKeys.map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-2)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[k] ?? "#9CA3AF", flexShrink: 0 }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────── Por país ────────────────────────────────────────────────────
function PaisTab({ data }: { data: SegmentacionData }) {
  const latestKey = data.months[data.months.length - 1]?.key ?? "";
  const latestLabel = data.months[data.months.length - 1]?.label ?? "";

  const m = useMemo(() => {
    const curr: Record<string, number> = {};
    for (const p of PAISES_ORDER) {
      curr[p] = data.rows.filter((r) => r.mesKey === latestKey && r.pais === p).length;
    }
    const total = Object.values(curr).reduce((s, v) => s + v, 0);
    const top = [...PAISES_ORDER].sort((a, b) => (curr[b] ?? 0) - (curr[a] ?? 0))[0];
    const rates = PAISES_ORDER.map((p) => {
      const base = data.activeBase.pais[p] ?? 0;
      return { name: p as string, rate: base > 0 ? ((curr[p] ?? 0) / base) * 100 : 0 };
    }).filter((r) => r.rate > 0);
    const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
    const totalBase = Object.values(data.activeBase.pais).reduce((s, v) => s + v, 0);
    const totalRate = totalBase > 0 ? (total / totalBase) * 100 : 0;
    return { curr, total, top, worstRate, totalRate };
  }, [data, latestKey]);

  const getPais = (r: BajaRow) => r.pais as string;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Mayor volumen" value={m.top ?? "—"}
          sub={m.top ? `${nfmt(m.curr[m.top] ?? 0)} bajas · ${latestLabel}` : ""} />
        <KpiCard label="Mayor tasa" value={m.worstRate?.name ?? "—"}
          sub={m.worstRate ? pctfmt(m.worstRate.rate) : ""} tone="orange" />
        <KpiCard label="Churn rate total" value={pctfmt(m.totalRate)}
          sub={`${nfmt(m.total)} bajas · ${latestLabel}`} />
        <KpiCard label="Tasa por base" value={m.worstRate ? pctfmt(m.worstRate.rate) : "—"}
          sub={`${m.worstRate?.name ?? ""} · mayor tasa`} tone="ink" />
      </div>
      <StackedEvolution
        data={data}
        dimensionKeys={[...PAISES_ORDER] as string[]}
        getKey={getPais}
        colors={COUNTRY_COLORS}
        title="Bajas por país"
      />
    </>
  );
}

// ─────────────── Por plan ─────────────────────────────────────────────────────
function PlanTab({ data }: { data: SegmentacionData }) {
  const latestKey = data.months[data.months.length - 1]?.key ?? "";
  const latestLabel = data.months[data.months.length - 1]?.label ?? "";

  const m = useMemo(() => {
    const curr: Record<string, number> = {};
    for (const p of PLANES_ORDER) {
      curr[p] = data.rows.filter((r) => r.mesKey === latestKey && r.planBase === p).length;
    }
    const total = Object.values(curr).reduce((s, v) => s + v, 0);
    const top = [...PLANES_ORDER].sort((a, b) => (curr[b] ?? 0) - (curr[a] ?? 0))[0];
    // Tasa por plan: bajas del período / base activa del plan
    const planRates = PLANES_ORDER.filter(p => p !== "Base").map((p) => {
      const base = data.activeBase.plan[p] ?? 0;
      const bajas = curr[p] ?? 0;
      return { name: p as string, rate: base > 0 ? (bajas / base) * 100 : 0, bajas, base };
    }).filter((r) => r.base > 0).sort((a, b) => b.rate - a.rate);
    const worstRate = planRates[0];
    const totalBase = Object.values(data.activeBase.plan).reduce((s, v) => s + v, 0);
    const totalRate = totalBase > 0 ? (total / totalBase) * 100 : 0;
    const maxRate = Math.max(...planRates.map(r => r.rate), 0.01);
    return { curr, total, top, worstRate, totalRate, planRates, maxRate };
  }, [data, latestKey]);

  const getPlan = (r: BajaRow) => r.planBase as string | null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Mayor volumen" value={m.top ?? "—"}
          sub={m.top ? `${nfmt(m.curr[m.top] ?? 0)} bajas · ${latestLabel}` : ""} />
        <KpiCard label="Mayor tasa" value={m.worstRate?.name ?? "—"}
          sub={m.worstRate ? `${pctfmt(m.worstRate.rate)} · sobre base del plan` : ""} tone="orange" />
        <KpiCard label="Churn rate total" value={pctfmt(m.totalRate)}
          sub={`${nfmt(m.total)} bajas · ${latestLabel}`} />
      </div>

      {/* Tasa de churn por plan sobre base activa */}
      <div style={{ marginBottom: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 12 }}>
          Tasa de churn por plan · bajas / base activa · {latestLabel}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {m.planRates.map((r) => {
            const accent = PLAN_COLORS[r.name] ?? "var(--orange)";
            const isHigh = r.rate > 5;
            return (
              <div key={r.name} style={{
                borderRadius: 14, padding: "16px 18px",
                border: `2px solid ${accent}`,
                background: "var(--paper)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: accent, marginBottom: 6 }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: isHigh ? "#DC2626" : "var(--ink)", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                  {pctfmt(r.rate)}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{nfmt(r.bajas)}</span> bajas
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
                  de <span style={{ fontVariantNumeric: "tabular-nums" }}>{nfmt(r.base)}</span> activas
                </div>
              </div>
            );
          })}

          {/* Tarjeta de diagnóstico: plan más afectado */}
          {(() => {
            const worst = m.planRates[0];
            const best  = m.planRates[m.planRates.length - 1];
            if (!worst || !best || worst.name === best.name) return null;
            const ratio = best.rate > 0 ? (worst.rate / best.rate) : null;
            return (
              <div style={{
                borderRadius: 14, padding: "16px 18px",
                background: "#FEF2F2", border: "2px solid #FECACA",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#DC2626", marginBottom: 6 }}>
                  MÁS AFECTADO
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: "#DC2626", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                  {worst.name}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                  {pctfmt(worst.rate)} de su base se da de baja
                </div>
                {ratio != null && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#B91C1C" }}>
                    {ratio.toFixed(1)}× más que {best.name} ({pctfmt(best.rate)})
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <StackedEvolution
        data={data}
        dimensionKeys={[...PLANES_ORDER] as string[]}
        getKey={getPlan}
        colors={PLAN_COLORS}
        title="Composición de bajas por plan"
      />
    </>
  );
}

// ─────────────── Por GMV ──────────────────────────────────────────────────────
function GmvTab({ data }: { data: SegmentacionData }) {
  const latestKey = data.months[data.months.length - 1]?.key ?? "";
  const latestLabel = data.months[data.months.length - 1]?.label ?? "";

  const m = useMemo(() => {
    const curr: Record<string, number> = {};
    for (const g of GMVS_ORDER) {
      curr[g] = data.rows.filter((r) => r.mesKey === latestKey && r.gmvSeg === g).length;
    }
    const total = Object.values(curr).reduce((s, v) => s + v, 0);
    const top = [...GMVS_ORDER].sort((a, b) => (curr[b] ?? 0) - (curr[a] ?? 0))[0];
    const rates = GMVS_ORDER.map((g) => {
      const base = data.activeBase.gmv[g] ?? 0;
      return { name: g as string, rate: base > 0 ? ((curr[g] ?? 0) / base) * 100 : 0 };
    }).filter((r) => r.rate > 0);
    const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
    const totalBase = Object.values(data.activeBase.gmv).reduce((s, v) => s + v, 0);
    const totalRate = totalBase > 0 ? (total / totalBase) * 100 : 0;

    // GMV en riesgo acumulado
    const ticket: Record<GmvSeg, number> = { Alto: 0.15, Medio: 0.05, Bajo: 0.015 };
    let acc = 0;
    const lineData = data.months.map((mm) => {
      const monthSum = GMVS_ORDER.reduce((s, g) => {
        const n = data.rows.filter((r) => r.mesKey === mm.key && r.gmvSeg === g).length;
        return s + n * ticket[g];
      }, 0);
      acc += monthSum;
      return { mes: mm.label, gmv: +acc.toFixed(2) };
    });
    return { curr, total, top, worstRate, totalRate, lineData };
  }, [data, latestKey]);

  const getGmv = (r: BajaRow) => r.gmvSeg as string | null;
  const labelMap: Record<string, string> = {
    Alto: "Alto (MM)", Medio: "Medio (B2B1+B2B2)", Bajo: "Bajo (B2C+SC)",
  };
  const gmvColors = Object.fromEntries(
    Object.entries(GMV_COLORS).map(([k, v]) => [labelMap[k] ?? k, v])
  );
  const getGmvLabel = (r: BajaRow) => r.gmvSeg ? (labelMap[r.gmvSeg] ?? r.gmvSeg) : null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Mayor volumen" value={labelMap[m.top ?? ""] ?? m.top ?? "—"}
          sub={m.top ? `${nfmt(m.curr[m.top] ?? 0)} bajas · ${latestLabel}` : ""} />
        <KpiCard label="Mayor tasa" value={labelMap[m.worstRate?.name ?? ""] ?? m.worstRate?.name ?? "—"}
          sub={m.worstRate ? `${pctfmt(m.worstRate.rate)} · sobre base segmento` : ""} tone="orange" />
        <KpiCard label="Churn rate total" value={pctfmt(m.totalRate)}
          sub={`${nfmt(m.total)} bajas · ${latestLabel}`} />
        <KpiCard label="GMV en riesgo" value={`$${m.lineData[m.lineData.length - 1]?.gmv ?? 0}M`}
          sub="acumulado 6 meses" tone="ink" />
      </div>
      <StackedEvolution
        data={data}
        dimensionKeys={GMVS_ORDER.map((g) => labelMap[g] ?? g)}
        getKey={getGmvLabel}
        colors={gmvColors}
        title="Bajas por segmento GMV"
      />
      <div style={{ marginTop: 20 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>GMV en riesgo ($M) · acumulado</div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={m.lineData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} formatter={(v: any) => [`$${v}M`, "GMV acum."]} />
              <Line type="monotone" dataKey="gmv" stroke={ORANGE} strokeWidth={2.5} dot={{ fill: ORANGE, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ─────────────── Por ejecutivo ───────────────────────────────────────────────
function EjecutivoTab({ data }: { data: SegmentacionData }) {
  const latestKey = data.months[data.months.length - 1]?.key ?? "";

  const m = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of data.rows) {
      if (r.ejecutivo !== "Sin asignar") totals[r.ejecutivo] = (totals[r.ejecutivo] ?? 0) + 1;
    }
    const top10 = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x[0]);
    const curr: Record<string, number> = {};
    for (const r of data.rows) {
      if (r.mesKey === latestKey) curr[r.ejecutivo] = (curr[r.ejecutivo] ?? 0) + 1;
    }
    const rows = top10.map((e, i) => {
      const bajas = curr[e] ?? 0;
      const base = data.activeBase.ejecutivo[e] ?? 0;
      const rate = base > 0 ? (bajas / base) * 100 : 0;
      return { ej: e, bajas, rate, color: EJ_COLORS[i % EJ_COLORS.length]! };
    }).sort((a, b) => b.rate - a.rate);

    const worst = rows[0];
    const topVol = [...rows].sort((a, b) => b.bajas - a.bajas)[0];

    const lineData = data.months.map((mm) => {
      const row: Record<string, unknown> = { mes: mm.label };
      top10.forEach((e) => {
        const n = data.rows.filter((r) => r.mesKey === mm.key && r.ejecutivo === e).length;
        const base = data.activeBase.ejecutivo[e] ?? 0;
        row[e] = base > 0 ? +((n / base) * 100).toFixed(2) : 0;
      });
      return row;
    });
    return { rows, worst, topVol, top10, lineData };
  }, [data, latestKey]);

  if (!m.topVol) return <div className="fs-12 muted">Sin datos de ejecutivos.</div>;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Mayor volumen" value={initials(m.topVol.ej)} sub={`${firstName(m.topVol.ej)} · ${nfmt(m.topVol.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={m.worst ? initials(m.worst.ej) : "—"} sub={m.worst ? `${firstName(m.worst.ej)} · ${pctfmt(m.worst.rate)}` : ""} tone="orange" />
        <KpiCard label="Top 10 ejecutivos" value={`${m.rows.length}`} sub="con bajas en el período" />
        <KpiCard label="Tasa más alta" value={m.worst ? pctfmt(m.worst.rate) : "—"} sub={m.worst ? `${firstName(m.worst.ej)} · sobre su base` : ""} tone="ink" />
      </div>

      {/* Lista rate por ejecutivo */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {m.rows.map((r) => (
          <div key={r.ej} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 10, background: "white" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: r.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>
              {initials(r.ej)}
            </div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.ej}</div>
            <span className={`tag ${r.rate > 4.5 ? "red" : "blue"}`} style={{ minWidth: 90, textAlign: "center" }}>
              {r.rate > 4.5 ? "↑" : "↓"} {pctfmt(r.rate)}
            </span>
            <div className="mono" style={{ fontSize: 12, minWidth: 80, textAlign: "right", color: "var(--ink-3)" }}>
              {nfmt(r.bajas)} bajas
            </div>
          </div>
        ))}
      </div>

      {/* Evolución de tasa % por ejecutivo */}
      <div className="card-eyebrow" style={{ marginBottom: 8 }}>Churn rate % · 6 meses · top 10 ejecutivos</div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={m.lineData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#E8E6DC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} formatter={(v: any) => [`${v}%`, ""]} />
            {m.top10.map((e, i) => (
              <Line key={e} type="monotone" dataKey={e} stroke={EJ_COLORS[i % EJ_COLORS.length]!} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {m.top10.map((e, i) => (
          <div key={e} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: EJ_COLORS[i % EJ_COLORS.length] }} />
            {e}
          </div>
        ))}
      </div>
    </>
  );
}

function initials(name: string): string {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}
function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
