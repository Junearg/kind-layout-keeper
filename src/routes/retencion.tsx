import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  listFechasDiarias,
  useKpiSnapshotMultipais,
  type KpiDiario,
} from "@/data/supabase-kpis-diarios";
import { useSheetsDashboard } from "@/data/google-sheets";

// ── Panel de MPCs de referencia ───────────────────────────────────────────────
type MpcRow = { id: string; mes: string; pais: string; mpcs: number; nota: string | null };

function MpcReferenciaPanel() {
  const qc = useQueryClient();
  const [newMes, setNewMes] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newPais, setNewPais]   = useState("Región");
  const [newMpcs, setNewMpcs]   = useState("");
  const [newNota, setNewNota]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  const { data: rows, isLoading } = useQuery<MpcRow[]>({
    queryKey: ["mpc_referencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mpc_referencia").select("*").order("mes", { ascending: false });
      if (error) throw error;
      return data as MpcRow[];
    },
    staleTime: 30_000,
  });

  async function save() {
    if (!newMes || !newMpcs) return;
    setSaving(true); setMsg("");
    const { error } = await supabase.from("mpc_referencia").upsert(
      { mes: newMes, pais: newPais, mpcs: Number(newMpcs), nota: newNota || null },
      { onConflict: "mes,pais" }
    );
    setSaving(false);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg(`✓ Guardado: ${newMes} · ${newPais} = ${Number(newMpcs).toLocaleString("es-AR")}`);
    setNewMpcs(""); setNewNota("");
    qc.invalidateQueries({ queryKey: ["mpc_referencia"] });
    qc.invalidateQueries({ queryKey: ["kpi-snapshot-multipais"] });
    qc.invalidateQueries({ queryKey: ["kpi-dia"] });
  }

  async function del(id: string) {
    await supabase.from("mpc_referencia").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mpc_referencia"] });
  }

  const PAISES = ["Región","Argentina","Chile","México","Colombia","Brasil","Others"];

  return (
    <details style={{ marginBottom: 16 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", padding: "10px 0", display: "flex", alignItems: "center", gap: 8 }}>
        ⚙ MPCs de referencia oficial
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)" }}>
          — valores del GSheet usados como denominador de % Retención y Churn
        </span>
      </summary>

      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        {/* Form */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="fs-11 muted">Mes (YYYY-MM)</span>
            <input type="month" value={newMes} onChange={e => setNewMes(e.target.value)}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--rule)", fontFamily: "inherit" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="fs-11 muted">País</span>
            <select value={newPais} onChange={e => setNewPais(e.target.value)}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--rule)", fontFamily: "inherit" }}>
              {PAISES.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="fs-11 muted">MPCs (activas al cierre)</span>
            <input type="number" value={newMpcs} onChange={e => setNewMpcs(e.target.value)}
              placeholder="ej: 32338"
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--rule)", width: 120, fontFamily: "inherit" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
            <span className="fs-11 muted">Nota (opcional)</span>
            <input type="text" value={newNota} onChange={e => setNewNota(e.target.value)}
              placeholder="ej: GSheet J23"
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--rule)", fontFamily: "inherit" }} />
          </label>
          <button onClick={save} disabled={saving || !newMpcs}
            style={{ padding: "6px 16px", borderRadius: 8, background: "var(--orange)", color: "white", border: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-end" }}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

        {msg && <div style={{ fontSize: 12, color: msg.startsWith("Error") ? "#DC2626" : "#16A34A", marginBottom: 12 }}>{msg}</div>}

        {/* Tabla */}
        {isLoading ? <div className="fs-12 muted">Cargando…</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--paper-2)" }}>
                {["Mes","País","MPCs","Nota",""].map(h => (
                  <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--rule)" }}>
                  <td style={{ padding: "7px 12px", fontFamily: "monospace" }}>{r.mes}</td>
                  <td style={{ padding: "7px 12px" }}>{r.pais}</td>
                  <td style={{ padding: "7px 12px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{r.mpcs.toLocaleString("es-AR")}</td>
                  <td style={{ padding: "7px 12px", color: "var(--ink-3)" }}>{r.nota ?? "—"}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <button onClick={() => del(r.id)} style={{ fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </td>
                </tr>
              ))}
              {!rows?.length && <tr><td colSpan={5} style={{ padding: 12, color: "var(--ink-3)", fontSize: 12 }}>Sin valores cargados</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

export const Route = createFileRoute("/retencion")({
  head: () => ({ meta: [{ title: "Retención · Churn Hub" }] }),
  component: RetencionPage,
});

const PAISES_COLS = ["Región", "Argentina", "Chile", "México", "Colombia", "Brasil"] as const;
const fmt  = (n: number) => n.toLocaleString("es-AR");
const pct  = (n: number | null | undefined) => n == null ? "—" : `${n.toFixed(1)}%`;
const pct2 = (n: number | null | undefined) => n == null ? "—" : `${n.toFixed(2)}%`;

type MetricaDef = {
  label: string;
  group?: string;
  get: (k: KpiDiario) => string;
  highlight?: (k: KpiDiario) => "red" | "green" | null;
};

const METRICAS: MetricaDef[] = [
  { label: "Activas",                    group: "Cuentas",      get: k => fmt(k.activas) },
  { label: "Pago Pendiente",                                    get: k => fmt(k.pagoPendiente),   highlight: k => k.pagoPendiente > k.activas * 0.2 ? "red" : null },
  { label: "Bajas Confirmadas",                                 get: k => fmt(k.bajas),           highlight: k => k.bajas > 100 ? "red" : null },
  { label: "Cuentas a Recuperar",                               get: k => fmt(k.aRecuperar) },
  { label: "  · Onboarding",                                   get: k => fmt(k.onboarding) },
  { label: "  · Engagement",                                   get: k => fmt(k.engagement) },
  { label: "C/ vtas últimos 7 días",     group: "Actividad",   get: k => fmt(k.activasConVentas) },
  { label: "S/ vtas últimos 7 días",                           get: k => fmt(k.sinVentas),       highlight: k => k.sinVentas > k.activas * 0.1 ? "red" : null },
  { label: "% Retenido",                                        get: k => pct(k.pctRetenido),     highlight: k => k.pctRetenido < 94 ? "red" : k.pctRetenido >= 97 ? "green" : null },
  { label: "Activas ≥10 ventas/mes",                            get: k => fmt(k.activasConVentas) },
  { label: "A Recuperar ≥10v/mes",                              get: k => fmt(k.recuperar10v) },
  { label: "% ≥10v mensual",                                    get: k => pct(k.pct10v),          highlight: k => k.pct10v < 50 ? "red" : null },
  { label: "% Retenido Activo ≥10v",                            get: k => pct(k.pctRetenido10v),  highlight: k => k.pctRetenido10v < 45 ? "red" : null },
  { label: "Login < 7 días (n)",                                get: k => fmt(k.loginMenos7) },
  { label: "% Login < 7 días",                                  get: k => pct(k.loginPct),        highlight: k => k.loginPct < 85 ? "red" : k.loginPct >= 95 ? "green" : null },
  { label: "MPCs mes pasado",            group: "Churn / Plan", get: k => fmt(k.mpcsMesPasado) },
  { label: "Churn Bruto Proyectado",                            get: k => pct2(k.churnBruto),     highlight: k => k.churnBruto > 7 ? "red" : k.churnBruto < 3 ? "green" : null },
  { label: "Churn Neto Proyectado",                             get: k => pct2(k.churnNeto),      highlight: k => k.churnNeto > 7 ? "red" : k.churnNeto < 3 ? "green" : null },
  { label: "Churn Plan",                                        get: k => pct(k.churnPlan) },
  { label: "Proyectado Neto vs Plan",                           get: k => k.proyectadoVsPlan == null ? "—" : `${k.proyectadoVsPlan >= 0 ? "+" : ""}${k.proyectadoVsPlan.toFixed(1)}%`, highlight: k => (k.proyectadoVsPlan ?? 0) > 50 ? "red" : (k.proyectadoVsPlan ?? 0) < -10 ? "green" : null },
  { label: "# Recuperar para on-target",                        get: k => k.nRecuperar == null ? "—" : fmt(k.nRecuperar) },
  { label: "MPCs Retenidos Proyectados",                        get: k => fmt(k.mpcsRetenidosProyectados) },
  { label: "MPCs vs Plan",                                      get: k => k.mpcsVsPlan == null ? "—" : `${k.mpcsVsPlan >= 0 ? "+" : ""}${k.mpcsVsPlan.toFixed(1)}%`, highlight: k => (k.mpcsVsPlan ?? 0) < -3 ? "red" : (k.mpcsVsPlan ?? 0) >= 0 ? "green" : null },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, sub, value, delta, deltaLabel, tone, large = false,
}: {
  label: string; sub?: string; value: string; delta?: number | null;
  deltaLabel?: string; tone?: "green" | "red" | "neutral"; large?: boolean;
}) {
  const mainColor = tone === "green" ? "#16A34A" : tone === "red" ? "#DC2626" : "var(--ink)";
  const deltaColor = delta == null ? "var(--ink-3)"
    : delta > 0 ? "#16A34A" : delta < 0 ? "#DC2626" : "var(--ink-3)";
  const deltaSign = delta == null ? "" : delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "= ";
  return (
    <div className="card" style={{ padding: "18px 22px", minWidth: 180, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-3)", marginBottom: 4 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 8 }}>{sub}</div>}
      <div style={{ fontSize: large ? 48 : 36, fontWeight: 800, lineHeight: 1, color: mainColor, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {delta != null && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>
            {deltaSign}{Math.abs(delta).toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{deltaLabel ?? "vs mes anterior"}</span>
        </div>
      )}
    </div>
  );
}

// ── Diagnóstico (colapsado por defecto) ───────────────────────────────────────
function DiagPanel({ fechaHoy }: { fechaHoy: string }) {
  const { data: debug } = useQuery({
    queryKey: ["debug-fecha-v2", fechaHoy],
    queryFn: async () => {
      if (!fechaHoy) return null;
      const PAGE = 1000;
      const allRows: { estado_dash: string|null; etapa: string|null; temas_contacto: string|null; motivos_contacto: string|null }[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from("clientes")
          .select("estado_dash,etapa,temas_contacto,motivos_contacto")
          .eq("mes_exportacion", fechaHoy).range(from, from + PAGE - 1);
        if (error) break;
        const batch = data ?? [];
        allRows.push(...batch as any);
        if (batch.length < PAGE) break;
      }
      const countBy = (field: keyof typeof allRows[0]) => {
        const map: Record<string, number> = {};
        for (const r of allRows) { const v = String(r[field] ?? "(null)"); map[v] = (map[v] ?? 0) + 1; }
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
      };
      return { total: allRows.length, estado_dash: countBy("estado_dash"), etapa: countBy("etapa"), temas_contacto: countBy("temas_contacto"), motivos_contacto: countBy("motivos_contacto") };
    },
    enabled: Boolean(fechaHoy), staleTime: 60_000,
  });
  if (!debug) return null;
  return (
    <details style={{ marginBottom: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--ink-4)", padding: "6px 0" }}>
        🔍 Diagnóstico · {debug.total} filas para {fechaHoy}{debug.total === 0 && " — ⚠️ SIN DATOS"}
      </summary>
      <div className="card" style={{ padding: 14, marginTop: 6, fontSize: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {[["estado_dash", debug.estado_dash],["etapa", debug.etapa],["temas_contacto", debug.temas_contacto],["motivos_contacto", debug.motivos_contacto]].map(([label, vals]: any) => (
          <div key={label}>
            <div style={{ fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>{label}</div>
            {vals.slice(0,6).map(([v, n]: any) => (
              <div key={v} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid var(--rule)" }}>
                <span style={{ color: "var(--ink-3)", fontFamily: "monospace", fontSize: 11 }}>{v}</span>
                <span style={{ fontWeight: 600 }}>{n}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function RetencionPage() {
  const { data: fechas, isLoading: fechasLoading } = useQuery({
    queryKey: ["fechas-diarias"],
    queryFn: listFechasDiarias,
    staleTime: 300_000,
  });
  const [fechaSel, setFechaSel] = useState<string>("");
  const [tablaAbierta, setTablaAbierta] = useState(false);

  const fechaHoy  = fechaSel || fechas?.[0] || "";

  // Referencia "mes anterior": último snapshot disponible del mes calendario anterior.
  // Si importaste el último día hábil de ese mes, ese queda como baseline automático.
  const { fechaAnt, mesPrevKey } = useMemo(() => {
    if (!fechas || !fechaHoy) return { fechaAnt: "", mesPrevKey: "" };
    const [y, m] = fechaHoy.split("-").map(Number);
    const py = m === 1 ? y! - 1 : y!;
    const pm = m === 1 ? 12 : m! - 1;
    const mesPrev = `${py}-${String(pm).padStart(2, "0")}`;
    // fechas está ordenado descendente → primer match es el más reciente del mes anterior
    const best = fechas.find(f => f.startsWith(mesPrev)) ?? "";
    return { fechaAnt: best, mesPrevKey: mesPrev };
  }, [fechas, fechaHoy]);

  const { data: kpis,     isLoading } = useKpiSnapshotMultipais(fechaHoy);
  const { data: kpisAnt               } = useKpiSnapshotMultipais(fechaAnt);
  const { data: sheets, isLoading: sheetsLoading } = useSheetsDashboard();

  const kpiMapRaw = useMemo(() => { const m = new Map<string, KpiDiario>(); if (kpis)    for (const k of kpis)    m.set(k.pais, k); return m; }, [kpis]);
  const kpiAntMap = useMemo(() => { const m = new Map<string, KpiDiario>(); if (kpisAnt) for (const k of kpisAnt) m.set(k.pais, k); return m; }, [kpisAnt]);

  // Merge GSheet encima de Supabase: GSheet tiene prioridad para los campos que trae
  const kpiMap = useMemo(() => {
    if (!sheets) return kpiMapRaw;
    const m = new Map<string, KpiDiario>();
    for (const [pais, k] of kpiMapRaw) {
      const gs = sheets.byCountry[pais];
      if (!gs) { m.set(pais, k); continue; }
      m.set(pais, {
        ...k,
        ...(gs.activas          != null && { activas: gs.activas }),
        ...(gs.bajasConfirmadas != null && { bajas: gs.bajasConfirmadas }),
        ...(gs.cuentasARecuperar != null && { aRecuperar: gs.cuentasARecuperar }),
        ...(gs.cvtasUltimos7d   != null && { activasConVentas: gs.cvtasUltimos7d }),
        ...(gs.svtasUltimos7d   != null && { sinVentas: gs.svtasUltimos7d }),
        ...(gs.pctRetenido      != null && { pctRetenido: gs.pctRetenido }),
        ...(gs.mpcsMesPasado    != null && { mpcsMesPasado: gs.mpcsMesPasado }),
        ...(gs.churnBruto       != null && { churnBruto: gs.churnBruto }),
        ...(gs.churnNeto        != null && { churnNeto: gs.churnNeto }),
        ...(gs.churnPlan        != null && { churnPlan: gs.churnPlan }),
        ...(gs.proyectadoVsPlan != null && { proyectadoVsPlan: gs.proyectadoVsPlan }),
        ...(gs.nRecuperar       != null && { nRecuperar: gs.nRecuperar }),
      });
    }
    return m;
  }, [kpiMapRaw, sheets]);

  const region    = kpiMap.get("Región");
  const regionAnt = kpiAntMap.get("Región");

  // GSheet "Región" — fuente viva para los KPI cards principales
  const gs = sheets?.byCountry?.["Región"];

  if (fechasLoading) return <Layout><div className="card" style={{ padding: 20 }}>Cargando…</div></Layout>;

  if (!fechas || fechas.length === 0) {
    return (
      <Layout>
        <div className="card" style={{ padding: 24, background: "#FFFBEB", border: "1px solid #FDE68A", maxWidth: 560 }}>
          <div className="card-eyebrow">Sin datos diarios</div>
          <div style={{ marginTop: 10, fontSize: 14, color: "#92400E", lineHeight: 1.6 }}>
            Importá el archivo diario desde <strong>/importar</strong> en modo <strong>Diario</strong>.
          </div>
        </div>
      </Layout>
    );
  }

  // Deltas para tarjetas
  const deltaRet     = region && regionAnt ? region.pctRetenido - regionAnt.pctRetenido : null;
  const deltaChurnB  = region && regionAnt ? region.churnBruto  - regionAnt.churnBruto  : null;
  const deltaChurnN  = region && regionAnt ? region.churnNeto   - regionAnt.churnNeto   : null;
  const deltaActivas = region && regionAnt ? ((region.activas - regionAnt.activas) / (regionAnt.activas || 1)) * 100 : null;

  const retTone = region == null ? undefined
    : region.pctRetenido >= 97 ? "green"
    : region.pctRetenido < 94  ? "red"
    : undefined;

  const antLabel = fechaAnt
    ? `vs ${fechaAnt} (último snapshot de ${mesPrevKey})`
    : `vs mes anterior`;

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1 className="serif" style={{ fontSize: 24, margin: 0 }}>
            Retención <span className="alt">/ snapshot diario</span>
          </h1>
          {fechaAnt && <span className="fs-11 muted">baseline: <strong>{fechaAnt}</strong></span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fs-12 muted">Fecha:</span>
          <select value={fechaHoy} onChange={e => setFechaSel(e.target.value)}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--paper)", fontFamily: "inherit", fontWeight: 500 }}>
            {fechas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* ── MPCs de referencia ── */}
      <MpcReferenciaPanel />


      {/* ── KPI Cards ── */}
      {(isLoading || sheetsLoading) ? (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="fs-12 muted">Calculando métricas…</div>
        </div>
      ) : (
        <>
          {sheets?.fecha && (
            <div style={{ marginBottom: 8, fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              GSheet · actualizado {sheets.fecha}
            </div>
          )}
          {(() => {
            const retVal  = gs?.pctRetenido        ?? region?.pctRetenido  ?? null;
            const churnB  = gs?.churnBruto         ?? region?.churnBruto   ?? null;
            const churnN  = gs?.churnNeto          ?? region?.churnNeto    ?? null;
            const activas = gs?.activas            ?? region?.activas      ?? null;
            const aRecup  = gs?.cuentasARecuperar  ?? region?.aRecuperar   ?? null;
            const mpcs    = gs?.mpcsMesPasado      ?? region?.mpcsMesPasado ?? null;
            const churnBColor = churnB == null ? "var(--ink)" : churnB > 7 ? "#DC2626" : churnB < 3 ? "#16A34A" : "var(--ink)";
            const churnNColor = churnN == null ? "var(--ink)" : churnN > 7 ? "#DC2626" : churnN < 3 ? "#16A34A" : "var(--ink)";
            return (
              <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                {/* % Retención — hero card */}
                <div className="card orange" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div className="card-eyebrow" style={{ fontSize: 11 }}>% Retención</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{sheets?.fecha ?? fechaHoy} · Región</div>
                    </div>
                    <span style={{ fontSize: 16, opacity: 0.6 }}>↗</span>
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                    {retVal != null ? pct(retVal) : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>
                    {activas != null && mpcs != null ? `${fmt(activas)} activas · base ${fmt(mpcs)}` : ""}
                  </div>
                  {deltaRet != null && (
                    <div style={{ marginTop: 10 }}>
                      <span className="callout" style={{ fontSize: 11 }}>
                        {deltaRet >= 0 ? "↑" : "↓"} {Math.abs(deltaRet).toFixed(1)}% vs {antLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Churn Bruto */}
                <div className="card" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
                  <div className="card-eyebrow" style={{ fontSize: 11 }}>Churn Bruto</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Proyectado</div>
                  <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em", color: churnBColor }}>
                    {churnB != null ? pct(churnB) : "—"}
                  </div>
                  {deltaChurnB != null && (
                    <div style={{ marginTop: 10 }}>
                      <span className="callout line" style={{ fontSize: 11 }}>
                        {deltaChurnB >= 0 ? "↑" : "↓"} {Math.abs(deltaChurnB).toFixed(1)}% vs {antLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Churn Neto */}
                <div className="card" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
                  <div className="card-eyebrow" style={{ fontSize: 11 }}>Churn Neto</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Proyectado</div>
                  <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em", color: churnNColor }}>
                    {churnN != null ? pct(churnN) : "—"}
                  </div>
                  {deltaChurnN != null && (
                    <div style={{ marginTop: 10 }}>
                      <span className="callout line" style={{ fontSize: 11 }}>
                        {deltaChurnN >= 0 ? "↑" : "↓"} {Math.abs(deltaChurnN).toFixed(1)}% vs {antLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Cuentas Activas */}
                <div className="card" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
                  <div className="card-eyebrow" style={{ fontSize: 11 }}>Cuentas Activas</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Estado Activo</div>
                  <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                    {activas != null ? fmt(activas) : "—"}
                  </div>
                  {deltaActivas != null && (
                    <div style={{ marginTop: 10 }}>
                      <span className="callout line" style={{ fontSize: 11 }}>
                        {deltaActivas >= 0 ? "↑ +" : "↓ "}{Math.abs(deltaActivas).toFixed(1)}% vs {antLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* A Recuperar */}
                <div className="card" style={{ width: 220, minHeight: 200, padding: "16px 20px", flexShrink: 0 }}>
                  <div className="card-eyebrow" style={{ fontSize: 11 }}>A Recuperar</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Engagement + Onboarding</div>
                  <div style={{ fontSize: 42, fontWeight: 700, marginTop: 8, lineHeight: 1, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em", color: "var(--orange)" }}>
                    {aRecup != null ? fmt(aRecup) : "—"}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── Tabla colapsable ── */}
      <div className="card lg" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header de la tabla con toggle */}
        <button
          onClick={() => setTablaAbierta(v => !v)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", textAlign: "left",
            borderBottom: tablaAbierta ? "1px solid var(--rule)" : "none",
          }}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Tabla detallada — todos los países</span>
            <span style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 10 }}>{METRICAS.length} métricas · {PAISES_COLS.length} países</span>
          </div>
          <span style={{ fontSize: 16, color: "var(--ink-3)", transition: "transform 0.2s", transform: tablaAbierta ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </button>

        {tablaAbierta && (
          isLoading ? (
            <div className="fs-12 muted" style={{ padding: 24 }}>Calculando métricas para todos los países…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: "14px 20px", textAlign: "left", fontWeight: 600, fontSize: 11,
                      color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.8,
                      minWidth: 220, position: "sticky", left: 0,
                      background: "var(--paper-2)",
                      borderBottom: "2px solid var(--rule-2)",
                      boxShadow: "2px 0 6px -2px rgba(0,0,0,0.08)",
                    }}>
                      Métrica
                    </th>
                    {PAISES_COLS.map(p => (
                      <th key={p} style={{
                        padding: "14px 18px", textAlign: "right",
                        fontSize: p === "Región" ? 13 : 12, fontWeight: p === "Región" ? 700 : 500,
                        color: p === "Región" ? "var(--orange)" : "var(--ink-2)",
                        minWidth: 110,
                        borderBottom: "2px solid var(--rule-2)",
                        borderLeft: p === "Región" ? "2px solid var(--orange)" : "1px solid var(--rule)",
                        background: p === "Región" ? "rgba(251,102,2,0.03)" : "var(--paper-2)",
                        letterSpacing: p === "Región" ? 0 : 0.2,
                      }}>
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICAS.map((m, i) => {
                    const prevGroup = i > 0 ? METRICAS[i - 1]?.group : undefined;
                    const showGroupHeader = m.group !== undefined && m.group !== prevGroup;
                    const isSub = m.label.startsWith("  ·");
                    const label = isSub ? m.label.replace("  ·", "") : m.label;
                    return (
                      <>
                        {showGroupHeader && (
                          <tr key={`grp-${m.group}`}>
                            <td colSpan={PAISES_COLS.length + 1} style={{
                              padding: "8px 20px 6px",
                              fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
                              color: "var(--ink-4)", fontWeight: 700,
                              background: "var(--paper-2)",
                              borderTop: i === 0 ? undefined : "2px solid var(--rule)",
                              borderBottom: "1px solid var(--rule)",
                            }}>
                              {m.group}
                            </td>
                          </tr>
                        )}
                        <tr key={m.label} style={{ borderTop: "1px solid var(--rule)" }}>
                          <td style={{
                            padding: isSub ? "8px 20px 8px 32px" : "10px 20px",
                            position: "sticky", left: 0,
                            background: "var(--paper)",
                            boxShadow: "2px 0 6px -2px rgba(0,0,0,0.06)",
                          }}>
                            {isSub ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 14, height: 1, background: "var(--rule-2)", flexShrink: 0 }} />
                                <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{label}</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>
                            )}
                          </td>
                          {PAISES_COLS.map(p => {
                            const k = kpiMap.get(p);
                            const val = k ? m.get(k) : "—";
                            const tone = k ? (m.highlight?.(k) ?? null) : null;
                            const isRegion = p === "Región";
                            return (
                              <td key={p} style={{
                                padding: "10px 18px", textAlign: "right",
                                fontVariantNumeric: "tabular-nums",
                                fontFamily: "'JetBrains Mono', monospace",
                                borderLeft: isRegion ? "2px solid var(--orange)" : "1px solid var(--rule)",
                                background: tone === "red"   ? "rgba(220,38,38,0.05)"
                                          : tone === "green" ? "rgba(22,163,74,0.05)"
                                          : isRegion         ? "rgba(251,102,2,0.02)"
                                          : undefined,
                              }}>
                                {tone ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "flex-end",
                                    gap: 5, fontSize: 12,
                                    color: tone === "red" ? "#DC2626" : "#16A34A",
                                    fontWeight: 700,
                                  }}>
                                    <span style={{
                                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                      background: tone === "red" ? "#DC2626" : "#16A34A",
                                    }} />
                                    {val}
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: isSub ? 12 : 12.5,
                                    color: "var(--ink-2)",
                                    fontWeight: isRegion ? 600 : 400,
                                  }}>
                                    {val}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <DiagPanel fechaHoy={fechaHoy} />

      <div className="fs-11 muted" style={{ marginTop: 12 }}>
        Importá cada día desde <strong>/importar</strong> en modo Diario para acumular historial.
      </div>
    </Layout>
  );
}
