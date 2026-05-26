import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import {
  churnTrend, motivosBaja, npsPais, tierDist, riskFlagDist, verbatims, ORANGE,
} from "@/data/mockData";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/resumen")({
  head: () => ({ meta: [{ title: "Resumen · Churn Intelligence Hub" }] }),
  component: Resumen,
});

const tierClass = (t: string) =>
  t === "At Risk" ? "tier-AtRisk" : t;

function Resumen() {
  const cuentasActivas = tierDist.reduce((s, t) => s + t.count, 0);
  const npsGlobal = 47.71;
  const csat = 4.78;
  const cvr = 19.9;

  return (
    <Layout>
      {/* Hero row */}
      <div className="bento cols-3">
        <div className="card orange lg" style={{ minHeight: 280 }}>
          <div className="bubble-wrap">
            <div className="bubble" />
          </div>
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Bajas del mes</div>
              <div className="card-title" style={{ color: "white" }}>Abril 2026</div>
            </div>
            <div className="arrow-up">↗</div>
          </div>
          <div className="bignum" style={{ fontSize: 92 }}>1,446</div>
          <div className="mt-12">
            <span className="callout">↑ +13.6% vs marzo</span>
          </div>
          <div className="mt-16" style={{ fontSize: 12, opacity: 0.9, maxWidth: 280 }}>
            5 meses consecutivos en alza · proyección mayo: 1,634
          </div>
        </div>

        <div className="card lg">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Voz del cliente</div>
              <div className="card-title">7,044 respuestas</div>
            </div>
            <div className="arrow-up">⌁</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 24 }}>
            <Metric label="NPS" value={npsGlobal.toFixed(2)} tone="orange" />
            <Metric label="CSAT" value={csat.toFixed(2)} tone="ink" />
            <Metric label="CVR" value={`${cvr}%`} tone="cream" />
          </div>
          <div className="mt-16 muted fs-12">
            Argentina y México lideran · Chile bajo objetivo (-16.9 pts)
          </div>
        </div>

        <div className="card lg">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Cuentas activas</div>
              <div className="card-title">May. 2026</div>
            </div>
            <div className="arrow-up">●</div>
          </div>
          <div className="bignum" style={{ fontSize: 72 }}>{cuentasActivas}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 18, height: 50 }}>
            {tierDist.map((t) => (
              <div key={t.tier} style={{ flex: 1 }}>
                <div style={{
                  height: `${(t.count / cuentasActivas) * 60 + 10}px`,
                  background: t.color, borderRadius: 4,
                }} />
                <div className="fs-11 muted" style={{ marginTop: 6 }}>{t.tier}</div>
                <div className="fs-12 strong">{t.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="divider">
        <span className="kicker">Tendencia</span>
        <span className="alt">/ bajas mensuales</span>
        <span className="sub">Dic 2025 – Jun 2026 (proyectado)</span>
        <span className="rule" />
      </div>

      <div className="bento cols-2">
        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Bajas vs % registrado con motivo</div>
              <div className="card-title">Crece la baja, crece la brecha</div>
            </div>
            <span className="delta-pill bad">↑ 13.6% MoM</span>
          </div>
          <div className="chart-wrap" style={{ height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={churnTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ORANGE} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E8E6DC" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />
                <Area type="monotone" dataKey="bajas" stroke={ORANGE} strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card cream lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Salud de la base</div>
              <div className="card-title">Distribución por tier</div>
            </div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={tierDist} dataKey="count" nameKey="tier" innerRadius={50} outerRadius={86} paddingAngle={3}>
                  {tierDist.map((t) => <Cell key={t.tier} fill={t.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
      </div>

      {/* Motivos + NPS */}
      <div className="divider">
        <span className="kicker">Diagnóstico</span>
        <span className="alt">/ ¿por qué se van?</span>
        <span className="rule" />
      </div>

      <div className="bento cols-2">
        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Motivos de baja consolidados</div>
              <div className="card-title">52% sin motivo registrado</div>
            </div>
            <span className="tag red">brecha crítica</span>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Motivo</th><th>N</th><th>%</th><th>Prioridad</th></tr>
            </thead>
            <tbody>
              {motivosBaja.map((m) => (
                <tr key={m.motivo} className={m.brecha ? "row-alert" : ""}>
                  <td className="strong">
                    <span className="row-flex" style={{ gap: 8 }}>
                      <span className="tier-dot" style={{ background: m.color }} />
                      {m.motivo}
                    </span>
                  </td>
                  <td className="mono">{m.n.toLocaleString()}</td>
                  <td className="mono">{m.pct.toFixed(1)}%</td>
                  <td>
                    <span className={`tag ${m.prioridad === "CRÍTICA" ? "red" : m.prioridad === "ALTA" ? "amber" : "outline"}`}>
                      {m.prioridad}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">NPS por país</div>
              <div className="card-title">Chile concentra el riesgo</div>
            </div>
          </div>
          <div className="chart-wrap" style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={npsPais} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#E8E6DC" vertical={false} />
                <XAxis dataKey="pais" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                <Bar dataKey="nps" radius={[6, 6, 0, 0]}>
                  {npsPais.map((p) => (
                    <Cell key={p.pais} fill={p.alerta ? "#B3261E" : ORANGE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
            {npsPais.map((p) => (
              <div key={p.pais} className="row-flex" style={{ justifyContent: "space-between", fontSize: 12.5 }}>
                <span>{p.pais} <span className="muted">· n={p.n.toLocaleString()}</span></span>
                <span className="mono strong" style={{ color: p.alerta ? "var(--red)" : "var(--ink)" }}>
                  {p.nps.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk flags + verbatim */}
      <div className="divider">
        <span className="kicker">Señales</span>
        <span className="alt">/ alertas operativas</span>
        <span className="rule" />
      </div>

      <div className="bento cols-2">
        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Risk flags activos</div>
              <div className="card-title">8 banderas · 1,161 disparos</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {riskFlagDist.map((f) => {
              const max = Math.max(...riskFlagDist.map((x) => x.count));
              return (
                <div key={f.flag}>
                  <div className="row-flex" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span className="mono">{f.flag}</span>
                    <span className="mono strong">{f.count}</span>
                  </div>
                  <div className="progress">
                    <i style={{ width: `${(f.count / max) * 100}%`, background: f.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card ink lg">
          <div className="card-eyebrow">Verbatim destacado · Detractor</div>
          <div className="card-title" style={{ marginTop: 12, fontSize: 28, lineHeight: 1.2 }}>
            "{verbatims[0]!.texto.slice(0, 180)}…"
          </div>
          <div className="mt-16" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="tag orange">LTR {verbatims[0]!.ltr}</span>
            <span className="tag outline" style={{ color: "var(--ink-5)", borderColor: "rgba(255,255,255,.2)" }}>{verbatims[0]!.pais}</span>
            <span className="tag outline" style={{ color: "var(--ink-5)", borderColor: "rgba(255,255,255,.2)" }}>{verbatims[0]!.plan}</span>
            <span className="tag outline" style={{ color: "var(--ink-5)", borderColor: "rgba(255,255,255,.2)" }}>{verbatims[0]!.submotivo}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "orange" | "ink" | "cream" }) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "ink" ? "var(--ink)" : "var(--paper-2)";
  const color = tone === "cream" ? "var(--ink)" : "white";
  return (
    <div style={{
      background: bg, color, borderRadius: 14, padding: "14px 12px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div className="fs-11" style={{ opacity: 0.8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
