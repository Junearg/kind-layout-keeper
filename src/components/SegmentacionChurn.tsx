import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, LabelList, Cell,
} from "recharts";
import { ORANGE } from "@/data/mockData";
import { useMesActivo } from "@/data/dataset-store";
import {
  useSupabaseSegmentacion,
  PAISES_ORDER, PLANES_ORDER, GMVS_ORDER,
  type SegmentacionData, type BajaRow, type PaisSeg, type PlanBase, type GmvSeg,
} from "@/data/supabase-segmentacion";

const COUNTRY_COLORS: Record<string, string> = {
  Argentina: "#F05A28", Chile: "#1E5DBF", México: "#0E9F6E",
  Colombia: "#B5740F", Brasil: "#7B3FBF", Otros: "#6E6D66",
};
const PLAN_COLORS = [ORANGE, "#FF7A4D", "#FF9670", "#FFB394"];
const GMV_COLORS = [ORANGE, "#FF9670", "#FFD0B8"];
const EJ_COLORS = ["#F05A28", "#1E5DBF", "#0E9F6E", "#B5740F", "#7B3FBF", "#B3261E", "#3A7D9E", "#9E563A", "#5E3A9E", "#3A9E5E"];

const nfmt = (n: number) => n.toLocaleString("es-AR");
const pctfmt = (n: number, d = 2) => `${n.toFixed(d)}%`;

type Tab = "pais" | "plan" | "gmv" | "ejecutivo";

export function SegmentacionChurn() {
  const mesActivo = useMesActivo();
  const { data, isLoading, error } = useSupabaseSegmentacion(mesActivo);
  const [tab, setTab] = useState<Tab>("pais");
  const [mesKey, setMesKey] = useState<string | null>(null);

  const activeMesKey = mesKey ?? data?.months[data.months.length - 1]?.key ?? null;

  return (
    <div className="card lg" style={{ marginBottom: 20 }}>
      <div className="minihead" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-eyebrow">Segmentación</div>
          <div className="card-title">Bajas por dimensión</div>
        </div>
      </div>

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
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isLoading && <div className="fs-12 muted">Cargando segmentación…</div>}
      {error && <div className="fs-12" style={{ color: "#DC2626" }}>Error cargando datos</div>}
      {data && activeMesKey && (
        <>
          {tab === "pais" && <PaisTab data={data} mesKey={activeMesKey} setMesKey={setMesKey} />}
          {tab === "plan" && <PlanTab data={data} mesKey={activeMesKey} setMesKey={setMesKey} />}
          {tab === "gmv" && <GmvTab data={data} mesKey={activeMesKey} setMesKey={setMesKey} />}
          {tab === "ejecutivo" && <EjecutivoTab data={data} mesKey={activeMesKey} setMesKey={setMesKey} />}
        </>
      )}
    </div>
  );
}

