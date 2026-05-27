import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { SectionDivider } from "@/components/SectionDivider";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { useDashboardData } from "@/data/liveData";
import { useKpisMes, useMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";

export const Route = createFileRoute("/kpis")({
  head: () => ({ meta: [{ title: "KPIs · Churn Hub" }] }),
  component: Kpis,
});

// Parse a numeric value (current/baseline/target) from the messy strings in mockData
function parseNum(s: string): number | null {
  if (!s || s === "—" || /sin dato/i.test(s)) return null;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

const statusMap = {
  critico:  { bg: "#FBEAE9",          fg: "var(--red)",   label: "CRÍTICO"  },
  rojo:     { bg: "#FBEAE9",          fg: "var(--red)",   label: "ROJO"     },
  vigilar:  { bg: "#FDF4E7",          fg: "var(--amber)", label: "VIGILAR"  },
  estable:  { bg: "#FDF4E7",          fg: "var(--amber)", label: "ESTABLE"  },
  verde:    { bg: "var(--orange-soft)", fg: "var(--orange-deep)", label: "VERDE" },
  sindato:  { bg: "#E8F0FB",          fg: "var(--blue)",  label: "SIN DATO" },
} as const;

const statusColor = (s: string) =>
  statusMap[s as keyof typeof statusMap] ?? { bg: "var(--paper-2)", fg: "var(--ink-3)", label: s.toUpperCase() };

function ProgressTrack({ baseline, t3, t6, current, color }: {
  baseline: number | null; t3: number | null; t6: number | null; current: number | null; color: string;
}) {
  if (baseline === null || t6 === null) {
    return <div className="muted fs-11" style={{ marginTop: 14 }}>Sin escala disponible</div>;
  }
  // Normalize positions on a track from min(baseline, t6) to max(baseline, t6).
  const min = Math.min(baseline, t6, t3 ?? baseline, current ?? baseline);
  const max = Math.max(baseline, t6, t3 ?? baseline, current ?? baseline);
  const span = max - min || 1;
  const pos = (v: number) => ((v - min) / span) * 100;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ position: "relative", height: 8, background: "var(--paper-3)", borderRadius: 99 }}>
        {/* fill from baseline → target6m */}
        <div style={{
          position: "absolute", left: `${Math.min(pos(baseline), pos(t6))}%`,
          width: `${Math.abs(pos(t6) - pos(baseline))}%`,
          top: 0, bottom: 0, background: color, opacity: 0.25, borderRadius: 99,
        }} />
        {/* t3 tick */}
        {t3 !== null && (
          <div style={{
            position: "absolute", left: `${pos(t3)}%`, top: -4, bottom: -4,
            width: 2, background: "var(--ink-4)", transform: "translateX(-1px)",
          }} />
        )}
        {/* current marker */}
        {current !== null && (
          <div style={{
            position: "absolute", left: `${pos(current)}%`, top: -5, bottom: -5,
            width: 12, height: 18, borderRadius: 4, background: color,
            transform: "translateX(-6px)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }} />
        )}
      </div>
      <div className="row-flex mono fs-11 muted" style={{ justifyContent: "space-between", marginTop: 6 }}>
        <span>baseline</span>
        <span>3M</span>
        <span>6M</span>
      </div>
    </div>
  );
}

type KpiTarget = { kpi: string; baseline: string; target3m: string; target6m: string; current: string; status: string };

function KpiCell({ k }: { k: KpiTarget }) {
  const s = statusColor(k.status);
  const baseline = parseNum(k.baseline);
  const t3 = parseNum(k.target3m);
  const t6 = parseNum(k.target6m);
  const current = parseNum(k.current);

  return (
    <div className="card lg" style={{ display: "flex", flexDirection: "column" }}>
      <div className="minihead" style={{ marginBottom: 12 }}>
        <div>
          <div className="card-eyebrow">KPI</div>
          <div className="card-title" style={{ fontSize: 19 }}>{k.kpi}</div>
        </div>
        <span className="tag" style={{ background: s.bg, color: s.fg, fontWeight: 600 }}>{s.label}</span>
      </div>
      <div className="bignum" style={{ fontSize: 44 }}>{k.current}</div>
      <ProgressTrack baseline={baseline} t3={t3} t6={t6} current={current} color={s.fg} />
      <div className="row-flex mono fs-11" style={{ justifyContent: "space-between", marginTop: 14, gap: 8 }}>
        <div>
          <div className="muted">Baseline</div>
          <div style={{ color: "var(--ink-2)" }}>{k.baseline}</div>
        </div>
        <div>
          <div className="muted">Target 3M</div>
          <div style={{ color: "var(--ink-2)" }}>{k.target3m}</div>
        </div>
        <div>
          <div className="muted">Target 6M</div>
          <div style={{ color: "var(--ink-2)" }}>{k.target6m}</div>
        </div>
      </div>
    </div>
  );
}

const prioTag = (p: string) => {
  if (p === "ALTA") return <span className="tag red">{p}</span>;
  if (p === "MEDIA") return <span className="tag amber">{p}</span>;
  return <span className="tag blue">{p}</span>;
};

function Kpis() {
  const { kpiTargets, iniciativas } = useDashboardData();
  const kpisMes = useKpisMes();
  const mesActivo = useMesActivo();
  return (
    <Layout actions={
      <ExportButton
        filename="kpis-iniciativas.xlsx"
        sheets={[
          { name: "KPIs seguimiento", rows: kpiTargets },
          { name: "Iniciativas", rows: iniciativas },
        ]}
      />
    }>
      {!kpisMes ? (
        <EmptyPeriod section="KPIs & Iniciativas" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      <div className="bento cols-4">
        {kpiTargets.slice(0, 4).map((k) => <KpiCell key={k.kpi} k={k} />)}
      </div>
      <div className="bento cols-4" style={{ marginTop: 16 }}>
        {kpiTargets.slice(4, 8).map((k) => <KpiCell key={k.kpi} k={k} />)}
      </div>

      <SectionDivider kicker="Iniciativas" alt="roadmap de retención" />

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
