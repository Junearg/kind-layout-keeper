import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { SupabaseMetricsPanel } from "@/components/SupabaseMetricsPanel";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { tierDist as legacyTierDist, riskFlagDist as legacyFlagDist, type HealthAccount } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import { useColaMes, useMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  useSupabaseScoredAccounts,
  tierDistFromScored,
  riskFlagDistFromScored,
} from "@/data/supabase-health";

export const Route = createFileRoute("/cola")({
  head: () => ({ meta: [{ title: "Cola CS · Churn Hub" }] }),
  component: Cola,
});

const tierClass = (t: string) => (t === "At Risk" ? "tier-AtRisk" : t);

type FilterKey = "Todos" | "Critical" | "At Risk" | "CaidaCritica" | "NpsDetractor";

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" style={{ flex: "0 0 64px" }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={5} />
      <circle
        cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)"
      />
      <text x={32} y={36} textAnchor="middle" fontSize={13} fontFamily="JetBrains Mono" fontWeight={600} fill="var(--ink)">
        {Math.round(score)}
      </text>
    </svg>
  );
}

function QueueCard({ a, contacted, onToggle, tierColor, flagColor }: {
  a: HealthAccount; contacted: boolean; onToggle: () => void;
  tierColor: (t: string) => string; flagColor: (f: string) => string;
}) {
  const color = tierColor(a.tier);
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 18, borderLeft: `4px solid ${color}`, padding: 18 }}>
      <ScoreRing score={a.score} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-flex" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>{a.nombre}</span>
          <span className="muted mono fs-11">#{a.id}</span>
          <span className={`tag tier-${tierClass(a.tier)}`}>{a.tier}</span>
        </div>
        <div className="muted fs-12 mt-12" style={{ marginTop: 6 }}>
          {a.pais} · {a.plan} · {a.tendencia}{a.npsLtr !== null ? ` · NPS ${a.npsLtr}` : ""}
        </div>
        <div className="row-flex" style={{ gap: 4, flexWrap: "wrap", marginTop: 8 }}>
          {a.flags.length === 0 && <span className="muted fs-11">sin flags</span>}
          {a.flags.map((f) => (
            <span key={f} className="tag outline mono fs-11" style={{ borderColor: flagColor(f), color: flagColor(f) }}>{f}</span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 56 }}>
        <div className="muted fs-11">prio</div>
        <div className="mono strong" style={{ fontSize: 18, color: a.csPrio >= 50 ? "var(--red)" : "var(--amber)" }}>{a.csPrio}</div>
      </div>
      <button
        className="btn"
        onClick={onToggle}
        style={contacted ? { background: "#15803d", color: "white" } : {}}
      >
        {contacted ? "✓ Contactado" : "Contactar"}
      </button>
    </div>
  );
}

