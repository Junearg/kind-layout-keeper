import { useMemo, useState } from "react";
import {
  useFeedback, useFeedbackMeses,
  categorizarFeedback, FEEDBACK_CAT_COLORS, FEEDBACK_CATS,
  type FeedbackRow,
} from "@/data/supabase-feedback";
import { useChurnedAccountsData } from "./ChurnedSection";

const EMPTY_CHURNED_ROWS: { id_cuenta_dash: number | null }[] = [];

const nfmt = (n: number) => n.toLocaleString("es-AR");

function formatMes(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${names[m! - 1]} ${y}`;
}

const PAGE_SIZE = 10;

type DonutSlice = { name: string; value: number; color: string };

function SvgDonut({ data, total, activeCat, onCat }: { data: DonutSlice[]; total: number; activeCat: string; onCat: (c: string) => void }) {
  const SIZE = 140, CX = 70, CY = 70, R_OUT = 64, R_IN = 42;
  let cumPct = 0;
  const GAP_DEG = 2;
  const slices = data.map(d => {
    const pct = total > 0 ? d.value / total : 0;
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
      <svg width={SIZE} height={SIZE} style={{ cursor: "pointer" }}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={arcPath(s.start, s.end)}
            fill={s.color}
            opacity={activeCat && activeCat !== s.name ? 0.25 : 1}
            onClick={() => onCat(activeCat === s.name ? "" : s.name)}
            style={{ cursor: "pointer", transition: "opacity .15s" }}
          />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 9, color: "var(--ink-4)" }}>feedbacks</div>
      </div>
    </div>
  );
}

export function FeedbackSection() {
  const { data: meses = [] } = useFeedbackMeses();
  const [mes, setMes] = useState("");
  const activeMes = mes || meses[0] || "";

  const { data: churnedRows = EMPTY_CHURNED_ROWS } = useChurnedAccountsData(activeMes);
  const churnedIds = useMemo(
    () => new Set(churnedRows.map(r => r.id_cuenta_dash).filter((x): x is number => x != null)),
    [churnedRows]
  );

  const { data: allRows = [], isLoading } = useFeedback(activeMes);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [activeAutor, setActiveAutor] = useState("");

  const handleCat = (cat: string) => { setActiveCat(cat); setPage(0); };
  const handleAutor = (a: string) => { setActiveAutor(a); setPage(0); };

  const { matched, unmatched } = useMemo(() => {
    const matched: FeedbackRow[] = [];
    const unmatched: FeedbackRow[] = [];
    for (const r of allRows) {
      if (r.id_cuenta && churnedIds.has(r.id_cuenta)) matched.push(r);
      else unmatched.push(r);
    }
    return { matched, unmatched };
  }, [allRows, churnedIds]);

  // Lista de autores únicos para el filtro
  const autores = useMemo(() => {
    const s = new Set(unmatched.map(r => r.autor).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [unmatched]);

  const filtered = useMemo(() => {
    let rows = unmatched;
    if (activeCat) rows = rows.filter(r => categorizarFeedback(r.feedback) === activeCat);
    if (activeAutor) rows = rows.filter(r => r.autor === activeAutor);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.negocio.toLowerCase().includes(q) || r.feedback.toLowerCase().includes(q));
    }
    return rows;
  }, [unmatched, activeCat, activeAutor, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const chartData = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const r of allRows) {
      const cat = categorizarFeedback(r.feedback);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return FEEDBACK_CATS
      .map(cat => ({ name: cat, value: counts[cat] ?? 0, color: FEEDBACK_CAT_COLORS[cat] }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [allRows]);

  const totalFeedbacks = allRows.length;
  const hasFilters = activeCat || activeAutor || search;

  if (meses.length === 0 && !isLoading) {
    return (
      <div className="card" style={{ padding: "20px 24px", color: "var(--ink-3)", fontSize: 13 }}>
        No hay feedbacks cargados aún.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Selector de mes */}
      <div className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={activeMes}
          onChange={e => { setMes(e.target.value); setPage(0); setActiveCat(""); setActiveAutor(""); setSearch(""); }}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 12.5, color: "var(--ink)", fontFamily: "inherit", outline: "none" }}
        >
          {meses.map(m => <option key={m} value={m}>{formatMes(m)}</option>)}
        </select>
        <span className="muted fs-12" style={{ marginLeft: "auto" }}>
          {nfmt(totalFeedbacks)} feedbacks · {nfmt(matched.length)} cruzados con churn · {nfmt(unmatched.length)} sin cruce
        </span>
      </div>

      {/* Gráfico + filtros de categoría */}
      {chartData.length > 0 && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--ink-3)", marginBottom: 14 }}>
            Distribución de feedbacks por categoría · {nfmt(totalFeedbacks)} total
          </div>
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            <SvgDonut data={chartData} total={totalFeedbacks} activeCat={activeCat} onCat={handleCat} />
            <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 7 }}>
              {chartData.map(d => {
                const isActive = activeCat === d.name;
                const isOther = activeCat && !isActive;
                return (
                  <div
                    key={d.name}
                    onClick={() => handleCat(isActive ? "" : d.name)}
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: isOther ? 0.35 : 1, transition: "opacity .15s", borderRadius: 6, padding: "2px 4px", background: isActive ? `${d.color}12` : "transparent" }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--ink-2)", width: 200, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <div style={{ flex: 1, background: "var(--rule)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${(d.value / (chartData[0]?.value || 1)) * 100}%`, background: d.color, height: "100%", borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.color, width: 28, textAlign: "right", flexShrink: 0 }}>{d.value}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-4)", width: 36, textAlign: "right", flexShrink: 0 }}>
                      {totalFeedbacks > 0 ? `${Math.round((d.value / totalFeedbacks) * 100)}%` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Fila superior: título + buscador */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              Feedbacks sin cruce con churn
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)", marginLeft: 8 }}>{nfmt(unmatched.length)} en total</span>
            </span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar negocio o feedback…"
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontSize: 12, color: "var(--ink)", fontFamily: "inherit", outline: "none", width: 240 }}
            />
          </div>

          {/* Fila de filtros */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {/* Filtro por ejecutivo */}
            <select
              value={activeAutor}
              onChange={e => handleAutor(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${activeAutor ? "var(--accent)" : "var(--rule-2)"}`, background: activeAutor ? "var(--accent-subtle, #f0f4ff)" : "var(--paper)", fontSize: 12, color: activeAutor ? "var(--accent)" : "var(--ink-3)", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
            >
              <option value="">Todos los ejecutivos</option>
              {autores.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            {/* Chips de categoría activa */}
            {activeCat && (
              <span
                onClick={() => handleCat("")}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: `${FEEDBACK_CAT_COLORS[activeCat as keyof typeof FEEDBACK_CAT_COLORS]}20`, color: FEEDBACK_CAT_COLORS[activeCat as keyof typeof FEEDBACK_CAT_COLORS], fontSize: 11.5, fontWeight: 500, cursor: "pointer", border: `1px solid ${FEEDBACK_CAT_COLORS[activeCat as keyof typeof FEEDBACK_CAT_COLORS]}50` }}
              >
                {activeCat} ×
              </span>
            )}

            {/* Resultado filtrado */}
            {hasFilters && (
              <span style={{ fontSize: 11.5, color: "var(--ink-3)", marginLeft: 4 }}>
                {nfmt(filtered.length)} resultado{filtered.length !== 1 ? "s" : ""}
              </span>
            )}

            {/* Limpiar filtros */}
            {hasFilters && (
              <button
                onClick={() => { setActiveCat(""); setActiveAutor(""); setSearch(""); setPage(0); }}
                style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "transparent", fontSize: 11.5, color: "var(--ink-3)", cursor: "pointer", fontFamily: "inherit" }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 20, color: "var(--ink-3)", fontSize: 13 }}>Cargando feedbacks…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            {unmatched.length === 0 ? "Todos los feedbacks del mes están cruzados con cuentas churneadas." : "Sin resultados para los filtros aplicados."}
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--paper-2)" }}>
                  {["Negocio", "Ejecutivo", "Feedback", "Categoría"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  const cat = categorizarFeedback(r.feedback);
                  const color = FEEDBACK_CAT_COLORS[cat];
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--rule)" }}>
                      <td style={{ padding: "10px 14px", verticalAlign: "top", minWidth: 140 }}>
                        {r.negocio && r.negocio !== "EMPTY"
                          ? <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 12.5 }}>{r.negocio}</div>
                          : <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic" }}>Sin identificar</div>
                        }
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "top", minWidth: 110 }}>
                        {r.autor && (
                          <span
                            onClick={() => handleAutor(activeAutor === r.autor ? "" : r.autor!)}
                            style={{ fontSize: 11.5, color: activeAutor === r.autor ? "var(--accent)" : "var(--ink-4)", cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            {r.autor}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "top", color: "var(--ink-2)", lineHeight: 1.5 }}>
                        {r.feedback}
                      </td>
                      <td style={{ padding: "10px 14px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                        <span
                          onClick={() => handleCat(activeCat === cat ? "" : cat)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, background: `${color}18`, color, fontSize: 11, fontWeight: 500, cursor: "pointer", border: activeCat === cat ? `1px solid ${color}` : "1px solid transparent" }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          {cat}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: "1px solid var(--rule)" }}>
                <span className="muted fs-12">Página {page + 1} de {pages} · {nfmt(filtered.length)} resultados</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Anterior</button>
                  <button className="btn ghost" disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>Siguiente →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
