import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, LabelList, Cell,
} from "recharts";
import { ORANGE } from "@/data/mockData";

const MONTHS = ["Nov", "Dic", "Ene", "Feb", "Mar", "Abr"];

// ─── Mock data (shape: { pais, plan, bajas_reales, mes }) ───
type Row = { pais: string; plan: string; gmv: "Alto" | "Medio" | "Bajo"; ejecutivo: string; bajas_reales: number; mes: string };

const PAISES = ["Argentina", "Chile", "México", "Colombia", "Brasil"];
const PLANES = ["Fusión", "Pro", "Advanced", "Starter", "Básico"];
const GMVS: Array<"Alto" | "Medio" | "Bajo"> = ["Alto", "Medio", "Bajo"];
const EJECUTIVOS = ["María González", "Juan Pérez", "Lucía Fernández", "Carlos Ruiz", "Ana Torres", "Diego Méndez"];

const COUNTRY_COLORS: Record<string, string> = {
  Argentina: "#F05A28", Chile: "#1E5DBF", México: "#0E9F6E", Colombia: "#B5740F", Brasil: "#7B3FBF",
};
const EJ_COLORS = ["#F05A28", "#1E5DBF", "#0E9F6E", "#B5740F", "#7B3FBF", "#B3261E"];

// deterministic pseudo-random
function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const DATA: Row[] = (() => {
  const rows: Row[] = [];
  const rand = seedRand(42);
  MONTHS.forEach((mes, mi) => {
    PAISES.forEach((pais, pi) => {
      PLANES.forEach((plan, pli) => {
        GMVS.forEach((gmv, gi) => {
          EJECUTIVOS.forEach((ej, ei) => {
            // weights to make AR & Fusión & Alto dominant
            const w = (pais === "Argentina" ? 2.4 : pais === "Chile" ? 1.6 : pais === "México" ? 1.2 : 0.8)
              * (plan === "Fusión" ? 1.8 : plan === "Pro" ? 1.3 : plan === "Advanced" ? 1.0 : plan === "Starter" ? 0.7 : 0.5)
              * (gmv === "Alto" ? 1.5 : gmv === "Medio" ? 1.1 : 0.8)
              * (1 + mi * 0.06);
            const base = Math.max(0, Math.round(rand() * 4 * w));
            if (base === 0 && rand() > 0.4) return;
            rows.push({ pais, plan, gmv, ejecutivo: ej, bajas_reales: base, mes });
            void pi; void pli; void gi; void ei;
          });
        });
      });
    });
  });
  return rows;
})();

// active bases per dim for rate calc (mock)
const ACTIVE_BASE = {
  pais: { Argentina: 5800, Chile: 2200, México: 1800, Colombia: 900, Brasil: 700 } as Record<string, number>,
  plan: { Fusión: 4200, Pro: 2800, Advanced: 2100, Starter: 1500, Básico: 800 } as Record<string, number>,
  gmv: { Alto: 3200, Medio: 5400, Bajo: 2800 } as Record<string, number>,
  ejecutivo: Object.fromEntries(EJECUTIVOS.map((e, i) => [e, 1400 + i * 150])) as Record<string, number>,
};

function sumBy<T extends Row>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => { const k = key(r); out[k] = (out[k] ?? 0) + r.bajas_reales; });
  return out;
}

const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctfmt = (n: number, d = 2) => `${n.toFixed(d)}%`;

type Tab = "pais" | "plan" | "gmv" | "ejecutivo";

