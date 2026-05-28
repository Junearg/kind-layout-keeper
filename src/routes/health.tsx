import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, LabelList, Cell,
} from "recharts";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { SupabaseMetricsPanel } from "@/components/SupabaseMetricsPanel";
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
      <div className="strong" style={{ fontWeight: 600 }}>{a.nombre}</div>
      <div className="mono" style={{ opacity: .7 }}>{a.pais} · {a.plan}</div>
      <div className="mt-12" style={{ marginTop: 6 }}>Score <b className="mono">{a.score.toFixed(1)}</b> · NPS LTR <b className="mono">{a.npsLtr}</b></div>
      <div style={{ marginTop: 4 }}>Tier: <span style={{ color: TIER_COLORS[a.tier] ?? "#6E6D66" }}>{a.tier}</span></div>
    </div>
  );
}

function Health() {
  const legacy = useDashboardData();
  const healthMes = useHealthMes();
  const mesActivo = useMesActivo();
  const { selectedPeriod } = usePeriod();
  const { data: scored = [] } = useSupabaseScoredAccounts(selectedPeriod);

  // Si hay datos de Supabase para el período, son fuente de verdad.
  const healthAccounts = scored.length ? scored : legacy.healthAccounts;
  const tierDist = scored.length ? tierDistFromScored(scored) : legacy.tierDist;
  const riskFlagDist = scored.length ? riskFlagDistFromScored(scored) : legacy.riskFlagDist;
  const tierColor = (t: string) => tierDist.find((x) => x.tier === t)?.color ?? TIER_COLORS[t] ?? "#6E6D66";
  const [tier, setTier] = useState<(typeof TIERS)[number]>("Todos");

  const rows = useMemo(
    () =>
      healthAccounts
        .filter((a) => tier === "Todos" || a.tier === tier)
        .sort((a, b) => b.score - a.score),
    [tier, healthAccounts]
  );

  const scatterByTier = useMemo(() => {
    const out: Record<string, HealthAccount[]> = { Champion: [], Healthy: [], "At Risk": [], Critical: [] };
    healthAccounts.forEach((a) => {
      if (a.npsLtr !== null) out[a.tier]?.push(a);
    });
    return out;
  }, [healthAccounts]);

  const flagData = useMemo(
    () => [...riskFlagDist].filter((f) => f.flag !== "SIN_FLAGS").sort((a, b) => b.count - a.count),
    []
  );

  return (
    <Layout actions={
      <ExportButton
        filename="health-score.xlsx"
        sheets={[
          { name: "Cuentas", rows: healthAccounts.map((a) => ({ ...a, flags: a.flags.join(", ") })) },
          { name: "Distribución tiers", rows: tierDist },
          { name: "Risk flags", rows: riskFlagDist },
        ]}
      />
    }>
      <SupabaseMetricsPanel />
      {!healthMes ? (
        <EmptyPeriod section="Health Score" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      {/* Row 1 — Tier KPIs */}
      <div className="bento cols-4">
        {(() => {
          const champ = healthAccounts.length
            ? { tier: "Champion", count: healthAccounts.filter((a) => a.tier === "Champion").length }
            : { tier: "Champion", count: tierDist.find((t) => t.tier === "Champion")?.count ?? 0 };
          const totalBase = healthAccounts.length || tierDist.reduce((s, t) => s + t.count, 0);
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
          const totalBase = healthAccounts.length || tierDist.reduce((s, x) => s + x.count, 0);
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

      <div className="divider">
        <span className="kicker">Distribución</span>
        <span className="alt">/ salud × satisfacción</span>
        <span className="rule" />
      </div>

      {/* Row 2 — Scatter + Risk Flags */}
      <div className="bento equal-2">
        {/* Scatter */}
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
            {/* Quadrant labels */}
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
        </div>

        {/* Risk Flags Bar */}
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
        </div>
      </div>

      <div className="divider">
        <span className="kicker">{healthAccounts.length} cuentas</span>
        <span className="alt">/ monitorizadas</span>
        <span className="rule" />
      </div>

      <div className="chips">
        {TIERS.map((t) => (
          <button key={t} className={`chip${tier === t ? " active" : ""}`} onClick={() => setTier(t)}>
            {t} <span className="cnt">{t === "Todos" ? healthAccounts.length : healthAccounts.filter((a) => a.tier === t).length}</span>
          </button>
        ))}
      </div>

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
      </>
      )}
    </Layout>
  );
}
