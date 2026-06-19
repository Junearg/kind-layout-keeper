import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAISES_CONOCIDOS, type Pais } from "@/contexts/CountryContext";
import { useFeedback } from "@/data/supabase-feedback";
import { usePeriodosDisponibles } from "@/data/supabase-segmentacion";

// ── Types ────────────────────────────────────────────────────────────────────

type ChurnedRow = {
  id_cuenta_dash: number | null;
  nombre: string | null;
  pais: string | null;
  plan: string | null;
  ejecutivo: string | null;
  fecha_baja: string | null;
  nps_score: number | null;
  nps_categoria: string | null;
  nps_periodo: string | null;
  cant_contactos: number | null;
  meses_con_contacto: string | null;
  csat_cs_promedio: number | null;
  motivo_baja: string | null;
  comentarios_metabase: string | null;
  motivos_contacto: string | null;
  temas_contacto: string | null;
};

type ChurnSortKey =
  | "nombre"
  | "fecha_baja"
  | "nps_score"
  | "cant_contactos"
  | "meses_con_contacto"
  | "csat_cs_promedio";

type ColFilters = {
  cuenta: string; pais: string; plan: string;
  ejecutivo: string; motivoBaja: string; nps: string; motivosContacto: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const CHURNED_PAGE_SIZE = 10;
const PLANES = ["Inicial", "Avanzado", "Pro", "Base"];
const NPS_OPTS = ["Promotor", "Pasivo", "Detractor", "Sin NPS"];
const EMPTY_FILTERS: ColFilters = {
  cuenta: "", pais: "", plan: "", ejecutivo: "", motivoBaja: "", nps: "", motivosContacto: "",
};
export const EMPTY_ROWS: ChurnedRow[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

const nfmt = (n: number) => n.toLocaleString("es-AR");

function countMeses(s: string | null): number {
  if (!s) return 0;
  return s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean).length;
}

async function pageAll<T>(builder: () => any): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await builder().range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

function yyyyMM(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 12) return `${y! + 1}-01`;
  return `${y}-${String(m! + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${names[m! - 1]} ${y}`;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useChurnedAccountsData(periodoMes: string) {
  return useQuery({
    queryKey: ["churned-accounts", periodoMes],
    queryFn: async () => {
      if (!periodoMes) return [];
      const start = `${periodoMes}-01`;
      const end   = `${nextMonth(periodoMes)}-01`;
      const SEL = "id_cuenta_dash,nombre,pais,plan,ejecutivo,fecha_baja,nps_score,nps_categoria,nps_periodo,cant_contactos,meses_con_contacto,csat_cs_promedio,motivo_baja,comentarios_metabase,motivos_contacto,temas_contacto";
      const [byBajas, byBajasClientes] = await Promise.all([
        pageAll<ChurnedRow>(() =>
          supabase.from("clientes").select(SEL)
            .eq("etapa", "Bajas").not("fecha_baja","is",null).gte("fecha_baja",start).lt("fecha_baja",end)
        ),
        pageAll<ChurnedRow>(() =>
          supabase.from("clientes").select(SEL)
            .eq("etapa", "Bajas clientes").not("fecha_baja","is",null).gte("fecha_baja",start).lt("fecha_baja",end)
        ),
      ]);
      const seen = new Set<string>();
      const rows: ChurnedRow[] = [];
      for (const r of [...byBajas, ...byBajasClientes]) {
        const key = `${r.id_cuenta_dash}`;
        if (!seen.has(key)) { seen.add(key); rows.push(r); }
      }
      return rows;
    },
    enabled: Boolean(periodoMes),
    staleTime: 60_000,
  });
}

export function useChurnedMonths() {
  return useQuery({
    queryKey: ["churned-months"],
    queryFn: async () => {
      const rows = await pageAll<{ fecha_baja: string | null }>(() =>
        supabase.from("clientes").select("fecha_baja")
          .in("etapa", ["Bajas", "Bajas clientes"])
          .not("fecha_baja", "is", null),
      );
      const months = Array.from(
        new Set(rows.map((r) => (r.fecha_baja ? yyyyMM(r.fecha_baja) : null)).filter(Boolean) as string[]),
      ).sort((a, b) => b.localeCompare(a));
      return months;
    },
    staleTime: 5 * 60_000,
  });
}

// ── SVG Donut ────────────────────────────────────────────────────────────────

type DonutSlice = { name: string; value: number; color: string };
function SvgDonut({ data, centerValue, centerLabel }: { data: DonutSlice[]; centerValue: number; centerLabel: string }) {
  const SIZE = 120, CX = 60, CY = 60, R_OUT = 56, R_IN = 38;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cumPct = 0;
  const GAP_DEG = 3;
  const slices = data.map(d => {
    const pct = d.value / total;
    const start = cumPct;
    cumPct += pct;
    return { ...d, start, end: cumPct };
  });
  function arcPath(startPct: number, endPct: number) {
    const gapRad = (GAP_DEG / 360) * 2 * Math.PI;
    const s = startPct * 2 * Math.PI - Math.PI / 2 + gapRad / 2;
    const e = endPct * 2 * Math.PI - Math.PI / 2 - gapRad / 2;
    if (e - s <= 0) return "";
    const x1o = CX + R_OUT * Math.cos(s), y1o = CY + R_OUT * Math.sin(s);
    const x2o = CX + R_OUT * Math.cos(e), y2o = CY + R_OUT * Math.sin(e);
    const x1i = CX + R_IN * Math.cos(e), y1i = CY + R_IN * Math.sin(e);
    const x2i = CX + R_IN * Math.cos(s), y2i = CY + R_IN * Math.sin(s);
    const large = e - s > Math.PI ? 1 : 0;
    return `M ${x1o} ${y1o} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${R_IN} ${R_IN} 0 ${large} 0 ${x2i} ${y2i} Z`;
  }
  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE}>
        {slices.map((s, i) => (
          <path key={i} d={arcPath(s.start, s.end)} fill={s.color} />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{centerValue}</div>
        <div style={{ fontSize: 9, color: "var(--ink-4)" }}>{centerLabel}</div>
      </div>
    </div>
  );
}

// ── Style constants ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, border: "1px solid var(--rule-2)",
  background: "var(--paper)", fontSize: 12.5, color: "var(--ink)",
  fontFamily: "inherit", outline: "none", minWidth: 160,
};

const thFilterTd: React.CSSProperties = { padding: "4px 6px", verticalAlign: "middle" };

const colFilterInput: React.CSSProperties = {
  width: "100%", padding: "4px 7px", borderRadius: 6,
  border: "1px solid var(--rule)", background: "var(--paper)",
  fontSize: 11, color: "var(--ink)", fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};

const tdStyle: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top", color: "var(--ink-2)" };

// ── Sub-components ───────────────────────────────────────────────────────────

function Th({ children, onClick, active, dir, align }: {
  children: React.ReactNode; onClick?: () => void;
  active?: boolean; dir?: "asc" | "desc"; align?: "right" | "center";
}) {
  return (
    <th onClick={onClick} style={{
      padding: "10px 12px", fontSize: 11, fontWeight: 500, textTransform: "uppercase",
      letterSpacing: 0.5, color: "var(--ink-3)", cursor: onClick ? "pointer" : "default",
      textAlign: align ?? "left", userSelect: "none",
    }}>
      {children}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div className="card-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="bignum" style={{ fontSize: 44, marginTop: 0, letterSpacing: "-0.03em" }}>{value}</div>
      {sub && <div className="fs-12 muted" style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Main exported component ──────────────────────────────────────────────────

export function ChurnedSection() {
  const { data: availableMonths = [], isLoading: loadingMonths } = usePeriodosDisponibles();

  const [periodoMes, setPeriodoMes] = useState<string>("");
  const [cols, setCols] = useState<ColFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<ChurnSortKey>("fecha_baja");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const setCol = (k: keyof ColFilters, v: string) => {
    setCols((prev) => ({ ...prev, [k]: v }));
    setPage(0);
  };

  const activePeriodo = periodoMes || availableMonths[0] || "";

  const { data: rawRows = EMPTY_ROWS, isLoading: loadingRows } = useChurnedAccountsData(activePeriodo);


  // Feedback del mismo mes para cruzar por id_cuenta
  const { data: feedbackRows = [] } = useFeedback(activePeriodo);
  const feedbackBycuenta = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of feedbackRows) {
      if (f.id_cuenta) map.set(f.id_cuenta, f.feedback);
    }
    return map;
  }, [feedbackRows]);

  const opcionesPais = useMemo(
    () => Array.from(new Set(rawRows.map((r) => r.pais ?? "—").filter(Boolean))).sort(),
    [rawRows],
  );
  const opcionesEjecutivo = useMemo(
    () => Array.from(new Set(rawRows.map((r) => r.ejecutivo ?? "—").filter(Boolean))).sort(),
    [rawRows],
  );
  const opcionesMotivoBaja = useMemo(
    () => Array.from(new Set(rawRows.map((r) => r.motivo_baja ?? "").filter(Boolean))).sort(),
    [rawRows],
  );

  const filtered = useMemo(() => {
    let rows = rawRows.filter((r) => {
      if (cols.cuenta) {
        const hay = `${r.nombre ?? ""} ${r.id_cuenta_dash ?? ""}`.toLowerCase();
        if (!hay.includes(cols.cuenta.toLowerCase())) return false;
      }
      if (cols.pais && (r.pais ?? "—") !== cols.pais) return false;
      if (cols.plan) {
        const planBase = (r.plan ?? "").toLowerCase().split("-")[0] ?? "";
        if (!planBase.includes(cols.plan.toLowerCase())) return false;
      }
      if (cols.ejecutivo && (r.ejecutivo ?? "—") !== cols.ejecutivo) return false;
      if (cols.motivoBaja && (r.motivo_baja ?? "") !== cols.motivoBaja) return false;
      if (cols.nps) {
        if (cols.nps === "Sin NPS" && r.nps_score != null) return false;
        if (cols.nps === "Promotor" && (r.nps_score == null || r.nps_score < 9)) return false;
        if (cols.nps === "Pasivo" && (r.nps_score == null || r.nps_score < 7 || r.nps_score > 8)) return false;
        if (cols.nps === "Detractor" && (r.nps_score == null || r.nps_score > 6)) return false;
      }
      if (cols.motivosContacto) {
        const hay = (r.motivos_contacto ?? "").toLowerCase();
        if (!hay.includes(cols.motivosContacto.toLowerCase())) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "nombre":
          return (a.nombre ?? "").localeCompare(b.nombre ?? "") * dir;
        case "fecha_baja": {
          const av = a.fecha_baja ? new Date(a.fecha_baja).getTime() : 0;
          const bv = b.fecha_baja ? new Date(b.fecha_baja).getTime() : 0;
          return (av - bv) * dir;
        }
        case "nps_score":
          return ((a.nps_score ?? -1) - (b.nps_score ?? -1)) * dir;
        case "cant_contactos":
          return ((a.cant_contactos ?? 0) - (b.cant_contactos ?? 0)) * dir;
        case "meses_con_contacto":
          return (countMeses(a.meses_con_contacto) - countMeses(b.meses_con_contacto)) * dir;
        case "csat_cs_promedio":
          return ((a.csat_cs_promedio ?? -1) - (b.csat_cs_promedio ?? -1)) * dir;
      }
    });

    return rows;
  }, [rawRows, cols, sortKey, sortDir]);

  const hasFilters = Object.values(cols).some(Boolean);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const conNPS = filtered.filter((r) => r.nps_score != null);
    return { total, conNPS: conNPS.length };
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / CHURNED_PAGE_SIZE));
  const pageRows = filtered.slice(page * CHURNED_PAGE_SIZE, (page + 1) * CHURNED_PAGE_SIZE);

  const toggleSort = (k: ChurnSortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(0);
  };

  // Chart data
  const voters = filtered.filter(r => r.nps_score != null);
  const prom = voters.filter(r => (r.nps_score ?? 0) >= 9).length;
  const pas  = voters.filter(r => (r.nps_score ?? 0) >= 7 && (r.nps_score ?? 0) <= 8).length;
  const det  = voters.filter(r => (r.nps_score ?? 0) <= 6).length;
  const totalVoters = voters.length;
  const donutData = [
    { name: "Promotor",  value: prom, color: "#16A34A" },
    { name: "Pasivo",    value: pas,  color: "#D97706" },
    { name: "Detractor", value: det,  color: "#DC2626" },
  ].filter(d => d.value > 0);
  const pct = (n: number) => totalVoters > 0 ? `${Math.round((n / totalVoters) * 100)}%` : "0%";

  const byPlan: Record<string, { conNPS: number; total: number }> = {};
  for (const r of filtered) {
    const plan = r.plan ?? "Sin plan";
    if (!byPlan[plan]) byPlan[plan] = { conNPS: 0, total: 0 };
    byPlan[plan].total++;
    if (r.nps_score != null) byPlan[plan].conNPS++;
  }
  const planData = Object.entries(byPlan)
    .filter(([, v]) => v.total > 0)
    .map(([plan, v]) => ({ plan, pct: +((v.conNPS / v.total) * 100).toFixed(1), conNPS: v.conNPS, total: v.total }))
    .sort((a, b) => b.pct - a.pct);

  if (loadingMonths) {
    return <div className="card" style={{ padding: 20 }}>Cargando períodos…</div>;
  }
  if (availableMonths.length === 0) {
    return (
      <div className="card" style={{ padding: 20, color: "var(--ink-3)" }}>
        No hay cuentas churneadas registradas.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Barra superior */}
      <div className="card" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={activePeriodo}
          onChange={(e) => { setPeriodoMes(e.target.value); setPage(0); }}
          style={inputStyle}
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setCols(EMPTY_FILTERS); setPage(0); }}
            style={{ ...inputStyle, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", cursor: "pointer", minWidth: "auto" }}
          >
            Limpiar filtros ✕
          </button>
        )}

        <span className="muted fs-12" style={{ marginLeft: "auto" }}>
          {nfmt(filtered.length)} resultados
        </span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KpiCard
          label="Churneados este período"
          value={nfmt(kpis.total)}
          sub={`en ${formatMonthLabel(activePeriodo)}`}
        />
        <div className="card orange" style={{ padding: "20px 22px", minWidth: 220 }}>
          <div className="card-eyebrow" style={{ color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>NPS — este período</div>
          <div className="bignum" style={{ fontSize: 44, letterSpacing: "-0.03em" }}>
            {kpis.total > 0 ? `${((kpis.conNPS / kpis.total) * 100).toFixed(0)}%` : "—"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>
            {nfmt(kpis.conNPS)} de {nfmt(kpis.total)} churneados en {formatMonthLabel(activePeriodo)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Donut */}
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexShrink: 0 }}>
            <SvgDonut data={donutData} centerValue={totalVoters} centerLabel="votaron" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginBottom: 2 }}>
                NPS churneados · {totalVoters} de {filtered.length}
              </div>
              {donutData.map(d => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--ink-2)", width: 72 }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.color, width: 36, textAlign: "right" }}>{pct(d.value)}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-4)", width: 24, textAlign: "right" }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: 1, background: "var(--rule)", alignSelf: "stretch", flexShrink: 0 }} />

          {/* Barras por plan */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginBottom: 10 }}>
              % que respondió NPS por plan
            </div>
            {planData.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>Sin datos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {planData.map(d => (
                  <div key={d.plan} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-2)", width: 68, flexShrink: 0 }}>{d.plan}</span>
                    <div style={{ flex: 1, background: "var(--rule)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                      <div style={{ width: `${d.pct}%`, background: "#E8631A", height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#E8631A", width: 40, textAlign: "right", flexShrink: 0 }}>{d.pct}%</span>
                    <span style={{ fontSize: 11, color: "var(--ink-4)", width: 60, flexShrink: 0 }}>{d.conNPS}/{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loadingRows ? (
          <div style={{ padding: 20, color: "var(--ink-3)" }}>Cargando cuentas churneadas…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>
            No hay cuentas churneadas para los filtros seleccionados.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--paper-2)", textAlign: "left" }}>
                    <Th onClick={() => toggleSort("nombre")} active={sortKey === "nombre"} dir={sortDir}>Cuenta</Th>
                    <Th>País</Th>
                    <Th>Plan</Th>
                    <Th>Ejecutivo</Th>
                    <Th>Motivo Baja</Th>
                    <Th onClick={() => toggleSort("nps_score")} active={sortKey === "nps_score"} dir={sortDir} align="center">NPS</Th>
                    <Th onClick={() => toggleSort("cant_contactos")} active={sortKey === "cant_contactos"} dir={sortDir} align="right">Contactos</Th>
                    <Th>Motivos de Contacto</Th>
                    <Th>Feedback</Th>
                  </tr>
                  <tr style={{ background: "var(--paper-2)", borderTop: "1px solid var(--rule)" }}>
                    <td style={thFilterTd}>
                      <input value={cols.cuenta} onChange={e => setCol("cuenta", e.target.value)} placeholder="Buscar…" style={colFilterInput} />
                    </td>
                    <td style={thFilterTd}>
                      <select value={cols.pais} onChange={e => setCol("pais", e.target.value)} style={colFilterInput}>
                        <option value="">Todos</option>
                        {opcionesPais.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={thFilterTd}>
                      <select value={cols.plan} onChange={e => setCol("plan", e.target.value)} style={colFilterInput}>
                        <option value="">Todos</option>
                        {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={thFilterTd}>
                      <select value={cols.ejecutivo} onChange={e => setCol("ejecutivo", e.target.value)} style={colFilterInput}>
                        <option value="">Todos</option>
                        {opcionesEjecutivo.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>
                    <td style={thFilterTd}>
                      <select value={cols.motivoBaja} onChange={e => setCol("motivoBaja", e.target.value)} style={colFilterInput}>
                        <option value="">Todos</option>
                        {opcionesMotivoBaja.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td style={{ ...thFilterTd, textAlign: "center" }}>
                      <select value={cols.nps} onChange={e => setCol("nps", e.target.value)} style={colFilterInput}>
                        <option value="">Todos</option>
                        {NPS_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td style={thFilterTd} />
                    <td style={thFilterTd}>
                      <input value={cols.motivosContacto} onChange={e => setCol("motivosContacto", e.target.value)} placeholder="Buscar…" style={colFilterInput} />
                    </td>
                    <td style={thFilterTd} />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const npsScore = r.nps_score;
                    let npsBg = "transparent", npsColor = "var(--ink-3)", npsLabel = "";
                    if (npsScore != null) {
                      if (npsScore <= 6)      { npsBg = "rgba(239,68,68,0.12)";  npsColor = "#DC2626"; npsLabel = "Detractor"; }
                      else if (npsScore <= 8) { npsBg = "rgba(245,158,11,0.12)"; npsColor = "#D97706"; npsLabel = "Pasivo"; }
                      else                   { npsBg = "rgba(34,197,94,0.12)";  npsColor = "#16A34A"; npsLabel = "Promotor"; }
                    }
                    const meses = countMeses(r.meses_con_contacto);
                    const cant  = Number(r.cant_contactos ?? 0);
                    return (
                      <tr key={`${r.nombre}-${i}`} style={{ borderTop: "1px solid var(--rule)" }}>
                        <td style={tdStyle}>
                          <div className="strong" style={{ color: "var(--ink)", fontSize: 12.5 }}>{r.nombre ?? "—"}</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "monospace" }}>#{r.id_cuenta_dash ?? "—"}</div>
                        </td>
                        <td style={tdStyle}>{r.pais ?? "—"}</td>
                        <td style={tdStyle}>
                          {r.plan ? <span className="tag outline" style={{ fontSize: 11 }}>{r.plan}</span> : "—"}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{r.ejecutivo ?? "—"}</td>
                        <td style={{ ...tdStyle, maxWidth: 160 }}>
                          <span style={{ fontSize: 12, color: "var(--ink-2)" }} title={r.motivo_baja ?? ""}>
                            {r.motivo_baja ? (r.motivo_baja.length > 28 ? r.motivo_baja.slice(0, 28) + "…" : r.motivo_baja) : "—"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{ background: npsBg, color: npsColor, padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                            {npsScore != null ? npsScore : "—"}
                          </span>
                          {npsScore != null && <div style={{ fontSize: 9.5, color: npsColor, marginTop: 2 }}>{npsLabel}</div>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{cant}</span>
                          <div style={{ fontSize: 10, color: "var(--ink-4)" }}>{meses}m con contacto</div>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 220 }}>
                          <span style={{ fontSize: 11.5, color: "var(--ink-2)" }} title={r.motivos_contacto ?? ""}>
                            {r.motivos_contacto
                              ? (r.motivos_contacto.length > 45 ? r.motivos_contacto.slice(0, 45) + "…" : r.motivos_contacto)
                              : <span style={{ color: "var(--ink-4)" }}>—</span>}
                          </span>
                        </td>
                        {/* Feedback cruzado */}
                        <td style={{ ...tdStyle, maxWidth: 200 }}>
                          {r.id_cuenta_dash != null && feedbackBycuenta.has(r.id_cuenta_dash) ? (
                            <span style={{ fontSize: 11.5, color: "#6366F1", fontStyle: "italic", lineHeight: 1.4, display: "block" }}
                              title={feedbackBycuenta.get(r.id_cuenta_dash)}>
                              {(() => { const t = feedbackBycuenta.get(r.id_cuenta_dash)!; return t.length > 55 ? t.slice(0, 55) + "…" : t; })()}
                            </span>
                          ) : (
                            <span style={{ color: "var(--ink-4)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderTop: "1px solid var(--rule)" }}>
                <span className="muted fs-12">Página {page + 1} de {pages}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Anterior</button>
                  <button className="btn ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Siguiente →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