export function SegmentacionChurn() {
  const [tab, setTab] = useState<Tab>("pais");
  const [mes, setMes] = useState<string>(MONTHS[MONTHS.length - 1]);

  return (
    <div className="card lg" style={{ marginBottom: 20 }}>
      <div className="minihead" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-eyebrow">Segmentación</div>
          <div className="card-title">Bajas por dimensión</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {([
          ["pais", "Por país"],
          ["plan", "Por plan"],
          ["gmv", "Por GMV"],
          ["ejecutivo", "Por ejecutivo"],
        ] as [Tab, string][]).map(([k, label]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: active ? "1px solid var(--orange)" : "1px solid var(--rule)",
                background: active ? "var(--orange)" : "white",
                color: active ? "white" : "var(--ink-2)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "pais" && <PaisTab mes={mes} setMes={setMes} />}
      {tab === "plan" && <PlanTab mes={mes} setMes={setMes} />}
      {tab === "gmv" && <GmvTab mes={mes} setMes={setMes} />}
      {tab === "ejecutivo" && <EjecutivoTab mes={mes} setMes={setMes} />}
    </div>
  );
}

// ── Shared month selector ──
function MonthSelector({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {MONTHS.map((m) => {
        const active = m === mes;
        return (
          <button
            key={m}
            onClick={() => setMes(m)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: active ? "1px solid var(--orange)" : "1px solid var(--rule)",
              background: active ? "var(--orange)" : "white",
              color: active ? "white" : "var(--ink-2)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              minWidth: 56,
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "orange" | "ink" }) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "ink" ? "var(--ink)" : "white";
  const fg = tone === "default" ? "var(--ink)" : "white";
  const subFg = tone === "default" ? "var(--ink-3)" : "rgba(255,255,255,0.75)";
  return (
    <div style={{
      background: bg, color: fg, border: tone === "default" ? "1px solid var(--rule)" : "none",
      borderRadius: 14, padding: 16,
    }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: subFg, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 6, color: subFg }}>{sub}</div>}
    </div>
  );
}

function KpiRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

// ─────────────── Por país ───────────────
function PaisTab({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const monthRows = DATA.filter((r) => r.mes === mes);
  const byPais = sumBy(monthRows, (r) => r.pais);
  const barData = PAISES.map((p) => ({ name: p, bajas: byPais[p] ?? 0, color: COUNTRY_COLORS[p] }))
    .sort((a, b) => b.bajas - a.bajas);

  // KPIs
  const top = barData[0];
  const rates = PAISES.map((p) => ({ pais: p, rate: ((byPais[p] ?? 0) / ACTIVE_BASE.pais[p]) * 100, bajas: byPais[p] ?? 0 }));
  const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];

  // evolution: compare last month vs prev
  const prevMesIdx = Math.max(0, MONTHS.indexOf(mes) - 1);
  const prevByPais = sumBy(DATA.filter((r) => r.mes === MONTHS[prevMesIdx]), (r) => r.pais);
  const evo = PAISES.map((p) => ({ pais: p, delta: (byPais[p] ?? 0) - (prevByPais[p] ?? 0) }))
    .sort((a, b) => a.delta - b.delta)[0];

  const total = Object.values(byPais).reduce((s, v) => s + v, 0);

  // sparklines for AR & CL
  const sparkAR = MONTHS.map((m) => ({ mes: m, v: sumBy(DATA.filter((r) => r.mes === m && r.pais === "Argentina"), () => "x").x ?? 0 }));
  const sparkCL = MONTHS.map((m) => ({ mes: m, v: sumBy(DATA.filter((r) => r.mes === m && r.pais === "Chile"), () => "x").x ?? 0 }));

  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={top.name} sub={`${nfmt(top.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={worstRate.pais} sub={pctfmt(worstRate.rate)} tone="orange" />
        <KpiCard label="Mejor evolución" value={evo.pais} sub={`${evo.delta >= 0 ? "+" : ""}${evo.delta} vs ant.`} />
        <KpiCard label="Total del período" value={nfmt(total)} sub={`bajas en ${mes}`} tone="ink" />
      </KpiRow>
      <MonthSelector mes={mes} setMes={setMes} />
      <HBarChart data={barData} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <Spark title="Argentina · 6m" data={sparkAR} color={COUNTRY_COLORS.Argentina} />
        <Spark title="Chile · 6m" data={sparkCL} color={COUNTRY_COLORS.Chile} />
      </div>
    </>
  );
}

// ─────────────── Por plan ───────────────
function PlanTab({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const monthRows = DATA.filter((r) => r.mes === mes);
  const byPlan = sumBy(monthRows, (r) => r.plan);
  const barData = PLANES.map((p, i) => ({
    name: p, bajas: byPlan[p] ?? 0,
    color: [ORANGE, "#FF7A4D", "#FF9670", "#FFB394", "#FFD0B8"][i],
  })).sort((a, b) => b.bajas - a.bajas);

  const top = barData[0];
  const rates = PLANES.map((p) => ({ plan: p, rate: ((byPlan[p] ?? 0) / ACTIVE_BASE.plan[p]) * 100 }));
  const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
  const prevMesIdx = Math.max(0, MONTHS.indexOf(mes) - 1);
  const prevByPlan = sumBy(DATA.filter((r) => r.mes === MONTHS[prevMesIdx]), (r) => r.plan);
  const evo = PLANES.map((p) => ({ plan: p, delta: (byPlan[p] ?? 0) - (prevByPlan[p] ?? 0) }))
    .sort((a, b) => a.delta - b.delta)[0];
  const total = Object.values(byPlan).reduce((s, v) => s + v, 0);

  // stacked bar: planes across 6 months
  const stackedData = MONTHS.map((m) => {
    const row: any = { mes: m };
    PLANES.forEach((p) => {
      row[p] = DATA.filter((r) => r.mes === m && r.plan === p).reduce((s, r) => s + r.bajas_reales, 0);
    });
    return row;
  });
  const planColors = [ORANGE, "#FF7A4D", "#FF9670", "#FFB394", "#FFD0B8"];

  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={top.name} sub={`${nfmt(top.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={worstRate.plan} sub={pctfmt(worstRate.rate)} tone="orange" />
        <KpiCard label="Mejor evolución" value={evo.plan} sub={`${evo.delta >= 0 ? "+" : ""}${evo.delta} vs ant.`} />
        <KpiCard label="Total del período" value={nfmt(total)} sub={`bajas en ${mes}`} tone="ink" />
      </KpiRow>
      <MonthSelector mes={mes} setMes={setMes} />
      <HBarChart data={barData} />
      <div style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>Distribución por plan · últimos 6 meses</div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={stackedData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />
              {PLANES.map((p, i) => (
                <Bar key={p} dataKey={p} stackId="a" fill={planColors[i]} radius={i === PLANES.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ─────────────── Por GMV ───────────────
function GmvTab({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const monthRows = DATA.filter((r) => r.mes === mes);
  const byGmv = sumBy(monthRows, (r) => r.gmv);
  const barData = GMVS.map((g, i) => ({
    name: g === "Alto" ? "Alto (MM)" : g === "Medio" ? "Medio (B2B1+B2B2)" : "Bajo (B2C+SC)",
    bajas: byGmv[g] ?? 0,
    color: [ORANGE, "#FF9670", "#FFD0B8"][i],
  })).sort((a, b) => b.bajas - a.bajas);

  const top = barData[0];
  const rates = GMVS.map((g) => ({ seg: g, rate: ((byGmv[g] ?? 0) / ACTIVE_BASE.gmv[g]) * 100 }));
  const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
  const prevMesIdx = Math.max(0, MONTHS.indexOf(mes) - 1);
  const prevByGmv = sumBy(DATA.filter((r) => r.mes === MONTHS[prevMesIdx]), (r) => r.gmv);
  const evo = GMVS.map((g) => ({ seg: g, delta: (byGmv[g] ?? 0) - (prevByGmv[g] ?? 0) }))
    .sort((a, b) => a.delta - b.delta)[0];
  const total = Object.values(byGmv).reduce((s, v) => s + v, 0);

  // GMV en riesgo (mock: bajas * avg ticket por segmento, acumulado)
  const ticketBySeg = { Alto: 0.045, Medio: 0.012, Bajo: 0.003 };
  let acc = 0;
  const lineData = MONTHS.map((m) => {
    const monthSum = (Object.keys(ticketBySeg) as Array<keyof typeof ticketBySeg>).reduce((s, seg) => {
      const bajas = DATA.filter((r) => r.mes === m && r.gmv === seg).reduce((sm, r) => sm + r.bajas_reales, 0);
      return s + bajas * ticketBySeg[seg];
    }, 0);
    acc += monthSum;
    return { mes: m, gmv: +acc.toFixed(2) };
  });

  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={top.name.split(" ")[0]} sub={`${nfmt(top.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={worstRate.seg} sub={pctfmt(worstRate.rate)} tone="orange" />
        <KpiCard label="Mejor evolución" value={evo.seg} sub={`${evo.delta >= 0 ? "+" : ""}${evo.delta} vs ant.`} />
        <KpiCard label="Total del período" value={nfmt(total)} sub={`bajas en ${mes}`} tone="ink" />
      </KpiRow>
      <MonthSelector mes={mes} setMes={setMes} />
      <HBarChart data={barData} />
      <div style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>GMV en riesgo ($M) · acumulado 6 meses</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} formatter={(v: any) => [`$${v}M`, "GMV"]} />
              <Line type="monotone" dataKey="gmv" stroke={ORANGE} strokeWidth={2.5} dot={{ fill: ORANGE, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ─────────────── Por ejecutivo ───────────────
function EjecutivoTab({ mes, setMes }: { mes: string; setMes: (m: string) => void }) {
  const monthRows = DATA.filter((r) => r.mes === mes);
  const byEj = sumBy(monthRows, (r) => r.ejecutivo);
  const rows = EJECUTIVOS.map((e, i) => {
    const bajas = byEj[e] ?? 0;
    const rate = (bajas / ACTIVE_BASE.ejecutivo[e]) * 100;
    return { ej: e, bajas, rate, color: EJ_COLORS[i] };
  }).sort((a, b) => b.rate - a.rate);

  const top = rows.slice().sort((a, b) => b.bajas - a.bajas)[0];
  const worst = rows[0];
  const prevByEj = sumBy(DATA.filter((r) => r.mes === MONTHS[Math.max(0, MONTHS.indexOf(mes) - 1)]), (r) => r.ejecutivo);
  const evo = EJECUTIVOS.map((e) => ({ ej: e, delta: (byEj[e] ?? 0) - (prevByEj[e] ?? 0) })).sort((a, b) => a.delta - b.delta)[0];
  const total = Object.values(byEj).reduce((s, v) => s + v, 0);

  const lineData = MONTHS.map((m) => {
    const row: any = { mes: m };
    EJECUTIVOS.forEach((e) => {
      const b = DATA.filter((r) => r.mes === m && r.ejecutivo === e).reduce((s, r) => s + r.bajas_reales, 0);
      row[e] = +((b / ACTIVE_BASE.ejecutivo[e]) * 100).toFixed(2);
    });
    return row;
  });

  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={initials(top.ej)} sub={`${top.ej.split(" ")[0]} · ${nfmt(top.bajas)}`} />
        <KpiCard label="Mayor tasa" value={initials(worst.ej)} sub={pctfmt(worst.rate)} tone="orange" />
        <KpiCard label="Mejor evolución" value={initials(evo.ej)} sub={`${evo.delta >= 0 ? "+" : ""}${evo.delta} vs ant.`} />
        <KpiCard label="Total del período" value={nfmt(total)} sub={`bajas en ${mes}`} tone="ink" />
      </KpiRow>
      <MonthSelector mes={mes} setMes={setMes} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const isHigh = r.rate > 4.5;
          return (
            <div key={r.ej} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 10, background: "white",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: r.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600,
              }}>
                {initials(r.ej)}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.ej}</div>
              <span className={`tag ${isHigh ? "red" : "blue"}`} style={{ minWidth: 90, textAlign: "center" }}>
                {isHigh ? "↑" : "↓"} {pctfmt(r.rate)}
              </span>
              <div className="mono" style={{ fontSize: 13, minWidth: 60, textAlign: "right" }}>{nfmt(r.bajas)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>Churn rate por ejecutivo · 6 meses</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} formatter={(v: any) => [`${v}%`, ""]} />
              {EJECUTIVOS.map((e, i) => (
                <Line key={e} type="monotone" dataKey={e} stroke={EJ_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          {EJECUTIVOS.map((e, i) => (
            <div key={e} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: EJ_COLORS[i] }} />
              {e}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Horizontal bar chart ──
function HBarChart({ data }: { data: { name: string; bajas: number; color: string }[] }) {
  return (
    <div style={{ height: Math.max(180, data.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#E8E6DC" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#2B2B27" }} axisLine={false} tickLine={false} width={140} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} cursor={{ fill: "#F2F0E9" }} />
          <Bar dataKey="bajas" radius={[0, 6, 6, 0]} barSize={22}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey="bajas" position="right" style={{ fontSize: 11, fill: "#0B0B0A", fontWeight: 500 }} formatter={(v: any) => Number(v).toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Spark({ title, data, color }: { title: string; data: { mes: string; v: number }[]; color: string }) {
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 12, padding: 12 }}>
      <div className="card-eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ height: 80 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6DC" }} />
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

void useMemo;
