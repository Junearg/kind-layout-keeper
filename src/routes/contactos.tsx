import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { usePeriod } from "@/contexts/PeriodContext";
import { useCountry, PAISES_CONOCIDOS, type Pais } from "@/contexts/CountryContext";
import { supabase } from "@/integrations/supabase/client";
import { NpsSection } from "@/components/NpsSection";
import { CsatSection } from "@/components/CsatSection";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/contactos")({
  head: () => ({ meta: [{ title: "Contact Churn · Fudo Customer Center" }] }),
  component: ContactosPage,
});

type ContactoRow = {
  id_cuenta_dash: number | null;
  nombre: string | null;
  pais: string | null;
  ejecutivo: string | null;
  plan: string | null;
  estado_dash: string | null;
  cant_contactos: number | null;
  meses_con_contacto: string | null;
  primera_fecha_contacto: string | null;
  ultima_fecha_contacto: string | null;
  temas_contacto: string | null;
  motivos_contacto: string | null;
};

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

function countMeses(s: string | null): number {
  if (!s) return 0;
  return s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean).length;
}

function applyPaisFilter(query: any, pais: Pais) {
  if (pais === "Región") return query;
  if (pais === "Others") return query.not("pais", "in", `(${PAISES_CONOCIDOS.join(",")})`);
  return query.eq("pais", pais);
}

