import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import {
  npsPais, npsPorGmv, npsPorAntiguedad,
  motivosDetraccion, motivosPromocion, desgloseCosto, verbatims, ORANGE,
} from "@/data/mockData";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

export const Route = createFileRoute("/nps")({
  head: () => ({ meta: [{ title: "NPS · Churn Hub" }] }),
  component: Nps,
});

function Nps() {
  return (
    <Layout>
      <div className="bento cols-3">
        <Big label="NPS Global" value="47.71" sub="6,915 respuestas" tone="orange" />
        <Big label="Promotores" value="65.1%" sub="vs detractores 17.4%" tone="ink" />
        <Big label="Brecha Chile" value="-16.9" sub="pts vs Argentina" tone="cream" alert />
      </div>

      <div className="divider"><span className="kicker">Por país</span><span className="rule" /></div>
      <div className="card lg">
        <table className="tbl">
          <thead><tr><th>País</th><th>NPS</th><th>n</th><th>Promotores</th><th>Detractores</th><th>Cuentas</th><th></th></tr></thead>
          <tbody>
            {npsPais.map((p) => (
              <tr key={p.pais} className={p.alerta ? "row-alert" : ""}>
                <td className="strong">{p.pais}</td>
                <td className="mono strong" style={{ color: p.alerta ? "var(--red)" : "var(--ink)" }}>{p.nps.toFixed(2)}</td>
                <td className="mono">{p.n.toLocaleString()}</td>
                <td className="mono">{p.promotores.toFixed(1)}%</td>
                <td className="mono">{p.detractores.toFixed(1)}%</td>
                <td className="mono">{p.cuentas.toLocaleString()}</td>
                <td>{p.alerta && <span className="tag red">alerta</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divider"><span className="kicker">Segmentos</span><span className="alt">/ GMV y antigüedad</span><span className="rule" /></div>
      <div className="bento equal-2">
        <SegmentCard title="Por bucket GMV" data={npsPorGmv.map((g) => ({ name: g.grupo, nps: g.nps, n: g.n }))} />
        <SegmentCard title="Por antigüedad" data={npsPorAntiguedad.map((a) => ({ name: a.rango, nps: a.nps, n: a.n }))} />
      </div>

      <div className="divider"><span className="kicker">Top motivos</span><span className="rule" /></div>
      <div className="bento equal-2">
        <MotivosCard title="Detractores" data={motivosDetraccion} color="#B3261E" />
        <MotivosCard title="Promotores" data={motivosPromocion} color={ORANGE} />
      </div>

      <div className="divider"><span className="kicker">Quejas por costo</span><span className="alt">/ submotivo</span><span className="rule" /></div>
      <div className="bento equal-2">
        <div className="card lg">
          <table className="tbl">
            <thead><tr><th>Submotivo</th><th>N</th></tr></thead>
            <tbody>
              {desgloseCosto.map((d) => (
                <tr key={d.submotivo}>
                  <td>{d.submotivo}</td>
                  <td className="mono strong">{d.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card ink lg">
          <div className="card-eyebrow">Verbatim · Detractor por costo</div>
          <div className="serif" style={{ fontSize: 22, marginTop: 14, lineHeight: 1.35 }}>
            "{verbatims[1]!.texto.slice(0, 220)}…"
          </div>
          <div className="mt-16" style={{ display: "flex", gap: 8 }}>
            <span className="tag orange">LTR {verbatims[1]!.ltr}</span>
            <span className="tag outline" style={{ color: "var(--ink-5)", borderColor: "rgba(255,255,255,.2)" }}>{verbatims[1]!.pais}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Big({ label, value, sub, tone, alert }: { label: string; value: string; sub: string; tone: "orange" | "ink" | "cream"; alert?: boolean }) {
  const cls = tone === "orange" ? "card orange lg" : tone === "ink" ? "card ink lg" : "card cream lg";
  return (
    <div className={cls}>
      <div className="card-eyebrow">{label}</div>
      <div className="bignum mt-12" style={{ fontSize: 72, color: alert ? "var(--red)" : undefined }}>{value}</div>
      <div className="mt-12 fs-12" style={{ opacity: 0.85 }}>{sub}</div>
    </div>
  );
}

function SegmentCard({ title, data }: { title: string; data: { name: string; nps: number; n: number }[] }) {
  return (
    <div className="card lg">
      <div className="card-eyebrow">{title}</div>
      <div className="card-title" style={{ marginBottom: 14 }}>NPS por grupo</div>
      <div className="chart-wrap" style={{ height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke="#E8E6DC" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#2B2B27" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="nps" fill={ORANGE} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MotivosCard({ title, data, color }: { title: string; data: { motivo: string; n: number; pct: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.pct));
  return (
    <div className="card lg">
      <div className="minihead">
        <div>
          <div className="card-eyebrow">{title}</div>
          <div className="card-title">Top motivos</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map((d) => (
          <div key={d.motivo}>
            <div className="row-flex" style={{ justifyContent: "space-between", fontSize: 12.5 }}>
              <span>{d.motivo}</span>
              <span className="mono"><span className="strong">{d.pct.toFixed(1)}%</span> <span className="muted">· n={d.n}</span></span>
            </div>
            <div className="progress">
              <i style={{ width: `${(d.pct / max) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
