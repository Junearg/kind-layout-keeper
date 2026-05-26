import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { healthAccounts } from "@/data/mockData";

export const Route = createFileRoute("/cola")({
  head: () => ({ meta: [{ title: "Cola CS · Churn Hub" }] }),
  component: Cola,
});

const tierClass = (t: string) => (t === "At Risk" ? "tier-AtRisk" : t);

function Cola() {
  const queue = [...healthAccounts]
    .filter((a) => a.csPrio >= 40)
    .sort((a, b) => b.csPrio - a.csPrio)
    .slice(0, 20);

  return (
    <Layout>
      <div className="bento cols-3">
        <div className="card orange lg">
          <div className="bubble-wrap"><div className="bubble" /></div>
          <div className="card-eyebrow">En cola</div>
          <div className="bignum mt-12" style={{ fontSize: 72 }}>{queue.length}</div>
          <div className="mt-12 fs-12">cuentas con prioridad ≥ 40</div>
        </div>
        <div className="card lg">
          <div className="card-eyebrow">SLA promedio</div>
          <div className="bignum mt-12" style={{ fontSize: 56 }}>48<span className="decimal">h</span></div>
          <div className="mt-12 muted fs-12">desde flag hasta primer contacto</div>
        </div>
        <div className="card cream lg">
          <div className="card-eyebrow">Asignación</div>
          <div className="card-title mt-12">3 CSMs activos</div>
          <div className="mt-12 muted fs-12">distribución por país + tier</div>
        </div>
      </div>

      <div className="divider"><span className="kicker">Prioridad</span><span className="alt">/ próximas acciones</span><span className="rule" /></div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {queue.map((a, i) => (
          <div key={a.id} className="card" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div className="serif" style={{ fontSize: 36, width: 48, color: "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ flex: 1 }}>
              <div className="row-flex" style={{ gap: 10 }}>
                <span className="strong" style={{ fontSize: 14 }}>{a.nombre}</span>
                <span className={`tag tier-${tierClass(a.tier)}`}>{a.tier}</span>
                <span className="tag outline mono fs-11">{a.pais} · {a.plan}</span>
              </div>
              <div className="row-flex mt-12" style={{ gap: 6, flexWrap: "wrap" }}>
                {a.flags.length === 0 && <span className="muted fs-11">sin flags</span>}
                {a.flags.map((f) => (
                  <span key={f} className="tag amber mono fs-11">{f}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted fs-11">score</div>
              <div className="mono strong" style={{ fontSize: 18 }}>{a.score.toFixed(1)}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div className="muted fs-11">prioridad</div>
              <div className="mono strong" style={{ fontSize: 18, color: a.csPrio >= 50 ? "var(--red)" : "var(--amber)" }}>{a.csPrio}</div>
            </div>
            <button className="btn">Contactar</button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
