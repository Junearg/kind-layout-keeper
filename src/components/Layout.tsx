import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDerived } from "@/data/derived";
import { useDashboardData } from "@/data/liveData";
import { useMesActivo, useMesesDisponibles, setMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import { useAuth } from "@/lib/auth-context";

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
  const navigate = useNavigate();
  const active = TABS.find((t) => pathname.startsWith(t.to))?.to ?? "/resumen";
  const d = useDerived();
  const { healthAccounts } = useDashboardData();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return healthAccounts
      .filter((a) =>
        a.nombre.toLowerCase().includes(s) ||
        String(a.id).includes(s) ||
        a.pais.toLowerCase().includes(s) ||
        a.tier.toLowerCase().includes(s),
      )
      .slice(0, 8);
  }, [q, healthAccounts]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const goToAccount = (id: number) => {
    setOpen(false);
    setQ("");
    navigate({ to: "/health", hash: `acc-${id}` });
  };

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
          <div className="search-pill" ref={searchRef} style={{ position: "relative", padding: 0, background: "var(--paper-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px" }}>
              <span>⌕</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Buscar cuenta, ID, país…"
                style={{
                  border: 0, outline: 0, background: "transparent",
                  fontSize: 12.5, color: "var(--ink)", width: 180,
                  fontFamily: "inherit",
                }}
              />
              <span className="mono" style={{ opacity: 0.7, fontSize: 11 }}>⌘K</span>
            </div>
            {open && q.trim() && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, left: 0,
                background: "var(--card)", border: "1px solid var(--rule)",
                borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
                zIndex: 30, maxHeight: 360, overflow: "auto", minWidth: 320,
              }}>
                {results.length === 0 ? (
                  <div className="muted fs-12" style={{ padding: "12px 14px" }}>Sin resultados</div>
                ) : results.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => goToAccount(a.id)}
                    style={{
                      display: "flex", width: "100%", textAlign: "left",
                      gap: 10, padding: "10px 14px", background: "transparent",
                      border: 0, borderBottom: "1px solid var(--rule)",
                      cursor: "pointer", alignItems: "center",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="strong" style={{ fontSize: 13, color: "var(--ink)" }}>{a.nombre}</div>
                      <div className="muted fs-11">#{a.id} · {a.pais} · {a.plan}</div>
                    </div>
                    <div className="fs-11" style={{ color: "var(--ink-2)" }}>{a.tier}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <MesSelector />
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

function MesSelector() {
  const meses = useMesesDisponibles();
  const activo = useMesActivo();
  if (meses.length === 0) {
    return (
      <Link to="/importar" className="btn ghost" style={{ fontSize: 12 }}>
        Importar datos
      </Link>
    );
  }
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Período
      </span>
      <select
        value={activo}
        onChange={(e) => setMesActivo(e.target.value)}
        style={{
          padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)",
          background: "var(--paper)", fontSize: 12.5, color: "var(--ink)",
          fontFamily: "inherit", cursor: "pointer",
        }}
      >
        {meses.map((m) => (
          <option key={m} value={m}>{mesLargo(m)}</option>
        ))}
      </select>
    </label>
  );
}