function useContactos(period: string, pais: Pais) {
  return useQuery({
    queryKey: ["contactos", period, pais],
    queryFn: async () => {
      const rows = await pageAll<ContactoRow>(() =>
        applyPaisFilter(
          supabase
            .from("clientes")
            .select(
              "id_cuenta_dash,nombre,pais,ejecutivo,plan,estado_dash,cant_contactos,meses_con_contacto,primera_fecha_contacto,ultima_fecha_contacto,temas_contacto,motivos_contacto",
            )
            .eq("mes_exportacion", period),
          pais,
        ),
      );
      return rows.map((r) => {
        const meses = countMeses(r.meses_con_contacto);
        const cant = Number(r.cant_contactos ?? 0);
        const rate = meses > 0 ? cant / meses : cant; // contactos por mes
        return { ...r, cant, meses, rate };
      });
    },
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}

// ── Churned accounts hook ────────────────────────────────────────────────────

function yyyyMM(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${names[m - 1]} ${y}`;
}

function useChurnedAccountsData(periodoMes: string) {
  return useQuery({
    queryKey: ["churned-accounts", periodoMes],
    queryFn: async () => {
      if (!periodoMes) return [];
      const start = `${periodoMes}-01`;
      const end = `${nextMonth(periodoMes)}-01`;
      const SEL = "id_cuenta_dash,nombre,pais,plan,ejecutivo,fecha_baja,nps_score,nps_categoria,nps_periodo,cant_contactos,meses_con_contacto,csat_cs_promedio,motivo_baja,comentarios_metabase,motivos_contacto,temas_contacto";
      // Churneados = etapa "Bajas" o "Bajas clientes" con fecha_baja en el período
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

function useChurnedMonths() {
  return useQuery({
    queryKey: ["churned-months"],
    queryFn: async () => {
      const rows = await pageAll<{ fecha_baja: string | null }>(() =>
        supabase
          .from("clientes")
          .select("fecha_baja")
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const nfmt = (n: number) => n.toLocaleString("es-AR");
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

type SortKey = "rate" | "cant" | "meses" | "ultima" | "nombre";

// ── Main page ────────────────────────────────────────────────────────────────

function ContactosPage() {
  return (
    <Layout>
      <ChurnedAccountsSection />
    </Layout>
  );
}

// ── ChurnedAccountsSection ───────────────────────────────────────────────────

const CHURNED_PAGE_SIZE = 10;
const PLANES = ["Inicial", "Avanzado", "Pro", "Base"];

type ChurnSortKey = "nombre" | "fecha_baja" | "nps_score" | "cant_contactos" | "meses_con_contacto" | "csat_cs_promedio";

function ChurnedAccountsSection() {
  const { data: availableMonths = [], isLoading: loadingMonths } = useChurnedMonths();

  const [periodoMes, setPeriodoMes] = useState<string>("");
  const [paisFilter, setPaisFilter] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [soloConNPS, setSoloConNPS] = useState(false);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<ChurnSortKey>("fecha_baja");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  // Once months load, default to first (most recent)
  const activePeriodo = periodoMes || availableMonths[0] || "";

  const { data: rawRows = [], isLoading: loadingRows } = useChurnedAccountsData(activePeriodo);

  // Unique países from data
  const paisesDisponibles = useMemo(
    () => Array.from(new Set(rawRows.map((r) => r.pais ?? "—"))).sort(),
    [rawRows],
  );

  // Apply filters
  const filtered = useMemo(() => {
    const qs = q.trim().toLowerCase();
    let rows = rawRows.filter((r) => {
      if (paisFilter && (r.pais ?? "—") !== paisFilter) return false;
      if (planFilter && (r.plan ?? "—") !== planFilter) return false;
      if (soloConNPS && r.nps_score == null) return false;
      if (qs) {
        const hay = `${r.nombre ?? ""} ${r.pais ?? ""} ${r.ejecutivo ?? ""}`.toLowerCase();
        if (!hay.includes(qs)) return false;
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
  }, [rawRows, paisFilter, planFilter, soloConNPS, q, sortKey, sortDir]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = filtered.length;
    const conNPS = filtered.filter((r) => r.nps_score != null);
    const npsScores = conNPS.map((r) => r.nps_score as number);
    const npsPromedio = npsScores.length > 0 ? npsScores.reduce((s, x) => s + x, 0) / npsScores.length : null;
    const conContactos = filtered.filter((r) => (r.cant_contactos ?? 0) > 0);
    const avgContactos = conContactos.length > 0
      ? conContactos.reduce((s, r) => s + (r.cant_contactos ?? 0), 0) / conContactos.length
      : 0;
    return { total, conNPS: conNPS.length, npsPromedio, conContactos: conContactos.length, avgContactos };
  }, [filtered]);

  // Chart data: group by país
  const chartData = useMemo(() => {
    const byPais: Record<string, { cantSum: number; npsSum: number; npsCount: number; count: number }> = {};
    for (const r of filtered) {
      const p = r.pais ?? "—";
      if (!byPais[p]) byPais[p] = { cantSum: 0, npsSum: 0, npsCount: 0, count: 0 };
      byPais[p].cantSum += r.cant_contactos ?? 0;
      byPais[p].count += 1;
      if (r.nps_score != null) {
        byPais[p].npsSum += r.nps_score;
        byPais[p].npsCount += 1;
      }
    }
    return Object.entries(byPais)
      .filter(([, v]) => v.count >= 1)
      .map(([pais, v]) => ({
        pais,
        avgContactos: v.count > 0 ? parseFloat((v.cantSum / v.count).toFixed(1)) : 0,
        avgNPS: v.npsCount > 0 ? parseFloat((v.npsSum / v.npsCount).toFixed(1)) : null,
      }))
      .sort((a, b) => a.pais.localeCompare(b.pais));
  }, [filtered]);

  // Pagination
  const pages = Math.max(1, Math.ceil(filtered.length / CHURNED_PAGE_SIZE));
  const pageRows = filtered.slice(page * CHURNED_PAGE_SIZE, (page + 1) * CHURNED_PAGE_SIZE);

  const toggleSort = (k: ChurnSortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(0);
  };

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
      {/* Filtros */}
      <div className="card" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Período */}
        <select
          value={activePeriodo}
          onChange={(e) => { setPeriodoMes(e.target.value); setPage(0); }}
          style={inputStyle}
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>

        {/* País */}
        <select
          value={paisFilter}
          onChange={(e) => { setPaisFilter(e.target.value); setPage(0); }}
          style={inputStyle}
        >
          <option value="">Todos los países</option>
          {paisesDisponibles.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Plan */}
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(0); }}
          style={inputStyle}
        >
          <option value="">Todos los planes</option>
          {PLANES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Solo con NPS */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={soloConNPS}
            onChange={(e) => { setSoloConNPS(e.target.checked); setPage(0); }}
          />
          Solo con NPS
        </label>

        {/* Búsqueda */}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Buscar nombre, país o ejecutivo…"
          style={{ ...inputStyle, minWidth: 200 }}
        />

        <span className="muted fs-12" style={{ marginLeft: "auto" }}>
          {nfmt(filtered.length)} resultados
        </span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 0 }}>
        <KpiCard
          label="Total churneados"
          value={nfmt(kpis.total)}
          sub={`en ${formatMonthLabel(activePeriodo)}`}
        />
        {/* Con NPS — % en naranja como el Dashboard */}
        <div className="card orange" style={{ padding: "20px 22px", minWidth: 220 }}>
          <div className="card-eyebrow" style={{ color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>Respondieron NPS</div>
          <div className="bignum" style={{ fontSize: 44, letterSpacing: "-0.03em" }}>
            {kpis.total > 0 ? `${((kpis.conNPS / kpis.total) * 100).toFixed(0)}%` : "—"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>
            {nfmt(kpis.conNPS)} de {nfmt(kpis.total)} cuentas
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 1fr", gap: 16, marginBottom: 4 }}>

        {/* 1. Donut NPS — solo churneados que votaron */}
        {(() => {
          const voters = filtered.filter(r => r.nps_score != null);
          const prom = voters.filter(r => (r.nps_score ?? 0) >= 9).length;
          const pas  = voters.filter(r => (r.nps_score ?? 0) >= 7 && (r.nps_score ?? 0) <= 8).length;
          const det  = voters.filter(r => (r.nps_score ?? 0) <= 6).length;
          const donutData = [
            { name: "Promotor",  value: prom, color: "#16A34A" },
            { name: "Pasivo",    value: pas,  color: "#D97706" },
            { name: "Detractor", value: det,  color: "#DC2626" },
          ].filter(d => d.value > 0);
          return (
            <div className="card" style={{ padding: 16 }}>
              <div className="card-eyebrow" style={{ marginBottom: 4 }}>NPS — churneados que votaron</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>{voters.length} de {filtered.length} respondieron</div>
              {voters.length === 0 ? (
                <div style={{ color: "var(--ink-4)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin datos NPS aún</div>
              ) : (
                <div style={{ position: "relative" }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="white" strokeWidth={2}>
                        {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`${v}`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", flexDirection: "column" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{voters.length}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)" }}>votaron</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                    {donutData.map(d => (
                      <span key={d.name} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        {d.name} {d.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 2. NPS promedio por ejecutivo */}
        {(() => {
          const byEj: Record<string, { sum: number; count: number; prom: number; pas: number; det: number }> = {};
          for (const r of filtered) {
            const ej = r.ejecutivo ?? "Sin asignar";
            if (!byEj[ej]) byEj[ej] = { sum: 0, count: 0, prom: 0, pas: 0, det: 0 };
            if (r.nps_score != null) {
              byEj[ej].sum += r.nps_score;
              byEj[ej].count++;
              if (r.nps_score >= 9) byEj[ej].prom++;
              else if (r.nps_score >= 7) byEj[ej].pas++;
              else byEj[ej].det++;
            }
          }
          const ejData = Object.entries(byEj)
            .filter(([, v]) => v.count > 0)
            .map(([ej, v]) => ({ ej: ej.split(" ")[0] ?? ej, ejFull: ej, avg: +(v.sum / v.count).toFixed(1), prom: v.prom, pas: v.pas, det: v.det, total: v.count }))
            .sort((a, b) => b.avg - a.avg);
          return (
            <div className="card" style={{ padding: 16 }}>
              <div className="card-eyebrow" style={{ marginBottom: 12 }}>NPS promedio por ejecutivo</div>
              {ejData.length === 0 ? (
                <div style={{ color: "var(--ink-4)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin datos NPS aún</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ejData} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="ej" width={70} tick={{ fontSize: 10, fill: "var(--ink-2)" }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: any, _: any, p: any) => [`${v} (${p?.payload?.total} resp.)`, "Avg NPS"]}
                      labelFormatter={(_: any, p: any) => p?.[0]?.payload?.ejFull ?? ""}
                    />
                    <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={18}>
                      {ejData.map((d, i) => (
                        <Cell key={i} fill={d.avg >= 9 ? "#16A34A" : d.avg >= 7 ? "#D97706" : "#DC2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })()}

        {/* 3. Contacto vs NPS — próximamente */}
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
          <div className="card-eyebrow" style={{ marginBottom: 8 }}>Contacto vs NPS</div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>Sin datos disponibles aún</div>
        </div>

      </div>

      {/* Table */}
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
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const npsScore = r.nps_score;
                    // NPS: 1-6 Detractor, 7-8 Pasivo, 9-10 Promotor
                    let npsBg = "transparent";
                    let npsColor = "var(--ink-3)";
                    let npsLabel = "";
                    if (npsScore != null) {
                      if (npsScore <= 6)  { npsBg = "rgba(239,68,68,0.12)";  npsColor = "#DC2626"; npsLabel = "Detractor"; }
                      else if (npsScore <= 8) { npsBg = "rgba(245,158,11,0.12)"; npsColor = "#D97706"; npsLabel = "Pasivo"; }
                      else               { npsBg = "rgba(34,197,94,0.12)";  npsColor = "#16A34A"; npsLabel = "Promotor"; }
                    }
                    const meses = countMeses(r.meses_con_contacto);
                    const cant = Number(r.cant_contactos ?? 0);
                    return (
                      <tr key={`${r.nombre}-${i}`} style={{ borderTop: "1px solid var(--rule)" }}>
                        {/* Cuenta */}
                        <td style={tdStyle}>
                          <div className="strong" style={{ color: "var(--ink)", fontSize: 12.5 }}>{r.nombre ?? "—"}</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "monospace" }}>#{r.id_cuenta_dash ?? "—"}</div>
                        </td>
                        {/* País */}
                        <td style={tdStyle}>{r.pais ?? "—"}</td>
                        {/* Plan */}
                        <td style={tdStyle}>
                          {r.plan ? <span className="tag outline" style={{ fontSize: 11 }}>{r.plan}</span> : "—"}
                        </td>
                        {/* Ejecutivo */}
                        <td style={{ ...tdStyle, fontSize: 12 }}>{r.ejecutivo ?? "—"}</td>
                        {/* Motivo Baja */}
                        <td style={{ ...tdStyle, maxWidth: 160 }}>
                          <span style={{ fontSize: 12, color: "var(--ink-2)" }} title={r.motivo_baja ?? ""}>
                            {r.motivo_baja ? (r.motivo_baja.length > 28 ? r.motivo_baja.slice(0, 28) + "…" : r.motivo_baja) : "—"}
                          </span>
                        </td>
                        {/* NPS Score */}
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{ background: npsBg, color: npsColor, padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                            {npsScore != null ? npsScore : "—"}
                          </span>
                          {npsScore != null && (
                            <div style={{ fontSize: 9.5, color: npsColor, marginTop: 2 }}>{npsLabel}</div>
                          )}
                        </td>
                        {/* Contactos */}
                        <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{cant}</span>
                          <div style={{ fontSize: 10, color: "var(--ink-4)" }}>{meses}m con contacto</div>
                        </td>
                        {/* Motivos de Contacto */}
                        <td style={{ ...tdStyle, maxWidth: 220 }}>
                          <span style={{ fontSize: 11.5, color: "var(--ink-2)" }} title={r.motivos_contacto ?? ""}>
                            {r.motivos_contacto
                              ? (r.motivos_contacto.length > 45 ? r.motivos_contacto.slice(0, 45) + "…" : r.motivos_contacto)
                              : <span style={{ color: "var(--ink-4)" }}>—</span>}
                          </span>
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

// ── Shared style constants ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, border: "1px solid var(--rule-2)",
  background: "var(--paper)", fontSize: 12.5, color: "var(--ink)",
  fontFamily: "inherit", outline: "none", minWidth: 160,
};

const tdStyle: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top", color: "var(--ink-2)" };

function Th({ children, onClick, active, dir, align }: { children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: "asc" | "desc"; align?: "right" }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "10px 12px", fontSize: 11, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: 0.5, color: "var(--ink-3)", cursor: onClick ? "pointer" : "default",
        textAlign: align ?? "left", userSelect: "none",
      }}
    >
      {children}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div className="card-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="bignum" style={{ fontSize: 44, marginTop: 0, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      {sub && (
        <div className="fs-12 muted" style={{ marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}
