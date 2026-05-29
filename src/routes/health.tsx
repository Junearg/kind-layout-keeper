import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, LabelList, Cell,
  AreaChart, Area,
} from "recharts";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { type HealthAccount } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import { useHealthMes, useMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  useSupabaseScoredAccounts,
  tierDistFromScored,
  riskFlagDistFromScored,
} from "@/data/supabase-health";
import {
  useSupabaseChurnInsights,
  formatMoney,
  formatMoneyFull,
  type ChurnRow,
  type EvitabilidadTipo,
} from "@/data/supabase-churn-insights";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Health Score · Churn Hub" }] }),
  component: Health,
});

const TIERS = ["Todos", "Champion", "Healthy", "At Risk", "Critical"] as const;
const tierClass = (t: string) => (t === "At Risk" ? "tier-AtRisk" : t);
const TIER_COLORS: Record<string, string> = {
  Champion: "#F05A28", Healthy: "#1E5DBF", "At Risk": "#B5740F", Critical: "#B3261E",
};

function trendIcon(d: HealthAccount["trendDir"]) {
  return d === "up" ? "↗" : d === "down" ? "↘" : d === "crit" ? "↯" : "→";
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload as HealthAccount;
  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)", padding: "10px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ fontWeight: 600 }}>{a.nombre}</div>
      <div className="mono" style={{ opacity: .7 }}>{a.pais} · {a.plan}</div>
      <div style={{ marginTop: 6 }}>Score <b className="mono">{a.score.toFixed(1)}</b> · NPS LTR <b className="mono">{a.npsLtr}</b></div>
      <div style={{ marginTop: 4 }}>Tier: <span style={{ color: TIER_COLORS[a.tier] ?? "#6E6D66" }}>{a.tier}</span></div>
    </div>
  );
}

function tipoColor(t: EvitabilidadTipo): { bg: string; fg: string } {
  if (t === "Evitable") return { bg: "#FDF4E7", fg: "#B5740F" };
  if (t === "No evitable") return { bg: "var(--paper-2)", fg: "var(--ink-3)" };
  return { bg: "transparent", fg: "var(--ink-4)" };
}