function Cola() {
  const legacy = useDashboardData();
  const colaMes = useColaMes();
  const mesActivo = useMesActivo();
  const { selectedPeriod } = usePeriod();
  const { data: scored = [] } = useSupabaseScoredAccounts(selectedPeriod);

  const healthAccounts = scored.length ? scored : legacy.healthAccounts;
  const tierDist = scored.length ? tierDistFromScored(scored) : legacyTierDist;
  const riskFlagDist = scored.length ? riskFlagDistFromScored(scored) : legacyFlagDist;
  const tierColor = (t: string) => tierDist.find((x) => x.tier === t)?.color ?? "#6E6D66";
  const flagColor = (f: string) => riskFlagDist.find((r) => r.flag === f)?.color ?? "#6E6D66";

  const [filter, setFilter] = useState<FilterKey>("Todos");
  const [contactedSet, setContactedSet] = useState<Set<number>>(new Set());



  const queue = useMemo(
    () => [...healthAccounts].filter((a) => a.csPrio >= 35).sort((a, b) => b.csPrio - a.csPrio),
    [healthAccounts]
  );

  const matches = (a: HealthAccount, f: FilterKey) => {
    if (f === "Todos") return true;
    if (f === "Critical") return a.tier === "Critical";
    if (f === "At Risk") return a.tier === "At Risk";
    if (f === "CaidaCritica") return a.flags.includes("CAIDA_CRITICA_3M");
    if (f === "NpsDetractor") return a.flags.includes("NPS_DETRACTOR") || (a.npsLtr !== null && a.npsLtr <= 0);
    return true;
  };

  const filtered = queue.filter((a) => matches(a, filter));
  const criticos = filtered.filter((a) => a.tier === "Critical" || a.csPrio >= 48);
  const resto = filtered.filter((a) => !criticos.includes(a));
  const contactados = queue.filter((a) => contactedSet.has(a.id)).length;

  const counts = {
    Todos: queue.length,
    Critical: queue.filter((a) => matches(a, "Critical")).length,
    "At Risk": queue.filter((a) => matches(a, "At Risk")).length,
    CaidaCritica: queue.filter((a) => matches(a, "CaidaCritica")).length,
    NpsDetractor: queue.filter((a) => matches(a, "NpsDetractor")).length,
  };

  const toggle = (id: number) => {
    setContactedSet((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pct = queue.length ? Math.round((contactados / queue.length) * 100) : 0;

  return (
    <Layout actions={
      <ExportButton
        filename="cola-cs.xlsx"
        sheets={[
          { name: "Cola completa", rows: queue.map((a) => ({
            ...a,
            flags: a.flags.join(", "),
            contactado: contactedSet.has(a.id) ? "Sí" : "No",
          })) },
        ]}
      />
    }>
      <SupabaseMetricsPanel />
      {!colaMes ? (
        <EmptyPeriod section="Cola CS" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      {/* Row 1 — KPIs */}
      <div className="bento cols-3">
        <div className="card ink lg">
          <div className="card-eyebrow">Cola del día</div>
          <div className="bignum mt-12" style={{ fontSize: 72 }}>{queue.length}</div>
          <div className="fs-12 mt-12" style={{ color: "rgba(255,255,255,0.65)" }}>cuentas con prioridad ≥ 35</div>
        </div>
        <div className="card lg">
          <div className="card-eyebrow">Contactadas</div>
          <div className="bignum mt-12" style={{ fontSize: 56 }}>
            {contactados}<span className="decimal">/{queue.length}</span>
          </div>
          <div className="progress" style={{ marginTop: 16 }}><i style={{ width: `${pct}%` }} /></div>
          <div className="muted fs-12 mt-12">{pct}% del día completado</div>
        </div>
        <div className="card orange lg">
          <div className="bubble-wrap"><div className="bubble" /></div>
          <div className="card-eyebrow">Críticas</div>
          <div className="bignum mt-12" style={{ fontSize: 72 }}>{criticos.length}</div>
          <div className="fs-12 mt-12" style={{ color: "rgba(255,255,255,0.85)" }}>intervención inmediata</div>
        </div>
      </div>

      <div className="divider"><span className="kicker">Filtrar</span><span className="alt">/ por riesgo</span><span className="rule" /></div>

      <div className="chips">
        {([
          ["Todos", "Todos"],
          ["Critical", "Critical"],
          ["At Risk", "At Risk"],
          ["CaidaCritica", "Caída crítica"],
          ["NpsDetractor", "NPS Detractor"],
        ] as Array<[FilterKey, string]>).map(([key, label]) => (
          <button key={key} className={`chip${filter === key ? " active" : ""}`} onClick={() => setFilter(key)}>
            {label} <span className="cnt">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Críticos */}
      {criticos.length > 0 && (
        <>
          <div className="row-flex" style={{ gap: 10, margin: "18px 0 10px" }}>
            <span className="callout" style={{ background: "var(--red)", color: "white" }}>⚠ Crítico</span>
            <span className="serif" style={{ fontSize: 22 }}>intervención inmediata</span>
            <span className="muted fs-12">· {criticos.length} cuentas</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {criticos.map((a) => (
              <QueueCard key={a.id} a={a} contacted={contactedSet.has(a.id)} onToggle={() => toggle(a.id)} />
            ))}
          </div>
        </>
      )}

      {/* Resto */}
      {resto.length > 0 && (
        <>
          <div className="row-flex" style={{ gap: 10, margin: "28px 0 10px" }}>
            <span className="callout" style={{ background: "var(--amber)", color: "white" }}>Cola</span>
            <span className="serif" style={{ fontSize: 22 }}>resto de la cola</span>
            <span className="muted fs-12">· {resto.length} cuentas</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resto.map((a) => (
              <QueueCard key={a.id} a={a} contacted={contactedSet.has(a.id)} onToggle={() => toggle(a.id)} />
            ))}
          </div>
        </>
      )}
      </>
      )}
    </Layout>
  );
}
