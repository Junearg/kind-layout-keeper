import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { churnTrend, motivosBaja, ORANGE } from "@/data/mockData";
import {
  ResponsiveContainer, ComposedChart, Bar, Area, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
  PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/tendencia")({
  head: () => ({ meta: [{ title: "Tendencia · Churn Hub" }] }),
  component: Tendencia,
});

function exportEmptyCsv() {
  const headers = ["dash_id", "pais", "plan", "fecha_baja", "responsable_asignacion"];
  const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cuentas_sin_motivo.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Tendencia() {
  const sinMotivo = motivosBaja[0];

  return (
    <Layout actions={
      <ExportButton
        filename="tendencia-churn.xlsx"
        sheets={[
          { name: "Tendencia mensual", rows: churnTrend },
          { name: "Motivos de baja", rows: motivosBaja },
        ]}
      />
    }>
      {/* Fila 1 — KPIs */}
      <div className="bento cols-3" style={{ marginBottom: 20 }}>
        <div className="card lg">
          <div className="card-eyebrow">YTD acumulado</div>
          <div className="bignum" style={{ marginTop: 10 }}>5,860</div>
          <div className="fs-12 muted" style={{ marginTop: 8 }}>bajas Dic→Abr · 5 meses</div>
          <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
            <span className="tag outline">Dic 1,008</span>
            <span className="tag outline">→</span>
            <span className="tag orange">Abr 1,446</span>
          </div>
        </div>

        <div className="card orange lg">
          <div className="card-eyebrow">Proyección Mayo</div>
          <div className="bignum" style={{ marginTop: 10 }}>1,634</div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
            +13.0% vs Abr · forecast lineal
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="callout" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
              ↑ tendencia sostenida
            </span>
          </div>
          <div className="bubble-wrap"><div className="bubble" /></div>
        </div>

        <div className="card ink lg">
          <div className="card-eyebrow">H1 2026 estimado</div>
          <div className="bignum" style={{ marginTop: 10 }}>&gt;9,000</div>
          <div className="fs-12" style={{ color: "rgba(255,255,255,0.55)", marginTop: 8 }}>
            si no se interviene · base actual
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="callout" style={{ background: "rgba(255,255,255,0.12)", color: "white" }}>
              riesgo proyectado
            </span>
          </div>
        </div>
      </div>

      {/* Fila 2 — Chart grande */}
      <div className="card lg">
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Bajas mensuales + proyección</div>
            <div className="card-title">De 1,008 a 1,846 en 7 meses</div>
          </div>
          <span className="callout orange">↑ +83% en 7 meses</span>
        </div>
        <div className="chart-wrap" style={{ height: 360, position: "relative" }}>
          <ResponsiveContainer>
            <ComposedChart data={churnTrend} margin={{ top: 36, right: 24, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }} />
              <ReferenceArea x1="May*" x2="Jun*" fill="#0B0B0A" fillOpacity={0.04} label={{ value: "Forecast", position: "insideTop", fill: "#6E6D66", fontSize: 11 }} />
              <Area type="monotone" dataKey="bajas" stroke="none" fill="url(#areaFill)" />
              <Bar dataKey="bajas" radius={[6, 6, 0, 0]} barSize={42}>
                {churnTrend.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.proyectado ? "#FFB089" : ORANGE}
                    fillOpacity={d.proyectado ? 0.7 : 1}
                  />
                ))}
                <LabelList
                  dataKey="bajas"
                  position="top"
                  style={{ fontSize: 11, fill: "#0B0B0A", fontWeight: 500 }}
                  formatter={(v: any) => Number(v).toLocaleString()}
                />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", top: 22, left: "52%", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
            <span className="callout orange">Pico · 1,446 en Abr</span>
            <div style={{ width: 1, height: 28, background: ORANGE, opacity: 0.5, marginTop: 4 }} />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="divider">
        <span className="kicker">Motivos</span>
        <span className="alt">· de baja</span>
        <span className="sub">brecha de atribución 52.1%</span>
        <span className="rule" />
      </div>

      {/* Fila 3 — Donut + Tabla */}
      <div className="bento equal-2">
        {/* Donut */}
        <div className="card lg">
          <div className="card-eyebrow">Distribución de motivos</div>
          <div className="card-title" style={{ marginBottom: 12 }}>5,852 bajas categorizadas</div>
          <div className="chart-wrap" style={{ height: 320, position: "relative", background: "white" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={motivosBaja}
                  dataKey="n"
                  nameKey="motivo"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={1}
                  stroke="white"
                  strokeWidth={2}
                >
                  {motivosBaja.map((m, i) => (
                    <Cell key={i} fill={m.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DC" }}
                  formatter={(v: any, _n: any, p: any) => [`${Number(v).toLocaleString()} · ${p?.payload?.pct}%`, p?.payload?.motivo]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 32, color: "#DC2626", lineHeight: 1, letterSpacing: "-0.03em" }}>52.1%</div>
              <div className="serif" style={{ fontSize: 16, color: "#DC2626", marginTop: 4 }}>sin motivo</div>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {motivosBaja.map((m) => (
              <div key={m.motivo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span className="tier-dot" style={{ background: m.color }} />
                <span style={{ flex: 1, color: m.brecha ? "#DC2626" : "var(--ink-2)", fontWeight: m.brecha ? 500 : 400 }}>{m.motivo}</span>
                <span className="mono muted">{m.n.toLocaleString()}</span>
                <span className="mono" style={{ color: m.brecha ? "#DC2626" : "var(--ink-3)", width: 42, textAlign: "right" }}>{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="card lg">
          <div className="card-eyebrow">Detalle por motivo</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Atribución y prioridad</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Motivo</th>
                <th style={{ textAlign: "right" }}>n</th>
                <th style={{ textAlign: "right" }}>%</th>
                <th>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {motivosBaja.map((m) => {
                const prioTag =
                  m.prioridad === "CRÍTICA" ? "red" :
                  m.prioridad === "ALTA" ? "orange" :
                  m.prioridad === "Media" ? "amber" : "blue";
                return (
                  <tr key={m.motivo} className={m.brecha ? "row-alert" : ""}>
                    <td className="strong" style={{ color: m.brecha ? "#DC2626" : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="tier-dot" style={{ background: m.color }} />
                        {m.motivo}
                        {m.brecha && <span className="tag red" style={{ marginLeft: 4 }}>BRECHA CRÍTICA</span>}
                      </div>
                    </td>
                    <td className="mono strong" style={{ textAlign: "right" }}>{m.n.toLocaleString()}</td>
                    <td className="mono" style={{ textAlign: "right", color: m.brecha ? "#DC2626" : undefined }}>{m.pct}%</td>
                    <td><span className={`tag ${prioTag}`}>{m.prioridad}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div className="fs-12 muted">
              {sinMotivo.n.toLocaleString()} cuentas dadas de baja sin razón registrada.
            </div>
            <button className="btn" onClick={exportEmptyCsv}>
              Exportar {sinMotivo.n.toLocaleString()} cuentas sin motivo →
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
