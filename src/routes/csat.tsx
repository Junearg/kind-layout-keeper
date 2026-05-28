import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { usePeriod } from "@/contexts/PeriodContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

export const Route = createFileRoute("/csat")({
  head: () => ({ meta: [{ title: "CSAT · Fudo Churn Center" }] }),
  component: CsatPage,
});

type CsatRow = {
  id_cuenta_dash: number | null;
  nombre: string | null;
  pais: string | null;
  ejecutivo: string | null;
  plan: string | null;
  estado_dash: string | null;
  csat_onb_promedio: number | null;
  csat_onb_n: number | null;
  csat_cs_promedio: number | null;
  csat_cs_n: number | null;
  csat_periodo: string | null;
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

/** Normaliza CSAT a escala 0-5 (puede venir x10 o x100). */
function normalizeCsat(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  if (n > 50) return n / 100;
  if (n > 5) return n / 10;
  return n;
}

function useCsat(period: string) {
  return useQuery({
    queryKey: ["csat", period],
    queryFn: async () => {
      const rows = await pageAll<CsatRow>(() =>
        supabase
          .from("clientes")
          .select(
            "id_cuenta_dash,nombre,pais,ejecutivo,plan,estado_dash,csat_onb_promedio,csat_onb_n,csat_cs_promedio,csat_cs_n,csat_periodo",
          )
          .eq("mes_exportacion", period)
          .or("csat_cs_promedio.not.is.null,csat_onb_promedio.not.is.null"),
      );
      return rows.map((r) => {
        const onb = normalizeCsat(r.csat_onb_promedio);
        const cs = normalizeCsat(r.csat_cs_promedio);
        const onbN = Number(r.csat_onb_n ?? 0);
        const csN = Number(r.csat_cs_n ?? 0);
        // Promedio ponderado por respuestas
        const totalN = onbN + csN;
        let avg: number | null = null;
        if (totalN > 0) {
          const sum = (onb ?? 0) * onbN + (cs ?? 0) * csN;
          avg = sum / totalN;
        } else if (onb != null || cs != null) {
          const vals = [onb, cs].filter((v): v is number => v != null);
          avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
        return { ...r, onb, cs, onbN, csN, totalN, avg };
      });
    },
    enabled: Boolean(period),
    staleTime: 60_000,
  });
}

const nfmt = (n: number) => n.toLocaleString("es-AR");

type SortKey = "avg" | "onb" | "cs" | "totalN" | "nombre";

function CsatPage() {
  const { selectedPeriod } = usePeriod();
  const { data, isLoading, error } = useCsat(selectedPeriod);

  const [q, setQ] = useState("");
  const [pais, setPais] = useState<string>("");
  const [tipo, setTipo] = useState<"" | "onb" | "cs">("");
  const [maxScore, setMaxScore] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const paises = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map((r) => r.pais ?? "—"))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const qs = q.trim().toLowerCase();
    const maxS = Number(maxScore) || 0;
    let rows = data.filter((r) => {
      if (pais && (r.pais ?? "—") !== pais) return false;
      if (tipo === "onb" && r.onb == null) return false;
      if (tipo === "cs" && r.cs == null) return false;
      if (maxS > 0 && (r.avg ?? 99) > maxS) return false;
      if (qs) {
        const hay = `${r.nombre ?? ""} ${r.id_cuenta_dash ?? ""} ${r.ejecutivo ?? ""}`.toLowerCase();
        if (!hay.includes(qs)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const safe = (v: number | null) => (v == null ? (sortDir === "asc" ? 999 : -999) : v);
      switch (sortKey) {
        case "avg": return (safe(a.avg) - safe(b.avg)) * dir;
        case "onb": return (safe(a.onb) - safe(b.onb)) * dir;
        case "cs": return (safe(a.cs) - safe(b.cs)) * dir;
        case "totalN": return (a.totalN - b.totalN) * dir;
        case "nombre": return (a.nombre ?? "").localeCompare(b.nombre ?? "") * dir;
      }
    });
    return rows;
  }, [data, q, pais, tipo, maxScore, sortKey, sortDir]);

  // KPIs globales (sobre filtrado)
  const kpis = useMemo(() => {
    if (filtered.length === 0) return { total: 0, avgGlobal: 0, avgOnb: 0, avgCs: 0, nResp: 0, bajo3: 0 };
    let sum = 0, n = 0;
    let sumOnb = 0, nOnb = 0, sumCs = 0, nCs = 0;
    let bajo3 = 0;
    for (const r of filtered) {
      if (r.onb != null) { sumOnb += r.onb * r.onbN; nOnb += r.onbN; }
      if (r.cs != null) { sumCs += r.cs * r.csN; nCs += r.csN; }
      if (r.avg != null) { sum += r.avg; n++; if (r.avg < 3) bajo3++; }
    }
    return {
      total: filtered.length,
      avgGlobal: n ? sum / n : 0,
      avgOnb: nOnb ? sumOnb / nOnb : 0,
      avgCs: nCs ? sumCs / nCs : 0,
      nResp: nOnb + nCs,
      bajo3,
    };
  }, [filtered]);

  // Distribución por score (buckets 1-5)
  const dist = useMemo(() => {
    const buckets = [
      { label: "1.0–1.9", min: 1, max: 1.99, n: 0, color: "var(--red)" },
      { label: "2.0–2.9", min: 2, max: 2.99, n: 0, color: "#D96F3D" },
      { label: "3.0–3.9", min: 3, max: 3.99, n: 0, color: "var(--amber)" },
      { label: "4.0–4.4", min: 4, max: 4.49, n: 0, color: "#7AAF6F" },
      { label: "4.5–5.0", min: 4.5, max: 5, n: 0, color: "#2F7D4F" },
    ];
    for (const r of filtered) {
      if (r.avg == null) continue;
      const b = buckets.find((x) => r.avg! >= x.min && r.avg! <= x.max);
      if (b) b.n++;
    }
    return buckets;
  }, [filtered]);

  // CSAT por país
  const porPais = useMemo(() => {
    const map = new Map<string, { sum: number; n: number; bajo: number }>();
    for (const r of filtered) {
      if (r.avg == null) continue;
      const p = r.pais ?? "—";
      const s = map.get(p) ?? { sum: 0, n: 0, bajo: 0 };
      s.sum += r.avg; s.n++;
      if (r.avg < 3.5) s.bajo++;
      map.set(p, s);
    }
    return Array.from(map.entries())
      .map(([pais, s]) => ({ pais, avg: s.sum / s.n, n: s.n, bajo: s.bajo, pctBajo: (s.bajo / s.n) * 100 }))
      .filter((x) => x.n >= 5)
      .sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "totalN" ? "desc" : "asc"); }
    setPage(0);
  };

  const exportRows = filtered.map((r) => ({
    id: r.id_cuenta_dash,
    nombre: r.nombre,
    pais: r.pais,
    estado: r.estado_dash,
    ejecutivo: r.ejecutivo,
    plan: r.plan,
    csat_onb: r.onb,
    csat_onb_n: r.onbN,
    csat_cs: r.cs,
    csat_cs_n: r.csN,
    csat_promedio: r.avg != null ? Number(r.avg.toFixed(2)) : null,
    csat_periodo: r.csat_periodo,
  }));

  return (
    <Layout actions={<ExportButton filename="csat.xlsx" sheets={[
      { name: "CSAT cuentas", rows: exportRows },
      { name: "CSAT por país", rows: porPais.map((p) => ({ pais: p.pais, csat_promedio: Number(p.avg.toFixed(2)), n_cuentas: p.n, cuentas_bajo_35: p.bajo })) },
    ]} />}>
      {!selectedPeriod ? (
        <div className="card" style={{ padding: 20 }}>Seleccioná un período para ver CSAT.</div>
      ) : isLoading ? (
        <div className="card" style={{ padding: 20 }}>Cargando CSAT…</div>
      ) : error ? (
        <div className="card" style={{ padding: 20, color: "var(--red)" }}>Error: {(error as Error).message}</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="bento cols-4" style={{ marginBottom: 16 }}>
            <KpiCard label="CSAT promedio" value={kpis.avgGlobal.toFixed(2)} sub={`${nfmt(kpis.total)} cuentas con CSAT`} tone="orange" />
            <KpiCard label="CSAT Onboarding" value={kpis.avgOnb.toFixed(2)} sub="ponderado por respuestas" />
            <KpiCard label="CSAT Customer Success" value={kpis.avgCs.toFixed(2)} sub="ponderado por respuestas" />
            <KpiCard label="Cuentas < 3.0" value={nfmt(kpis.bajo3)} sub={`${kpis.total ? ((kpis.bajo3 / kpis.total) * 100).toFixed(1) : "0"}% del total`} tone="red" />
          </div>

          {/* Distribución + país */}
          <div className="bento cols-2" style={{ marginBottom: 16 }}>
            <div className="card lg">
              <div className="card-eyebrow">Distribución por score</div>
              <div className="card-title" style={{ marginBottom: 12 }}>{nfmt(filtered.filter((r) => r.avg != null).length)} cuentas</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={dist} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#E8E6DC" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />
                    <Bar dataKey="n" radius={[6, 6, 0, 0]} barSize={48}>
                      {dist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card cream lg">
              <div className="card-eyebrow">CSAT por país</div>
              <div className="card-title" style={{ marginBottom: 12 }}>{porPais.length} países con n ≥ 5</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {porPais.length === 0 ? (
                  <div className="muted fs-12">Sin segmentación por país (n &lt; 5)</div>
                ) : porPais.map((p) => (
                  <div key={p.pais} style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <span style={{ color: "var(--ink-2)" }}>{p.pais}</span>
                    <div style={{ position: "relative", height: 8, background: "var(--paper-2)", borderRadius: 99 }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: `${(p.avg / 5) * 100}%`,
                        background: p.avg >= 4 ? "#2F7D4F" : p.avg >= 3.5 ? "var(--amber)" : "var(--red)",
                        borderRadius: 99,
                      }} />
                    </div>
                    <span className="mono" style={{ textAlign: "right" }}>
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>{p.avg.toFixed(2)}</span>
                      <span className="muted" style={{ marginLeft: 4, fontSize: 10 }}>n={p.n}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: 14, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Buscar cuenta, ID o ejecutivo…" style={inputStyle} />
            <select value={pais} onChange={(e) => { setPais(e.target.value); setPage(0); }} style={inputStyle}>
              <option value="">Todos los países</option>
              {paises.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value as any); setPage(0); }} style={inputStyle}>
              <option value="">Todos los tipos</option>
              <option value="onb">Solo con Onboarding</option>
              <option value="cs">Solo con Customer Success</option>
            </select>
            <input
              type="number" step="0.1" min="1" max="5"
              value={maxScore}
              onChange={(e) => { setMaxScore(e.target.value); setPage(0); }}
              placeholder="CSAT máximo"
              style={{ ...inputStyle, width: 140 }}
            />
            <span className="muted fs-12" style={{ marginLeft: "auto" }}>{nfmt(filtered.length)} resultados</span>
          </div>

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--paper-2)", textAlign: "left" }}>
                    <Th onClick={() => toggleSort("nombre")} active={sortKey === "nombre"} dir={sortDir}>Cuenta</Th>
                    <Th>País</Th>
                    <Th>Estado</Th>
                    <Th>Ejecutivo</Th>
                    <Th onClick={() => toggleSort("onb")} active={sortKey === "onb"} dir={sortDir} align="right">CSAT Onb</Th>
                    <Th onClick={() => toggleSort("cs")} active={sortKey === "cs"} dir={sortDir} align="right">CSAT CS</Th>
                    <Th onClick={() => toggleSort("avg")} active={sortKey === "avg"} dir={sortDir} align="right">Promedio</Th>
                    <Th onClick={() => toggleSort("totalN")} active={sortKey === "totalN"} dir={sortDir} align="right">N total</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>Sin resultados</td></tr>
                  ) : pageRows.map((r) => (
                    <tr key={r.id_cuenta_dash ?? r.nombre} style={{ borderTop: "1px solid var(--rule)" }}>
                      <td style={tdStyle}>
                        <div className="strong" style={{ color: "var(--ink)" }}>{r.nombre ?? "—"}</div>
                        <div className="muted fs-11">#{r.id_cuenta_dash ?? "—"} · {r.plan ?? "—"}</div>
                      </td>
                      <td style={tdStyle}>{r.pais ?? "—"}</td>
                      <td style={tdStyle}>
                        <span className={`tag tier-${r.estado_dash === "Activo" ? "Healthy" : "AtRisk"}`}>{r.estado_dash ?? "—"}</span>
                      </td>
                      <td style={tdStyle}>{r.ejecutivo ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {r.onb != null ? (
                          <>
                            <span style={{ color: scoreColor(r.onb), fontWeight: 500 }}>{r.onb.toFixed(2)}</span>
                            <span className="muted fs-11" style={{ marginLeft: 4 }}>n={r.onbN}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {r.cs != null ? (
                          <>
                            <span style={{ color: scoreColor(r.cs), fontWeight: 500 }}>{r.cs.toFixed(2)}</span>
                            <span className="muted fs-11" style={{ marginLeft: 4 }}>n={r.csN}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: r.avg != null ? scoreColor(r.avg) : "var(--ink-3)" }}>
                        {r.avg != null ? r.avg.toFixed(2) : "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{nfmt(r.totalN)}</td>
                    </tr>
                  ))}
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
          </div>
        </>
      )}
    </Layout>
  );
}

function scoreColor(v: number): string {
  if (v >= 4.5) return "#2F7D4F";
  if (v >= 4) return "#7AAF6F";
  if (v >= 3.5) return "var(--amber)";
  if (v >= 3) return "#D96F3D";
  return "var(--red)";
}

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

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "orange" | "red" }) {
  const bg = tone === "orange" ? "var(--orange)" : tone === "red" ? "rgba(179,38,30,0.06)" : "var(--card)";
  const color = tone === "orange" ? "white" : "var(--ink)";
  return (
    <div className="card" style={{ padding: 16, background: bg, color }}>
      <div className="card-eyebrow" style={{ color: tone === "orange" ? "rgba(255,255,255,0.85)" : undefined }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 6 }}>{value}</div>
      {sub && <div className="fs-11" style={{ marginTop: 4, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}
