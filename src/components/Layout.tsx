import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useDerived } from "@/data/derived";

const TABS = [
  { to: "/resumen",   label: "Resumen" },
  { to: "/tendencia", label: "Tendencia" },
  { to: "/nps",       label: "NPS" },
  { to: "/health",    label: "Health Score" },
  { to: "/cola",      label: "Cola CS" },
  { to: "/kpis",      label: "KPIs" },
  { to: "/importar",  label: "Importar" },
] as const;

export function Layout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const active = TABS.find((t) => pathname.startsWith(t.to))?.to ?? "/resumen";
  const d = useDerived();

  const periodLabel = d.periodLabel || "—";
  const nfmt = (n: number) => n.toLocaleString("es-AR");

  const HELLO: Record<string, { crumbs: string; h1: ReactNode; sub: string }> = {
    "/resumen": {
      crumbs: `Fudo Churn Center · ${d.latestClosedFull || periodLabel}`,
      h1: <>Fudo <span style={{ color: "var(--orange)" }}>Churn</span> Center</>,
      sub: `Análisis consolidado · ${periodLabel} · ${nfmt(d.activeAccounts)} cuentas activas`,
    },
    "/tendencia": {
      crumbs: "Fudo Churn Center · Tendencia",
      h1: <>Tendencia <span className="alt">mensual</span></>,
      sub: d.closedMonthsLabel
        ? `Bajas, motivos y proyección · ${d.closedMonthsLabel.split(" · ")[1] ?? ""} cerrados + ${d.totalProjected > 0 ? "proyección" : "sin proyección"}`
        : "Bajas, motivos y proyección",
    },
    "/nps": {
      crumbs: "Fudo Churn Center · Voz del cliente",
      h1: <>Net Promoter <span className="alt">Score</span></>,
      sub: `${nfmt(d.npsResponses)} respuestas · LATAM · ${periodLabel}`,
    },
    "/health": {
      crumbs: "Fudo Churn Center · Health Score",
      h1: <>Salud de la <span className="alt">base</span></>,
      sub: `${nfmt(d.activeAccounts)} cuentas activas · scoring 0-100 · tiers + flags`,
    },
    "/cola": {
      crumbs: "Fudo Churn Center · Workflow",
      h1: <>Cola de <span className="alt">trabajo</span></>,
      sub: "Priorización CS · cuentas en riesgo ordenadas por urgencia",
    },
    "/kpis": {
      crumbs: "Fudo Churn Center · Iniciativas",
      h1: <>KPIs e <span className="alt">iniciativas</span></>,
      sub: "Targets a 3 y 6 meses · roadmap de retención",
    },
    "/importar": {
      crumbs: "Fudo Churn Center · Datos",
      h1: <>Importar <span className="alt">cuentas</span></>,
      sub: "Validación automática antes de cargar el snapshot mensual",
    },
  };
  const hello = HELLO[active] ?? HELLO["/resumen"]!;

  return (
    <div className="app">
      <div className="bg-decor">Churn · Churn · Churn ·</div>
      <div className="shell">
        <div className="topbar">
          <div className="brand-mark">f</div>
          <nav className="tabs">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`tab-pill${active === t.to ? " active" : ""}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="search-pill">
            <span>⌕</span> Buscar… <span className="mono" style={{ marginLeft: 4, opacity: 0.7 }}>⌘K</span>
          </div>
          <button className="icon-btn" aria-label="notificaciones">🔔</button>
          <div className="avatar">CS</div>
        </div>

        <div className="hello">
          <div>
            <div className="crumbs">{hello.crumbs}</div>
            <h1>{hello.h1}</h1>
            <p className="sub">{hello.sub}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            {actions}
            <div className="stamp">
              última actualización<br />
              <span className="v">{d.lastUpdate}</span>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
