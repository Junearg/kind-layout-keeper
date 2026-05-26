import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { healthAccounts, tierDist, type HealthAccount } from "@/data/mockData";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Health Score · Churn Hub" }] }),
  component: Health,
});

const TIERS = ["Todos", "Champion", "Healthy", "At Risk", "Critical"] as const;

const tierClass = (t: string) => (t === "At Risk" ? "tier-AtRisk" : t);

function trendIcon(d: HealthAccount["trendDir"]) {
  return d === "up" ? "↗" : d === "down" ? "↘" : d === "crit" ? "↯" : "→";
}

function Health() {
  const [tier, setTier] = useState<(typeof TIERS)[number]>("Todos");
  const rows = useMemo(
    () =>
      healthAccounts
        .filter((a) => tier === "Todos" || a.tier === tier)
        .sort((a, b) => b.csPrio - a.csPrio),
    [tier]
  );

  return (
    <Layout>
      <div className="bento cols-4">
        {tierDist.map((t) => (
          <div key={t.tier} className="card lg">
            <div className="row-flex" style={{ gap: 8 }}>
              <span className="tier-dot" style={{ background: t.color }} />
              <span className={`tag tier-${tierClass(t.tier)}`}>{t.tier}</span>
            </div>
            <div className="bignum mt-12" style={{ fontSize: 48 }}>{t.count}</div>
            <div className="muted fs-12 mt-12">{t.pct.toFixed(1)}% de la base</div>
          </div>
        ))}
      </div>

      <div className="divider"><span className="kicker">Cuentas</span><span className="alt">/ scoring + flags</span><span className="rule" /></div>

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
              <th>Flags</th><th>NPS</th><th>Prio CS</th>
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
                <td className="mono strong">{a.score.toFixed(1)}</td>
                <td><span className={`tag tier-${tierClass(a.tier)}`}>{a.tier}</span></td>
                <td className="fs-12">{trendIcon(a.trendDir)} {a.tendencia}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {a.flags.length === 0 && <span className="muted fs-11">—</span>}
                    {a.flags.map((f) => (
                      <span key={f} className="tag outline mono fs-11">{f}</span>
                    ))}
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
    </Layout>
  );
}