function Health() {
  const legacy = useDashboardData();
  const healthMes = useHealthMes();
  const mesActivo = useMesActivo();
  const { selectedPeriod } = usePeriod();
  const { data: scored = [] } = useSupabaseScoredAccounts(selectedPeriod);
  const { data: insights } = useSupabaseChurnInsights(selectedPeriod);

  const healthAccounts = scored.length ? scored : legacy.healthAccounts;
  const tierDist = scored.length ? tierDistFromScored(scored) : legacy.tierDist;
  const riskFlagDist = scored.length ? riskFlagDistFromScored(scored) : legacy.riskFlagDist;
  const tierColor = (t: string) => tierDist.find((x) => x.tier === t)?.color ?? TIER_COLORS[t] ?? "#6E6D66";
  const [tier, setTier] = useState<(typeof TIERS)[number]>("Todos");
  const [tableMode, setTableMode] = useState<"top" | "todas">("top");
  const [ejeFilter, setEjeFilter] = useState<string>("Todos");

  const rows = useMemo(
    () =>
      healthAccounts
        .filter((a) => tier === "Todos" || a.tier === tier)
        .sort((a, b) => b.score - a.score),
    [tier, healthAccounts]
  );

  const top50 = useMemo(() => {
    if (!insights) return [] as ChurnRow[];
    const filtered = ejeFilter === "Todos" ? insights.rows : insights.rows.filter((r) => r.ejecutivo === ejeFilter);
    return [...filtered].sort((a, b) => b.scoreRiesgo - a.scoreRiesgo).slice(0, 50);
  }, [insights, ejeFilter]);

  const scatterByTier = useMemo(() => {
    const out: Record<string, HealthAccount[]> = { Champion: [], Healthy: [], "At Risk": [], Critical: [] };
    healthAccounts.forEach((a) => {
      if (a.npsLtr !== null) out[a.tier]?.push(a);
    });
    return out;
  }, [healthAccounts]);

  const flagData = useMemo(
    () => [...riskFlagDist].filter((f) => f.flag !== "SIN_FLAGS").sort((a, b) => b.count - a.count),
    [riskFlagDist]
  );

  const hasData = scored.length > 0 || !!healthMes;
  const totalBase = healthAccounts.length || tierDist.reduce((s, t) => s + t.count, 0) || 1;

  const evitableData = insights ? [
    { name: "Evitable", value: insights.evitable.n, color: "#B5740F" },
    { name: "No evitable", value: insights.noEvitable.n, color: "#6E6D66" },
    { name: "Sin clasificar", value: insights.sinClasificar.n, color: "var(--paper-3)" },
  ] : [];
  const evitableTotal = evitableData.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <Layout actions={
      <ExportButton
        filename="health-score.xlsx"
        sheets={[
          { name: "Cuentas", rows: healthAccounts.map((a) => ({ ...a, flags: a.flags.join(", ") })) },
          { name: "Distribución tiers", rows: tierDist },
          { name: "Risk flags", rows: riskFlagDist },
          ...(insights ? [{
            name: "Top críticas",
            rows: [...insights.rows].sort((a, b) => b.scoreRiesgo - a.scoreRiesgo).slice(0, 200).map((r) => ({
              id: r.id, nombre: r.nombre, pais: r.pais, plan: r.plan, ejecutivo: r.ejecutivo,
              motivo: r.motivo, tipo: r.tipo, gmv: r.gmv, contactos: r.contactos,
              productos: r.productos, usuarios: r.usuarios, nps: r.npsLtr, score: r.scoreRiesgo,
            })),
          }] : []),
        ]}
      />
    }>
      {!hasData ? (
        <EmptyPeriod section="Health Score" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      {/* Row 1 — Tier KPIs */}
      <div className="bento cols-4">
        {(() => {
          const champ = healthAccounts.length
            ? { tier: "Champion", count: healthAccounts.filter((a) => a.tier === "Champion").length }
            : { tier: "Champion", count: tierDist.find((t) => t.tier === "Champion")?.count ?? 0 };
          const champPct = totalBase ? (champ.count / totalBase) * 100 : 0;
          return (
            <div className="card lg orange">
              <div className="card-eyebrow">Champion</div>
              <div className="card-title">Cuentas top</div>
              <div className="bignum mt-12" style={{ fontSize: 56, color: "white" }}>{champ.count}</div>
              <div className="fs-12 mt-12" style={{ color: "rgba(255,255,255,0.85)" }}>
                {champPct.toFixed(1)}% de la base · prio CS baja
              </div>
              <div className="bubble-wrap"><div className="bubble" /></div>
            </div>
          );
        })()}
        {tierDist.slice(1).map((t) => {
          const count = healthAccounts.length
            ? healthAccounts.filter((a) => a.tier === t.tier).length
            : t.count;
          const pct = totalBase ? (count / totalBase) * 100 : t.pct;
          return (
            <div key={t.tier} className="card lg">
              <div className="row-flex" style={{ gap: 8 }}>
                <span className="tier-dot" style={{ background: t.color }} />
                <span className={`tag tier-${tierClass(t.tier)}`}>{t.tier}</span>
              </div>
              <div className="bignum mt-12" style={{ fontSize: 48 }}>{count}</div>
              <div className="muted fs-12 mt-12">{pct.toFixed(1)}% de la base</div>
            </div>
          );
        })}
      </div>

      {/* Block 1 — GMV perdido row */}
      {insights && insights.total > 0 && (
        <>
          <div className="divider">
            <span className="kicker">Impacto económico</span>
            <span className="alt">/ últimos 6 meses</span>
            <span className="rule" />
          </div>
          <div className="bento cols-4">
            <div className="card lg orange">
              <div className="card-eyebrow">GMV perdido 6m</div>
              <div className="card-title">Total</div>
              <div className="bignum mt-12" style={{ fontSize: 48, color: "white" }}>
                {formatMoney(insights.gmvTotal)}
              </div>
              <div className="fs-12 mt-12" style={{ color: "rgba(255,255,255,0.85)" }}>
                {insights.total.toLocaleString("es-AR")} cuentas churneadas
              </div>
              <div className="bubble-wrap"><div className="bubble" /></div>
            </div>
            <div className="card lg">
              <div className="card-eyebrow">Promedio</div>
              <div className="card-title">Mensual</div>
              <div className="bignum mt-12" style={{ fontSize: 36 }}>{formatMoney(insights.gmvPromedioMensual)}</div>
              <div className="muted fs-12 mt-12">por mes</div>
              <div className="chart-wrap mt-12" style={{ height: 64 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={insights.trendMensual} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F05A28" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#F05A28" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="gmv" stroke="#F05A28" strokeWidth={2} fill="url(#gmvGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card lg">
              <div className="card-eyebrow">Peor mes</div>
              <div className="card-title">{insights.mesMayorPerdida?.mes ?? "—"}</div>
              <div className="bignum mt-12" style={{ fontSize: 36 }}>
                {insights.mesMayorPerdida ? formatMoney(insights.mesMayorPerdida.gmv) : "—"}
              </div>
              <div className="mt-12">
                <span className="tag mono fs-11" style={{ background: "#FBEAE9", color: "var(--red)" }}>
                  ↑ pico del período
                </span>
              </div>
            </div>
            <div className="card lg">
              <div className="card-eyebrow">Cuentas evitables</div>
              <div className="card-title">Recuperables</div>
              <div className="bignum mt-12" style={{ fontSize: 36, color: "#B5740F" }}>{insights.evitable.n}</div>
              <div className="muted fs-12 mt-12">
                {insights.pctEvitable.toFixed(1)}% del churn · {formatMoney(insights.evitable.gmv)} GMV
              </div>
            </div>
          </div>

          {/* Block 2 — Evitable vs No evitable */}
          <div className="divider">
            <span className="kicker">Clasificación</span>
            <span className="alt">/ churn evitable vs no evitable</span>
            <span className="rule" />
          </div>
          <div className="bento equal-2">
            <div className="card lg">
              <div className="card-eyebrow">Motivos</div>
              <div className="card-title">Evitabilidad del churn</div>
              <div className="mt-12" style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", border: "1px solid var(--rule)" }}>
                {evitableData.map((d) => (
                  <div key={d.name} title={`${d.name}: ${d.value}`}
                    style={{ width: `${(d.value / evitableTotal) * 100}%`, background: d.color }} />
                ))}
              </div>
              <div className="row-flex mt-12" style={{ gap: 16, flexWrap: "wrap" }}>
                {evitableData.map((d) => (
                  <div key={d.name} className="row-flex" style={{ gap: 6 }}>
                    <span className="tier-dot" style={{ background: d.color }} />
                    <span className="fs-12">{d.name}</span>
                    <span className="mono fs-12 muted">{d.value} · {((d.value / evitableTotal) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <table className="tbl mt-12" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Tipo</th><th>Cuentas</th><th>GMV perdido</th></tr>
                </thead>
                <tbody>
                  <tr><td><span className="tag mono fs-11" style={{ background: "#FDF4E7", color: "#B5740F" }}>Evitable</span></td><td className="mono">{insights.evitable.n}</td><td className="mono">{formatMoney(insights.evitable.gmv)}</td></tr>
                  <tr><td><span className="tag mono fs-11" style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}>No evitable</span></td><td className="mono">{insights.noEvitable.n}</td><td className="mono">{formatMoney(insights.noEvitable.gmv)}</td></tr>
                  <tr><td><span className="tag outline mono fs-11">Sin clasificar</span></td><td className="mono">{insights.sinClasificar.n}</td><td className="mono">{formatMoney(insights.sinClasificar.gmv)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="card lg" style={{ background: "var(--ink)", color: "var(--paper)" }}>
              <div className="card-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>Insight</div>
              <div className="card-title" style={{ color: "white" }}>La oportunidad escondida</div>
              <div className="mt-12" style={{ fontSize: 28, lineHeight: 1.25, fontWeight: 500 }}>
                Solo el <span style={{ color: "#F05A28" }}>{insights.pctEvitable.toFixed(1)}%</span> tiene motivo claramente evitable —
                pero el <span style={{ color: "#F05A28" }}>{insights.pctSinClasificar.toFixed(1)}%</span> no tiene motivo registrado.
              </div>
              <div className="mt-12 fs-12" style={{ color: "rgba(255,255,255,0.7)" }}>
                Ahí está la oportunidad: clasificar mejor para accionar antes.
              </div>
            </div>
          </div>

          {/* Block 3 — Señales de adopción */}
          <div className="divider">
            <span className="kicker">Señales</span>
            <span className="alt">/ el churn silencioso</span>
            <span className="rule" />
          </div>
          <div className="bento cols-3">
            <div className="card lg">
              <div className="card-eyebrow">Sin contacto CS</div>
              <div className="bignum mt-12" style={{ fontSize: 56, color: "var(--red)" }}>{insights.pctSinContacto.toFixed(0)}%</div>
              <div className="muted fs-12 mt-12">se fueron sin ningún contacto previo con CS</div>
            </div>
            <div className="card lg">
              <div className="card-eyebrow">Mono-canal</div>
              <div className="bignum mt-12" style={{ fontSize: 56, color: "#B5740F" }}>{insights.pctMonoCanal.toFixed(0)}%</div>
              <div className="muted fs-12 mt-12">vendían por un solo canal al momento de la baja</div>
            </div>
            <div className="card lg">
              <div className="card-eyebrow">Dejaron de usar</div>
              <div className="bignum mt-12" style={{ fontSize: 56, color: "var(--red)" }}>{insights.pctDejaronUsarSinContacto.toFixed(0)}%</div>
              <div className="muted fs-12 mt-12">de quienes "dejaron de usar" nunca tuvieron contacto previo</div>
            </div>
          </div>
          <div className="card lg" style={{ background: "var(--ink)", color: "var(--paper)" }}>
            <div className="card-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>Editorial</div>
            <div style={{ fontSize: 32, lineHeight: 1.2, fontWeight: 500, marginTop: 8 }}>
              No se van enojados. Se van sin que nadie lo note.
            </div>
          </div>
        </>
      )}

      <div className="divider">
        <span className="kicker">Distribución</span>
        <span className="alt">/ salud × satisfacción</span>
        <span className="rule" />
      </div>

      {/* Row 2 — Scatter + Risk Flags */}
      <div className="bento equal-2">
        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Cruce</div>
              <div className="card-title">NPS LTR × Health Score</div>
            </div>
            <span className="tag outline mono fs-11">{Object.values(scatterByTier).flat().length} cuentas con NPS</span>
          </div>
          <div className="chart-wrap" style={{ position: "relative", height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 20, bottom: 28, left: 4 }}>
                <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" />
                <XAxis
                  type="number" dataKey="score" name="Score" domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: "JetBrains Mono" }}
                  label={{ value: "Health Score", position: "insideBottom", offset: -16, fill: "var(--ink-3)", fontSize: 11 }}
                />
                <YAxis
                  type="number" dataKey="npsLtr" name="NPS" domain={[-1, 10]}
                  tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: "JetBrains Mono" }}
                  label={{ value: "NPS LTR", angle: -90, position: "insideLeft", fill: "var(--ink-3)", fontSize: 11 }}
                />
                <ZAxis range={[60, 60]} />
                <ReferenceLine x={50} stroke="var(--ink-4)" strokeDasharray="4 4" />
                <ReferenceLine y={5} stroke="var(--ink-4)" strokeDasharray="4 4" />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--ink-4)" }} />
                {(Object.keys(scatterByTier) as Array<keyof typeof scatterByTier>).map((t) => (
                  <Scatter key={t} name={t} data={scatterByTier[t]} fill={tierColor(t)} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 16, pointerEvents: "none", fontSize: 10.5, color: "var(--ink-3)", fontWeight: 500, letterSpacing: 0.04 }}>
              <span style={{ position: "absolute", top: 8, right: 12 }}>ACTIVOS & SATISFECHOS</span>
              <span style={{ position: "absolute", top: 8, left: 48 }}>SATISFECHOS SIN USAR</span>
              <span style={{ position: "absolute", bottom: 40, right: 12 }}>USAN, INSATISFECHOS</span>
              <span style={{ position: "absolute", bottom: 40, left: 48, color: "var(--red)" }}>RIESGO TOTAL</span>
            </div>
          </div>
          <div className="row-flex mt-12" style={{ gap: 14, flexWrap: "wrap" }}>
            {tierDist.map((t) => (
              <div key={t.tier} className="row-flex" style={{ gap: 6 }}>
                <span className="tier-dot" style={{ background: t.color }} />
                <span className="fs-12 muted">{t.tier}</span>
              </div>
            ))}
          </div>
          {insights && insights.altaAdopcionN > 0 && (
            <div className="mt-12" style={{ padding: 12, borderTop: "1px solid var(--rule)", fontSize: 12, lineHeight: 1.5 }}>
              <div className="mono fs-11 muted" style={{ marginBottom: 4 }}>INSIGHT</div>
              <div>
                <b className="mono">{insights.altaAdopcionN.toLocaleString("es-AR")}</b> cuentas de alta adopción
                {" "}(&gt;100 productos y &gt;3 usuarios) se dieron de baja igual —{" "}
                <b className="mono">{formatMoney(insights.altaAdopcionGmv)}</b> de GMV.
                {insights.altaAdopcionTopMotivo && (
                  <> Top motivo: <b>{insights.altaAdopcionTopMotivo.motivo}</b> ({insights.altaAdopcionTopMotivo.n}).</>
                )}
              </div>
              <div className="muted mt-12" style={{ fontStyle: "italic" }}>
                La adopción no protege del churn cuando el negocio cierra. El timing de la intervención importa más que el uso.
              </div>
            </div>
          )}
        </div>

        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Risk flags</div>
              <div className="card-title">Distribución de señales</div>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flagData} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-3)", fontFamily: "JetBrains Mono" }} />
                <YAxis
                  type="category" dataKey="flag" width={160}
                  tick={{ fontSize: 11, fill: "var(--ink-2)", fontFamily: "JetBrains Mono" }}
                />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--rule)", fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {flagData.map((f) => <Cell key={f.flag} fill={f.color} />)}
                  <LabelList dataKey="count" position="right" style={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--ink-2)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {insights && insights.total > 0 && (
            <div className="mt-12" style={{ padding: 12, borderTop: "1px solid var(--rule)", fontSize: 12 }}>
              <div className="mono fs-11 muted" style={{ marginBottom: 6 }}>SUMMARY · CUENTAS CHURNEADAS 6M</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div>Mono-canal: <b className="mono">{insights.monoCanalN.toLocaleString("es-AR")}</b> <span className="muted">({(insights.monoCanalN/insights.total*100).toFixed(0)}%)</span></div>
                <div>GMV bajo (&lt;$25K): <b className="mono">{insights.gmvBajoN.toLocaleString("es-AR")}</b> <span className="muted">({(insights.gmvBajoN/insights.total*100).toFixed(0)}%)</span></div>
                <div>Sin contacto CS: <b className="mono">{insights.sinContactoN.toLocaleString("es-AR")}</b> <span className="muted">({(insights.sinContactoN/insights.total*100).toFixed(0)}%)</span></div>
                <div>Pocos usuarios (≤2): <b className="mono">{insights.pocosUsuariosN.toLocaleString("es-AR")}</b> <span className="muted">({(insights.pocosUsuariosN/insights.total*100).toFixed(0)}%)</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="divider">
        <span className="kicker">{tableMode === "top" ? "Top 50 críticas" : `${healthAccounts.length} cuentas`}</span>
        <span className="alt">/ {tableMode === "top" ? "score de riesgo descendente" : "monitorizadas"}</span>
        <span className="rule" />
      </div>

      {/* Toggle + filters */}
      <div className="row-flex" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div className="chips">
          <button className={`chip${tableMode === "top" ? " active" : ""}`} onClick={() => setTableMode("top")}>
            Top 50 críticas
          </button>
          <button className={`chip${tableMode === "todas" ? " active" : ""}`} onClick={() => setTableMode("todas")}>
            Todas las cuentas
          </button>
        </div>
        {tableMode === "top" && insights && (
          <div className="row-flex" style={{ gap: 6, alignItems: "center" }}>
            <span className="muted fs-12">Ejecutivo:</span>
            <select
              value={ejeFilter}
              onChange={(e) => setEjeFilter(e.target.value)}
              className="mono fs-12"
              style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)" }}
            >
              <option>Todos</option>
              {insights.ejecutivos.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
        )}
        {tableMode === "todas" && (
          <div className="chips">
            {TIERS.map((t) => (
              <button key={t} className={`chip${tier === t ? " active" : ""}`} onClick={() => setTier(t)}>
                {t} <span className="cnt">{t === "Todos" ? healthAccounts.length : healthAccounts.filter((a) => a.tier === t).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {tableMode === "top" ? (
        <div className="card lg">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cuenta</th><th>País</th><th>Plan</th><th>GMV</th><th>Ejecutivo</th>
                <th>Motivo</th><th>Contactos</th><th>Productos</th><th>Usuarios</th>
                <th>NPS</th><th>Tipo churn</th><th>Score</th>
              </tr>
            </thead>
            <tbody>
              {top50.map((r) => {
                const tc = tipoColor(r.tipo);
                const npsColor = r.npsLtr == null ? "var(--ink-4)" : r.npsLtr < 7 ? "var(--red)" : r.npsLtr <= 8 ? "var(--blue)" : "#F05A28";
                const rowBg = r.scoreRiesgo >= 10 ? "rgba(179,38,30,0.04)" : undefined;
                const scoreColor = r.scoreRiesgo >= 10 ? "var(--red)" : r.scoreRiesgo >= 7 ? "#B5740F" : "var(--ink-3)";
                return (
                  <tr key={String(r.id)} style={{ background: rowBg }}>
                    <td>
                      <div className="strong">{r.nombre}</div>
                      <div className="muted fs-11 mono">#{r.id}</div>
                    </td>
                    <td className="mono fs-12">{r.pais}</td>
                    <td className="mono fs-12">{r.plan}</td>
                    <td className="mono">{formatMoneyFull(r.gmv)}</td>
                    <td className="fs-12">{r.ejecutivo}</td>
                    <td>
                      <div className="fs-12" style={{ maxWidth: 180 }}>{r.motivo}</div>
                      <span className="tag mono fs-11" style={{ background: tc.bg, color: tc.fg, border: r.tipo === "Sin clasificar" ? "1px solid var(--rule)" : "1px solid transparent", marginTop: 2 }}>
                        {r.tipo}
                      </span>
                    </td>
                    <td className="mono" style={{ color: r.contactos === 0 ? "var(--red)" : "var(--ink)" }}>
                      {r.contactos === 0 ? "—" : r.contactos}
                    </td>
                    <td className="mono">{r.productos}</td>
                    <td className="mono">{r.usuarios}</td>
                    <td className="mono">
                      {r.npsLtr == null ? <span className="muted">—</span> : (
                        <span className="row-flex" style={{ gap: 6, alignItems: "center" }}>
                          <span className="tier-dot" style={{ background: npsColor }} />
                          {r.npsLtr}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="tag mono fs-11" style={{ background: tc.bg, color: tc.fg, border: r.tipo === "Sin clasificar" ? "1px solid var(--rule)" : "1px solid transparent" }}>
                        {r.tipo}
                      </span>
                    </td>
                    <td style={{ minWidth: 90 }}>
                      <div className="row-flex" style={{ gap: 6, alignItems: "center" }}>
                        <span className="mono strong" style={{ width: 18, color: scoreColor }}>{r.scoreRiesgo}</span>
                        <div style={{ flex: 1, height: 6, background: "var(--paper-3)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${(r.scoreRiesgo / 13) * 100}%`, height: "100%", background: scoreColor, borderRadius: 99 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {top50.length === 0 && (
                <tr><td colSpan={12} className="muted" style={{ textAlign: "center", padding: 24 }}>Sin cuentas para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card lg">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cuenta</th><th>País</th><th>Plan</th>
                <th>Score</th><th>Tier</th><th>Tendencia</th>
                <th>Risk Flags</th><th>NPS LTR</th><th>Prio CS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={a.tier === "Critical" ? "row-alert" : ""}>
                  <td className="strong">
                    <div>{a.nombre}</div>
                    <div className="muted fs-11 mono">#{a.id}</div>
                  </td>
                  <td className="mono">{a.pais}</td>
                  <td className="mono fs-12">{a.plan}</td>
                  <td style={{ minWidth: 140 }}>
                    <div className="row-flex" style={{ gap: 8 }}>
                      <span className="mono strong" style={{ width: 36 }}>{a.score.toFixed(1)}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--paper-3)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${a.score}%`, height: "100%", background: tierColor(a.tier), borderRadius: 99 }} />
                      </div>
                    </div>
                  </td>
                  <td><span className={`tag tier-${tierClass(a.tier)}`}>{a.tier}</span></td>
                  <td className="fs-12">{trendIcon(a.trendDir)} {a.tendencia}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {a.flags.length === 0 && <span className="muted fs-11">—</span>}
                      {a.flags.map((f) => {
                        const color = riskFlagDist.find((r) => r.flag === f)?.color ?? "var(--ink-3)";
                        return (
                          <span key={f} className="tag outline mono fs-11" style={{ borderColor: color, color }}>
                            {f}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="mono">{a.npsLtr ?? "—"}</td>
                  <td className="mono strong" style={{ color: a.csPrio >= 50 ? "var(--red)" : a.csPrio >= 40 ? "var(--amber)" : "var(--ink-3)" }}>
                    {a.csPrio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </Layout>
  );
}
