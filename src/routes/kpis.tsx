import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { kpiTargets, iniciativas } from "@/data/mockData";

export const Route = createFileRoute("/kpis")({
  head: () => ({ meta: [{ title: "KPIs · Churn Hub" }] }),
  component: Kpis,
});

const statusTag = (s: string) => {
  if (s === "rojo" || s === "critico") return <span className="tag red">{s}</span>;
  if (s === "vigilar" || s === "estable") return <span className="tag amber">{s}</span>;
  if (s === "verde") return <span className="tag orange">{s}</span>;
  return <span className="tag outline">{s}</span>;
};

const prioTag = (p: string) => {
  if (p === "ALTA") return <span className="tag red">{p}</span>;
  if (p === "MEDIA") return <span className="tag amber">{p}</span>;
  return <span className="tag blue">{p}</span>;
};

function Kpis() {
  return (
    <Layout>
      <div className="card lg">
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Targets a 3 y 6 meses</div>
            <div className="card-title">8 KPIs de seguimiento</div>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>KPI</th><th>Baseline</th><th>3 meses</th><th>6 meses</th><th>Actual</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {kpiTargets.map((k) => (
              <tr key={k.kpi}>
                <td className="strong">{k.kpi}</td>
                <td className="mono muted">{k.baseline}</td>
                <td className="mono">{k.target3m}</td>
                <td className="mono">{k.target6m}</td>
                <td className="mono strong">{k.current}</td>
                <td>{statusTag(k.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divider"><span className="kicker">Iniciativas</span><span className="alt">/ roadmap de retención</span><span className="rule" /></div>

      <div className="bento equal-2">
        {iniciativas.map((it) => (
          <div key={it.id} className="card lg">
            <div className="card-head">
              <div>
                <div className="card-eyebrow">#{it.id} · {it.owner}</div>
                <div className="card-title">{it.titulo}</div>
              </div>
              {prioTag(it.prioridad)}
            </div>
            <p className="fs-12" style={{ color: "var(--ink-2)", marginTop: 8 }}>{it.descripcion}</p>
            <div className="mt-16" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div className="fs-11 muted">Timeline</div>
                <div className="mono fs-12 strong">{it.timeline}</div>
              </div>
              <div>
                <div className="fs-11 muted">Impacto</div>
                <div className="fs-12 strong">{it.impacto}</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <span className={`tag ${it.estado === "en_progreso" ? "orange" : "outline"}`}>
                  {it.estado.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
