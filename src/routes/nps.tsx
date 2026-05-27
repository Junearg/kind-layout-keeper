import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { ORANGE } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import { useDerived } from "@/data/derived";
import { useNpsMes, useMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ComposedChart, Line, LabelList,
} from "recharts";

export const Route = createFileRoute("/nps")({
  head: () => ({ meta: [{ title: "NPS & CSAT · Churn Hub" }] }),
  component: Nps,
});

const nfmt = (n: number) => Math.round(n).toLocaleString("es-AR");
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

function Nps() {
  const { npsPais, motivosDetraccion, motivosPromocion, csatMensual } = useDashboardData();
  const d = useDerived();
  const npsMes = useNpsMes();
  const mesActivo = useMesActivo();
  const npsTone =
    d.npsGlobal >= 50 ? { color: "var(--orange)", label: "zona saludable" } :
    d.npsGlobal >= 30 ? { color: "var(--amber)",  label: "zona vigilar"  } :
                        { color: "var(--red)",    label: "zona crítica"  };
    d.npsGlobal >= 50 ? { color: "var(--orange)", label: "zona saludable" } :
    d.npsGlobal >= 30 ? { color: "var(--amber)",  label: "zona vigilar"  } :
                        { color: "var(--red)",    label: "zona crítica"  };

  const paradoxText = d.costoEnAmbos
    ? `"${d.costoEnAmbos.motivo}" es motivo #${d.costoEnAmbos.detRank} de detracción Y motivo #${d.costoEnAmbos.promRank} de promoción.`
    : d.detraccionTop && d.promocionTop
      ? `"${d.detraccionTop.motivo}" lidera la detracción mientras "${d.promocionTop.motivo}" lidera la promoción.`
      : "Sin paradoja detectada en motivos.";

  return (
    <Layout actions={
      <ExportButton
        filename="nps-csat.xlsx"
        sheets={[
          { name: "NPS por país", rows: npsPais },
          { name: "Motivos detracción", rows: motivosDetraccion },
          { name: "Motivos promoción", rows: motivosPromocion },
          { name: "CSAT mensual", rows: csatMensual },
        ]}
      />
    }>
      {!npsMes ? (
        <EmptyPeriod section="NPS & CSAT" mes={mesLargo(mesActivo)} />
      ) : (
      <>
      {/* Fila 1 — KPIs */}
      <div className="bento cols-4">
        <div className="card lg" style={{ borderLeft: `4px solid ${npsTone.color}` }}>
          <div className="card-eyebrow">NPS Global</div>
          <div className="bignum mt-12" style={{ fontSize: 56 }}>{d.npsGlobal.toFixed(2)}</div>
          <div className="mt-12 fs-12 muted">{nfmt(d.npsResponses)} respuestas · {npsTone.label}</div>
        </div>
        <KpiCard label="Promotores"  value={nfmt(d.npsPromotoresCount)}  pct={pctFmt(d.npsPromotoresPct)}  tone="orange" />
        <KpiCard label="Pasivos"     value={nfmt(d.npsPasivosCount)}     pct={pctFmt(d.npsPasivosPct)}     tone="cream"  />
        <KpiCard label="Detractores" value={nfmt(d.npsDetractoresCount)} pct={pctFmt(d.npsDetractoresPct)} tone="ink"    />
      </div>

      <div className="divider">
        <span className="kicker">Por país</span>
        <span className="alt">/ & motivos</span>
        <span className="rule" />
      </div>

      {/* Fila 2 — 60/40 */}
      <div className="bento cols-2">
        <div className="card lg">
          <div className="card-eyebrow">NPS por país</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Distribución regional</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>País</th><th>NPS</th><th>n</th>
                <th style={{ width: "40%" }}>Promotores · Pasivos · Detractores</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {npsPais.map((p) => {
                const pasivos = Math.max(0, 100 - p.promotores - p.detractores);
                return (
                  <tr key={p.pais} className={p.alerta ? "row-alert" : ""}>
                    <td className="strong">{p.pais}</td>
                    <td className="mono strong" style={{ color: p.alerta ? "var(--red)" : "var(--ink)" }}>
                      {p.nps.toFixed(2)}
                    </td>
                    <td className="mono">{p.n.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--paper-3)" }}>
                        <div style={{ width: `${p.promotores}%`, background: ORANGE }} title={`Promotores ${p.promotores}%`} />
                        <div style={{ width: `${pasivos}%`, background: "var(--ink-5)" }} title={`Pasivos ${pasivos.toFixed(1)}%`} />
                        <div style={{ width: `${p.detractores}%`, background: "var(--red)" }} title={`Detractores ${p.detractores}%`} />
                      </div>
                      <div className="mono fs-11 muted" style={{ marginTop: 4, display: "flex", gap: 10 }}>
                        <span>{p.promotores.toFixed(1)}%</span>
                        <span>{pasivos.toFixed(1)}%</span>
                        <span style={{ color: p.alerta ? "var(--red)" : undefined }}>{p.detractores.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>{p.alerta && <span className="tag red">alerta</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card lg">
          <div className="card-eyebrow">Mirror motivos</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Lo que aleja vs lo que enamora</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MirrorCol
              title="↓ Detractan"
              data={motivosDetraccion}
              bg="rgba(179,38,30,0.04)"
              color="var(--red)"
            />
            <MirrorCol
              title="↑ Promocionan"
              data={motivosPromocion}
              bg="rgba(240,90,40,0.04)"
              color={ORANGE}
            />
          </div>
          <div style={{
            marginTop: 16, padding: "14px 16px", background: "var(--ink)",
            color: "var(--paper)", borderRadius: "var(--radius-md)",
            fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.35,
          }}>
            {paradoxText}
          </div>
        </div>
      </div>

      <div className="divider">
        <span className="kicker">La paradoja</span>
        <span className="alt">/ del churn silencioso</span>
        <span className="rule" />
      </div>

      {/* Paradoja card */}
      <div className="card lg">
        <div className="minihead">
          <div>
            <div className="card-eyebrow">Churn vs Conversaciones CSAT</div>
            <div className="card-title">2026 YTD</div>
          </div>
          <span className="callout orange">Paradoja</span>
        </div>

        <div className="chart-wrap" style={{ height: 180, marginBottom: 14 }}>
          <ResponsiveContainer>
            <BarChart data={csatMensual} margin={{ top: 18, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="churnMes" name="Bajas" fill="#B3261E" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="churnMes" position="top" style={{ fontSize: 10, fill: "#2B2B27" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{
          background: "var(--ink)", color: "var(--paper)",
          padding: "22px 26px", borderRadius: "var(--radius-lg)", marginBottom: 16,
        }}>
          <div className="serif" style={{ fontSize: 26, lineHeight: 1.3, color: "#fff" }}>
            "El churn sube. El soporte es el mejor de la historia.
            <span style={{ color: "var(--orange)" }}> Las cuentas se van sin quejarse.</span>"
          </div>
        </div>

        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer>
            <ComposedChart data={csatMensual} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#E8E6DC" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="L" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="R" orientation="right" domain={[4.5, 5]} tick={{ fontSize: 11, fill: "#1E5DBF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar yAxisId="L" dataKey="conversaciones" name="Conversaciones" fill={ORANGE} radius={[6, 6, 0, 0]} />
              <Line yAxisId="R" type="monotone" dataKey="avg" name="Avg rating" stroke="#1E5DBF" strokeWidth={2.5} dot={{ r: 4, fill: "#1E5DBF" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bento equal-2" style={{ marginTop: 18 }}>
          <InsightCard
            icon="🔍"
            text="Las cuentas que churnean dejan poca señal previa."
            sub={`${nfmt(d.csatTotalConv)} conversaciones CSAT vs ${nfmt(d.ytdClosed)} bajas en el período: el soporte no captura la mayoría.`}
          />
          <InsightCard
            icon="📉"
            text="CSAT alto NO protege del churn."
            sub={`${d.csatAvg.toFixed(2)}★ promedio${d.accelLabel ? ` mientras las bajas crecen ${d.accelLabel}` : ""}.`}
          />
          <InsightCard
            icon="🤐"
            text={`${d.pctSinMotivo.toFixed(1)}% se van sin dejar motivo.`}
            sub="No es indiferencia: es ausencia de fricción visible."
          />
          <InsightCard
            icon="⚠️"
            text={d.npsGap > 10 ? `Brecha regional de ${d.npsGap.toFixed(1)} pts NPS.` : "El soporte mide reactivo, no salud."}
            sub={d.npsWorst && d.npsBest
              ? `${d.npsBest.pais} ${d.npsBest.nps.toFixed(1)} vs ${d.npsWorst.pais} ${d.npsWorst.nps.toFixed(1)} · prioridad regional.`
              : "Necesitamos señales proactivas de uso, no encuestas post-mortem."}
          />
        </div>
      </div>
      </>
      )}
    </Layout>
  );
}

function KpiCard({ label, value, pct, tone }: { label: string; value: string; pct: string; tone: "orange" | "ink" | "cream" }) {
  const cls = tone === "orange" ? "card orange lg" : tone === "ink" ? "card ink lg" : "card cream lg";
  return (
    <div className={cls}>
      <div className="card-eyebrow">{label}</div>
      <div className="bignum mt-12" style={{ fontSize: 44 }}>{value}</div>
      <div className="mt-12 fs-12" style={{ opacity: 0.85 }}>{pct} del total</div>
    </div>
  );
}

function MirrorCol({ title, data, bg, color }: {
  title: string;
  data: { motivo: string; n: number; pct: number }[];
  bg: string;
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.pct));
  return (
    <div style={{ background: bg, padding: 14, borderRadius: "var(--radius-md)" }}>
      <div className="card-eyebrow" style={{ marginBottom: 10, fontWeight: 500, color }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.slice(0, 5).map((d) => (
          <div key={d.motivo}>
            <div className="row-flex" style={{ justifyContent: "space-between", fontSize: 11.5, gap: 8 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.motivo}</span>
              <span className="mono strong" style={{ flex: "0 0 auto" }}>{d.pct.toFixed(1)}%</span>
            </div>
            <div className="progress">
              <i style={{ width: `${(d.pct / max) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div style={{
      background: "var(--paper-2)", border: "1px solid var(--rule)",
      borderRadius: "var(--radius-md)", padding: "14px 16px",
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <div>
          <div className="strong" style={{ fontSize: 13 }}>{text}</div>
          <div className="muted fs-12" style={{ marginTop: 4 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}
