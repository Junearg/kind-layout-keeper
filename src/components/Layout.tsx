import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDerived } from "@/data/derived";
import { useDashboardData } from "@/data/liveData";
import { useMesActivo, useMesesDisponibles, setMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import { useAuth } from "@/lib/auth-context";
import { usePeriod, periodLabel } from "@/contexts/PeriodContext";

const TABS = [

  { to: "/resumen",   label: "Dashboard" },
  { to: "/tendencia", label: "Churn Rate" },
  { to: "/health",    label: "Health Score" },
  { to: "/contactos", label: "Contact Churn" },
  { to: "/nps",       label: "NPS" },
  { to: "/csat",      label: "CSAT" },
  { to: "/kpis",      label: "KPI´s" },
  { to: "/labs",      label: "⚗ Labs", beta: true },
] as const;


export function Layout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active: string = TABS.find((t) => pathname.startsWith(t.to))?.to ?? (pathname.startsWith("/importar") ? "/importar" : "/resumen");
  const d = useDerived();
  const { healthAccounts } = useDashboardData();

  // BUG 4 — Sync bidireccional entre PeriodContext (Supabase) y dataset-store (mes activo)
  const { selectedPeriod, availablePeriods, setSelectedPeriod } = usePeriod();
  const mesActivoStore = useMesActivo();
  const mesesStore = useMesesDisponibles();
  useEffect(() => {
    if (selectedPeriod && selectedPeriod !== mesActivoStore && mesesStore.includes(selectedPeriod)) {
      setMesActivo(selectedPeriod);
    } else if (
      mesActivoStore &&
      mesActivoStore !== selectedPeriod &&
      availablePeriods.includes(mesActivoStore)
    ) {
      setSelectedPeriod(mesActivoStore);
    }
  }, [selectedPeriod, mesActivoStore, availablePeriods, mesesStore, setSelectedPeriod]);


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
      crumbs: `Fudo Customer Center · ${d.latestClosedFull || periodLabel}`,
      h1: <>Fudo <span style={{ color: "var(--orange)" }}>Customer</span> Center</>,

      sub: `Análisis consolidado · ${periodLabel} · ${nfmt(d.activeAccounts)} cuentas activas`,
    },
    "/tendencia": {
      crumbs: "Fudo Customer Center · Churn Rate",
      h1: <>Churn <span className="alt">Rate</span></>,
      sub: d.closedMonthsLabel
        ? `Bajas, motivos y proyección · ${d.closedMonthsLabel.split(" · ")[1] ?? ""} cerrados + ${d.totalProjected > 0 ? "proyección" : "sin proyección"}`
        : "Bajas, motivos y proyección",
    },
    "/nps": {
      crumbs: "Fudo Customer Center · Voz del cliente",
      h1: <>Net Promoter <span className="alt">Score</span></>,
      sub: `${nfmt(d.npsResponses)} respuestas · LATAM · ${periodLabel}`,
    },
    "/health": {
      crumbs: "Fudo Customer Center · Health Score",
      h1: <>Salud de la <span className="alt">base</span></>,
      sub: `${nfmt(d.activeAccounts)} cuentas activas · scoring 0-100 · tiers + flags`,
    },
    "/cola": {
      crumbs: "Fudo Customer Center · Workflow",
      h1: <>Cola de <span className="alt">trabajo</span></>,
      sub: "Priorización CS · cuentas en riesgo ordenadas por urgencia",
    },
    "/contactos": {
      crumbs: "Fudo Customer Center · Contact Churn",
      h1: <>Contact <span className="alt">Churn</span></>,
      sub: "Frecuencia de contacto CS por cuenta · contactos por mes activo",
    },
    "/csat": {
      crumbs: "Fudo Customer Center · Voz del cliente",
      h1: <>Customer <span className="alt">Satisfaction</span></>,
      sub: "CSAT Onboarding y Customer Success · score 1-5 por cuenta",
    },

    "/kpis": {
      crumbs: "Fudo Customer Center · Iniciativas",
      h1: <>KPIs e <span className="alt">iniciativas</span></>,
      sub: "Targets a 3 y 6 meses · roadmap de retención",
    },

    "/labs": {
      crumbs: "Fudo Customer Center · Labs",
      h1: <>Labs · <span className="alt">Laboratorio de prevención</span></>,
      sub: "Herramientas experimentales basadas en el historial de bajas. Los números son reales, las palancas son tuyas.",
    },

    "/importar": {
      crumbs: "Fudo Customer Center · Datos",
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="brand-mark">f</div>
            {active !== "/importar" && <PeriodBadge />}
          </div>
          <nav className="tabs">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`tab-pill${active === t.to ? " active" : ""}`}
                style={(t as any).beta ? { position: "relative" } : undefined}
              >
                {t.label}
                {(t as any).beta && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 4,
                    background: "var(--orange)", color: "white", fontWeight: 700,
                    letterSpacing: 0.5, verticalAlign: "middle",
                  }}>BETA</span>
                )}
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
          <UserMenu />
        </div>

        <div className="hello">
          <div>
            <h1>{hello.h1}</h1>

          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {active !== "/importar" && (
                <Link
                  to="/importar"
                  className="btn ghost"
                  style={{ gap: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 140 }}
                >
                  <span style={{ fontSize: 13 }}>↑</span> Importar
                </Link>
              )}
              {actions}
            </div>
            {active !== "/importar" && <PeriodSelector />}



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

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="avatar"
        style={{ border: 0, cursor: "pointer", fontFamily: "inherit" }}
        title={user?.email ?? ""}
      >
        {initials}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "var(--card)", border: "1px solid var(--rule)",
          borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          minWidth: 220, zIndex: 30, overflow: "hidden",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div className="fs-11 muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Sesión
            </div>
            <div className="fs-12 strong" style={{ color: "var(--ink)", wordBreak: "break-all" }}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", background: "transparent", border: 0,
              cursor: "pointer", fontSize: 13, color: "var(--ink)",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function PeriodBadge() {
  const { selectedPeriod, loading } = usePeriod();
  if (loading || !selectedPeriod) return null;
  return (
    <span
      className="mono"
      style={{
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(240,90,40,0.10)",
        color: "var(--orange)",
        border: "1px solid rgba(240,90,40,0.25)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        fontWeight: 600,
      }}
      title="Período activo (Supabase)"
    >
      {periodLabel(selectedPeriod)}
    </span>
  );
}

function PeriodSelector() {
  const { selectedPeriod, availablePeriods, setSelectedPeriod, loading } = usePeriod();
  if (loading) return null;
  if (availablePeriods.length === 0) {
    return (
      <Link to="/importar" className="btn ghost" style={{ fontSize: 12 }}>
        Importar datos
      </Link>
    );
  }
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Período (Supabase)
      </span>
      <select
        value={selectedPeriod}
        onChange={(e) => setSelectedPeriod(e.target.value)}
        style={{
          padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)",
          background: "var(--paper)", fontSize: 12.5, color: "var(--ink)",
          fontFamily: "inherit", cursor: "pointer",
        }}
      >
        {availablePeriods.map((p) => (
          <option key={p} value={p}>{periodLabel(p)}</option>
        ))}
      </select>
    </label>
  );
}

