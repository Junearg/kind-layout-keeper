import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePeriod } from "@/contexts/PeriodContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

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

export function CsatSection() {
  const { selectedPeriod } = usePeriod();
  const { data, isLoading, error } = useCsat(selectedPeriod);
  const [pais, setPais] = useState<string>("");

  const paises = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map((r) => r.pais ?? "—"))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return pais ? data.filter((r) => (r.pais ?? "—") === pais) : data;
  }, [data, pais]);

  const kpis = useMemo(() => {
    if (filtered.length === 0) return { total: 0, avgGlobal: 0, avgOnb: 0, avgCs: 0, nResp: 0, bajo3: 0 };
    let sum = 0, n = 0, sumOnb = 0, nOnb = 0, sumCs = 0, nCs = 0, bajo3 = 0;
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

  if (!selectedPeriod) return <div className="card" style={{ padding: 20 }}>Seleccioná un período para ver CSAT.</div>;
  if (isLoading) return <div className="card" style={{ padding: 20 }}>Cargando CSAT…</div>;
  if (error) return <div className="card" style={{ padding: 20, color: "var(--red)" }}>Error: {(error as Error).message}</div>;

  return (
    <>
      <div className="bento cols-4" style={{ marginBottom: 16 }}>
        <CsatKpi label="CSAT promedio" value={kpis.avgGlobal.toFixed(2)} sub={`${nfmt(kpis.total)} cuentas con CSAT`} tone="orange" />
        <CsatKpi label="CSAT Onboarding" value={kpis.avgOnb.toFixed(2)} sub="ponderado por respuestas" />
        <CsatKpi label="CSAT Customer Success" value={kpis.avgCs.toFixed(2)} sub="ponderado por respuestas" />
        <CsatKpi label="Cuentas < 3.0" value={nfmt(kpis.bajo3)} sub={`${kpis.total ? ((kpis.bajo3 / kpis.total) * 100).toFixed(1) : "0"}% del total`} tone="red" />
      </div>

      {paises.length > 1 && (
        <div className="card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <span className="muted fs-12">Filtrar país:</span>
          <select value={pais} onChange={(e) => setPais(e.target.value)} style={{
            padding: "6px 10px", borderRadius: 8, border: "1px solid var(--rule-2)",
            background: "var(--paper)", fontSize: 12.5, color: "var(--ink)", fontFamily: "inherit", outline: "none",
          }}>
            <option value="">Todos los países</option>
            {paises.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

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
    </>
  );
}

function CsatKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "orange" | "red" }) {
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
