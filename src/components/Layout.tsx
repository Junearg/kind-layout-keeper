import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

const TABS = [
  { to: "/resumen",   label: "Resumen" },
  { to: "/tendencia", label: "Tendencia" },
  { to: "/nps",       label: "NPS" },
  { to: "/health",    label: "Health Score" },
  { to: "/cola",      label: "Cola CS" },
  { to: "/kpis",      label: "KPIs" },
] as const;

const HELLO: Record<string, { crumbs: string; h1: ReactNode; sub: string }> = {
  "/resumen":   { crumbs: "Fudo CS Ops · Mayo 2026", h1: <>Resumen <span className="alt">ejecutivo</span></>, sub: "Análisis consolidado · Dic 2025 – May 2026 · 5,852 cuentas" },
  "/tendencia": { crumbs: "Fudo CS Ops · Tendencia", h1: <>Tendencia <span className="alt">mensual</span></>, sub: "Bajas, motivos y proyección · 5 meses cerrados + 2 proyectados" },
  "/nps":       { crumbs: "Fudo CS Ops · Voz del cliente", h1: <>Net Promoter <span className="alt">Score</span></>, sub: "6,915 respuestas · LATAM · Q1+Q2 2026" },
  "/health":    { crumbs: "Fudo CS Ops · Health Score", h1: <>Salud de la <span className="alt">base</span></>, sub: "818 cuentas activas · scoring 0-100 · tiers + flags" },
  "/cola":      { crumbs: "Fudo CS Ops · Workflow", h1: <>Cola de <span className="alt">trabajo</span></>, sub: "Priorización CS · cuentas en riesgo ordenadas por urgencia" },
  "/kpis":      { crumbs: "Fudo CS Ops · Iniciativas", h1: <>KPIs e <span className="alt">iniciativas</span></>, sub: "Targets a 3 y 6 meses · roadmap de retención" },
};

export function Layout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const active = TABS.find((t) => pathname.startsWith(t.to))?.to ?? "/resumen";
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
              <span className="v">23 May 2026</span>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