function MonthSelector({
  data, mesKey, setMesKey,
}: { data: SegmentacionData; mesKey: string; setMesKey: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {data.months.map((m) => {
        const active = m.key === mesKey;
        return (
          <button
            key={m.key}
            onClick={() => setMesKey(m.key)}
            style={{
              padding: "6px 14px", borderRadius: 8,
              border: active ? "1px solid var(--orange)" : "1px solid var(--rule)",
              background: active ? "var(--orange)" : "white",
              color: active ? "white" : "var(--ink-2)",
              fontSize: 12, fontWeight: 500, cursor: "pointer", minWidth: 56,
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({
  label, value, sub, tone = "default",
}: { label: string; value: string; sub?: string; tone?: "default" | "orange" | "ink" }) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "ink" ? "var(--ink)" : "white";
  const fg = tone === "default" ? "var(--ink)" : "white";
  const subFg = tone === "default" ? "var(--ink-3)" : "rgba(255,255,255,0.75)";
  return (
    <div style={{
      background: bg, color: fg,
      border: tone === "default" ? "1px solid var(--rule)" : "none",
      borderRadius: 14, padding: 16,
    }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: subFg, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, lineHeight: 1.1, wordBreak: "break-word" }}>{value}</div>
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

// ── Helpers de agregación ──
function countByKeyForMonth<K extends string>(
  rows: BajaRow[], mesKey: string, key: (r: BajaRow) => K | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.mesKey !== mesKey) continue;
    const k = key(r);
    if (k == null) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
function countByKeyAll<K extends string>(
  rows: BajaRow[], key: (r: BajaRow) => K | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    if (k == null) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
function bestEvolution(curr: Record<string, number>, prev: Record<string, number>, keys: string[]) {
  return keys.map((k) => ({ k, delta: (curr[k] ?? 0) - (prev[k] ?? 0) })).sort((a, b) => a.delta - b.delta)[0];
}

// ─────────────── Por país ───────────────
function PaisTab({ data, mesKey, setMesKey }: { data: SegmentacionData; mesKey: string; setMesKey: (k: string) => void }) {
  const m = useMemo(() => {
    const curr = countByKeyForMonth(data.rows, mesKey, (r) => r.pais);
    const idx = data.months.findIndex((x) => x.key === mesKey);
    const prevKey = idx > 0 ? data.months[idx - 1]!.key : mesKey;
    const prev = countByKeyForMonth(data.rows, prevKey, (r) => r.pais);
    const barData = PAISES_ORDER.map((p) => ({
      name: p as string, bajas: curr[p] ?? 0, color: COUNTRY_COLORS[p],
    })).sort((a, b) => b.bajas - a.bajas);
    const top = barData[0];
    const rates = PAISES_ORDER.map((p) => {
      const base = data.activeBase.pais[p] ?? 0;
      const bajas = curr[p] ?? 0;
      return { name: p as string, rate: base > 0 ? (bajas / base) * 100 : 0 };
    }).filter((r) => (data.activeBase.pais[r.name] ?? 0) > 0);
    const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
    const evo = bestEvolution(curr, prev, PAISES_ORDER as unknown as string[]);
    const total = Object.values(curr).reduce((s, v) => s + v, 0);
    return { barData, top, worstRate, evo, total };
  }, [data, mesKey]);

  const sparkAR = useMemo(() => data.months.map((mm) => ({
    mes: mm.label, v: data.rows.filter((r) => r.mesKey === mm.key && r.pais === "Argentina").length,
  })), [data]);
  const sparkCL = useMemo(() => data.months.map((mm) => ({
    mes: mm.label, v: data.rows.filter((r) => r.mesKey === mm.key && r.pais === "Chile").length,
  })), [data]);

  if (!m.top) return null;
  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={m.top.name} sub={`${nfmt(m.top.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={m.worstRate?.name ?? "—"} sub={m.worstRate ? pctfmt(m.worstRate.rate) : ""} tone="orange" />
        <KpiCard label="Mejor evolución" value={m.evo?.k ?? "—"} sub={m.evo ? `${m.evo.delta >= 0 ? "+" : ""}${m.evo.delta} vs ant.` : ""} />
        <KpiCard label="Total del período" value={nfmt(m.total)} sub={`bajas en ${data.months.find((x) => x.key === mesKey)?.label ?? ""}`} tone="ink" />
      </KpiRow>
      <MonthSelector data={data} mesKey={mesKey} setMesKey={setMesKey} />
      <HBarChart data={m.barData} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <Spark title="Argentina · 6m" data={sparkAR} color={COUNTRY_COLORS.Argentina} />
        <Spark title="Chile · 6m" data={sparkCL} color={COUNTRY_COLORS.Chile} />
      </div>
    </>
  );
}

// ─────────────── Por plan ───────────────
function PlanTab({ data, mesKey, setMesKey }: { data: SegmentacionData; mesKey: string; setMesKey: (k: string) => void }) {
  const m = useMemo(() => {
    const curr = countByKeyForMonth(data.rows, mesKey, (r) => r.planBase);
    const idx = data.months.findIndex((x) => x.key === mesKey);
    const prevKey = idx > 0 ? data.months[idx - 1]!.key : mesKey;
    const prev = countByKeyForMonth(data.rows, prevKey, (r) => r.planBase);
    const barData = PLANES_ORDER.map((p, i) => ({
      name: p as string, bajas: curr[p] ?? 0, color: PLAN_COLORS[i % PLAN_COLORS.length]!,
    })).sort((a, b) => b.bajas - a.bajas);
    const top = barData[0];
    const rates = PLANES_ORDER.map((p) => {
      const base = data.activeBase.plan[p] ?? 0;
      return { name: p as string, rate: base > 0 ? ((curr[p] ?? 0) / base) * 100 : 0 };
    }).filter((r) => (data.activeBase.plan[r.name] ?? 0) > 0);
    const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
    const evo = bestEvolution(curr, prev, PLANES_ORDER as unknown as string[]);
    const total = Object.values(curr).reduce((s, v) => s + v, 0);
    const stacked = data.months.map((mm) => {
      const row: any = { mes: mm.label };
      PLANES_ORDER.forEach((p) => {
        row[p] = data.rows.filter((r) => r.mesKey === mm.key && r.planBase === p).length;
      });
      return row;
    });
    return { barData, top, worstRate, evo, total, stacked };
  }, [data, mesKey]);

  if (!m.top) return null;
  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={m.top.name} sub={`${nfmt(m.top.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={m.worstRate?.name ?? "—"} sub={m.worstRate ? pctfmt(m.worstRate.rate) : ""} tone="orange" />
        <KpiCard label="Mejor evolución" value={m.evo?.k ?? "—"} sub={m.evo ? `${m.evo.delta >= 0 ? "+" : ""}${m.evo.delta} vs ant.` : ""} />
        <KpiCard label="Total del período" value={nfmt(m.total)} sub={`bajas en ${data.months.find((x) => x.key === mesKey)?.label ?? ""}`} tone="ink" />
      </KpiRow>
      <MonthSelector data={data} mesKey={mesKey} setMesKey={setMesKey} />
      <HBarChart data={m.barData} />
      <div style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>Distribución por plan · últimos 6 meses</div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={m.stacked} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />
              {PLANES_ORDER.map((p, i) => (
                <Bar key={p} dataKey={p} stackId="a" fill={PLAN_COLORS[i % PLAN_COLORS.length]!} radius={i === PLANES_ORDER.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ─────────────── Por GMV ───────────────
function GmvTab({ data, mesKey, setMesKey }: { data: SegmentacionData; mesKey: string; setMesKey: (k: string) => void }) {
  const m = useMemo(() => {
    const curr = countByKeyForMonth(data.rows, mesKey, (r) => r.gmvSeg);
    const idx = data.months.findIndex((x) => x.key === mesKey);
    const prevKey = idx > 0 ? data.months[idx - 1]!.key : mesKey;
    const prev = countByKeyForMonth(data.rows, prevKey, (r) => r.gmvSeg);
    const labelMap: Record<GmvSeg, string> = { Alto: "Alto (MM)", Medio: "Medio (B2B1+B2B2)", Bajo: "Bajo (B2C+SC)" };
    const barData = GMVS_ORDER.map((g, i) => ({
      name: labelMap[g], bajas: curr[g] ?? 0, color: GMV_COLORS[i]!,
    })).sort((a, b) => b.bajas - a.bajas);
    const top = barData[0];
    const rates = GMVS_ORDER.map((g) => {
      const base = data.activeBase.gmv[g] ?? 0;
      return { name: g as string, rate: base > 0 ? ((curr[g] ?? 0) / base) * 100 : 0 };
    }).filter((r) => (data.activeBase.gmv[r.name] ?? 0) > 0);
    const worstRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
    const evo = bestEvolution(curr, prev, GMVS_ORDER as unknown as string[]);
    const total = Object.values(curr).reduce((s, v) => s + v, 0);

    // GMV en riesgo: bajas * ticket promedio por segmento, acumulado.
    const ticket: Record<GmvSeg, number> = { Alto: 0.15, Medio: 0.05, Bajo: 0.015 }; // $M por baja (mock factor)
    let acc = 0;
    const lineData = data.months.map((mm) => {
      const monthSum = GMVS_ORDER.reduce((s, g) => {
        const n = data.rows.filter((r) => r.mesKey === mm.key && r.gmvSeg === g).length;
        return s + n * ticket[g];
      }, 0);
      acc += monthSum;
      return { mes: mm.label, gmv: +acc.toFixed(2) };
    });
    return { barData, top, worstRate, evo, total, lineData };
  }, [data, mesKey]);

  if (!m.top) return null;
  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={m.top.name.split(" ")[0]!} sub={`${nfmt(m.top.bajas)} bajas`} />
        <KpiCard label="Mayor tasa" value={m.worstRate?.name ?? "—"} sub={m.worstRate ? pctfmt(m.worstRate.rate) : ""} tone="orange" />
        <KpiCard label="Mejor evolución" value={m.evo?.k ?? "—"} sub={m.evo ? `${m.evo.delta >= 0 ? "+" : ""}${m.evo.delta} vs ant.` : ""} />
        <KpiCard label="Total del período" value={nfmt(m.total)} sub={`bajas en ${data.months.find((x) => x.key === mesKey)?.label ?? ""}`} tone="ink" />
      </KpiRow>
      <MonthSelector data={data} mesKey={mesKey} setMesKey={setMesKey} />
      <HBarChart data={m.barData} />
      <div style={{ marginTop: 16 }}>
        <div className="card-eyebrow" style={{ marginBottom: 8 }}>GMV en riesgo ($M) · acumulado 6 meses</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={m.lineData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
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
function EjecutivoTab({ data, mesKey, setMesKey }: { data: SegmentacionData; mesKey: string; setMesKey: (k: string) => void }) {
  const m = useMemo(() => {
    // Top 10 por total de bajas en los 6 meses, excluyendo "Sin asignar".
    const totals = countByKeyAll(data.rows.filter((r) => r.ejecutivo !== "Sin asignar"), (r) => r.ejecutivo);
    const top10 = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x[0]);
    const curr = countByKeyForMonth(data.rows, mesKey, (r) => r.ejecutivo);
    const idx = data.months.findIndex((x) => x.key === mesKey);
    const prevKey = idx > 0 ? data.months[idx - 1]!.key : mesKey;
    const prev = countByKeyForMonth(data.rows, prevKey, (r) => r.ejecutivo);

    const rows = top10.map((e, i) => {
      const bajas = curr[e] ?? 0;
      const base = data.activeBase.ejecutivo[e] ?? 0;
      const rate = base > 0 ? (bajas / base) * 100 : 0;
      return { ej: e, bajas, rate, color: EJ_COLORS[i % EJ_COLORS.length]! };
    }).sort((a, b) => b.rate - a.rate);

    const top = [...rows].sort((a, b) => b.bajas - a.bajas)[0];
    const worst = rows[0];
    const evo = bestEvolution(curr, prev, top10);
    const total = top10.reduce((s, e) => s + (curr[e] ?? 0), 0);

    const lineData = data.months.map((mm) => {
      const row: any = { mes: mm.label };
      top10.forEach((e) => {
        const n = data.rows.filter((r) => r.mesKey === mm.key && r.ejecutivo === e).length;
        const base = data.activeBase.ejecutivo[e] ?? 0;
        row[e] = base > 0 ? +((n / base) * 100).toFixed(2) : 0;
      });
      return row;
    });
    return { rows, top, worst, evo, total, lineData, top10 };
  }, [data, mesKey]);

  if (!m.top || !m.worst) return <div className="fs-12 muted">Sin datos de ejecutivos.</div>;
  return (
    <>
      <KpiRow>
        <KpiCard label="Mayor volumen" value={initials(m.top.ej)} sub={`${firstName(m.top.ej)} · ${nfmt(m.top.bajas)}`} />
        <KpiCard label="Mayor tasa" value={initials(m.worst.ej)} sub={pctfmt(m.worst.rate)} tone="orange" />
        <KpiCard label="Mejor evolución" value={m.evo ? initials(m.evo.k) : "—"} sub={m.evo ? `${m.evo.delta >= 0 ? "+" : ""}${m.evo.delta} vs ant.` : ""} />
        <KpiCard label="Total del período" value={nfmt(m.total)} sub={`bajas en ${data.months.find((x) => x.key === mesKey)?.label ?? ""}`} tone="ink" />
      </KpiRow>
      <MonthSelector data={data} mesKey={mesKey} setMesKey={setMesKey} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {m.rows.map((r) => {
          const isHigh = r.rate > 4.5;
          return (
            <div key={r.ej} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 10, background: "white",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: r.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600,
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
      </div>
    </>
  );
}

function HBarChart({ data }: { data: { name: string; bajas: number; color: string }[] }) {
  return (
    <div style={{ height: Math.max(180, data.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#E8E6DC" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#2B2B27" }} axisLine={false} tickLine={false} width={160} />
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
function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

// suppress unused type warnings for re-exported types
void (null as unknown as PaisSeg | PlanBase);
