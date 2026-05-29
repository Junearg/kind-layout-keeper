import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ExportButton } from "@/components/ExportButton";
import { EmptyPeriod } from "@/components/EmptyPeriod";
import { ORANGE } from "@/data/mockData";
import { useDashboardData } from "@/data/liveData";
import { useDerived } from "@/data/derived";
import { useNpsMes, useMesActivo } from "@/data/dataset-store";
import { mesLargo } from "@/data/schema";
import { useSupabaseNps, type NpsMotivoRow } from "@/data/supabase-nps";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ComposedChart, Line, LabelList, Cell,
} from "recharts";

export const Route = createFileRoute("/nps")({
  head: () => ({ meta: [{ title: "NPS & CSAT · Churn Hub" }] }),
  component: Nps,
});

const nfmt = (n: number) => Math.round(n).toLocaleString("es-AR");
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

function npsColor(nps: number) {
  if (nps >= 50) return ORANGE;
  if (nps >= 30) return "var(--amber)";
  return "var(--red)";
}

function Nps() {
  const { csatMensual } = useDashboardData();
  const d = useDerived();
  const npsMes = useNpsMes();
  const mesActivo = useMesActivo();
  const { data: npsData } = useSupabaseNps(mesActivo);

  if (!npsMes || !npsData || npsData.total === 0) {
    return (
      <Layout>
        <EmptyPeriod section="NPS & CSAT" mes={mesLargo(mesActivo)} />
      </Layout>
    );
  }

  const npsTone =
    npsData.npsGlobal >= 50 ? { color: "var(--orange)", label: "zona saludable" } :
    npsData.npsGlobal >= 30 ? { color: "var(--amber)",  label: "zona vigilar"  } :
                              { color: "var(--red)",    label: "zona crítica"  };

  // Tendencia entre periodos (toma los dos con mayor n / más recientes)
  const pers = npsData.npsPeriodos;
  const periodoActual = pers[pers.length - 1] ?? null;
  const periodoPrev = pers.length >= 2 ? pers[pers.length - 2]! : null;
  const periodoDelta = periodoActual && periodoPrev ? periodoActual.nps - periodoPrev.nps : null;

  const detractorTop = npsData.motivosDetraccion[0] ?? null;
  const promotorTop = npsData.motivosPromocion[0] ?? null;
  const paradoxText = detractorTop && promotorTop
    ? `"${detractorTop.motivo}" es el motivo #1 de detracción. "${promotorTop.motivo}" es el motivo #1 de quienes igual nos recomendarían.`
    : "Sin datos suficientes para detectar la paradoja.";

  return (
    <Layout actions={
      <ExportButton
        filename="nps-csat.xlsx"
        sheets={[
          { name: "NPS por país", rows: npsData.npsPais },
          { name: "Motivos detracción", rows: npsData.motivosDetraccion },
          { name: "Motivos promoción", rows: npsData.motivosPromocion },
          { name: "NPS por plan", rows: npsData.npsPlan },
          { name: "NPS por ejecutivo", rows: npsData.npsEjecutivo },
          { name: "CSAT mensual", rows: csatMensual },
        ]}
      />
    }>
      {/* Fila 1 — KPIs */}
      <div className="bento cols-4">
        <div className="card lg" style={{ borderLeft: `4px solid ${npsTone.color}` }}>
          <div className="card-eyebrow">NPS al momento de la baja</div>
          <div className="bignum mt-12" style={{ fontSize: 56 }}>{npsData.npsGlobal.toFixed(1)}</div>
          <div className="mt-12 fs-12 muted">{nfmt(npsData.total)} cuentas con NPS respondido · {npsTone.label}</div>
          {periodoDelta !== null && periodoActual && periodoPrev && (
            <div className="mt-12" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="tag" style={{
                background: periodoDelta < 0 ? "#FBEAE9" : "#EAF7EE",
                color: periodoDelta < 0 ? "var(--red)" : "var(--orange)",
                fontWeight: 600,
              }}>
                {periodoDelta >= 0 ? "+" : ""}{periodoDelta.toFixed(1)} pts
              </span>
              <span className="fs-11 muted">
                {periodoPrev.periodo} ({periodoPrev.nps.toFixed(1)}) → {periodoActual.periodo} ({periodoActual.nps.toFixed(1)})
              </span>
            </div>
          )}
        </div>
        <KpiCard label="Promotores"  value={nfmt(npsData.promotores)}  pct={pctFmt(npsData.promPct)}  tone="orange" />
        <KpiCard label="Neutros"     value={nfmt(npsData.pasivos)}     pct={pctFmt(npsData.pasPct)}     tone="cream"  />
        <KpiCard label="Detractores" value={nfmt(npsData.detractores)} pct={pctFmt(npsData.detPct)} tone="ink"    />
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
                <th>País</th><th>NPS</th><th>LTR avg</th><th>n</th>
                <th style={{ width: "32%" }}>Prom · Neu · Detr</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {npsData.npsPais.map((p) => (
                <tr key={p.pais} className={p.alerta ? "row-alert" : ""}>
                  <td className="strong">{p.pais}</td>
                  <td className="mono strong" style={{ color: npsColor(p.nps) }}>
                    {p.nps.toFixed(1)}
                  </td>
                  <td className="mono">{p.ltrAvg.toFixed(1)}</td>
                  <td className="mono">{p.n.toLocaleString()}</td>
                  <td>
                    <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--paper-3)" }}>
                      <div style={{ width: `${p.promPct}%`, background: ORANGE }} title={`Promotores ${p.promPct.toFixed(1)}%`} />
                      <div style={{ width: `${p.pasPct}%`, background: "var(--ink-5)" }} title={`Neutros ${p.pasPct.toFixed(1)}%`} />
                      <div style={{ width: `${p.detPct}%`, background: "var(--red)" }} title={`Detractores ${p.detPct.toFixed(1)}%`} />
                    </div>
                    <div className="mono fs-11 muted" style={{ marginTop: 4, display: "flex", gap: 10 }}>
                      <span>{p.promPct.toFixed(0)}%</span>
                      <span>{p.pasPct.toFixed(0)}%</span>
                      <span style={{ color: p.alerta ? "var(--red)" : undefined }}>{p.detPct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td>{p.alerta && <span className="tag red">alerta</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card lg">
          <div className="card-eyebrow">Mirror motivos</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Lo que aleja vs lo que enamora</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MirrorCol
              title={`↓ Detractan (n=${npsData.detractores})`}
              data={npsData.motivosDetraccion}
              bg="rgba(179,38,30,0.04)"
              color="var(--red)"
            />
            <MirrorCol
              title={`↑ Promocionan (n=${npsData.promotores})`}
              data={npsData.motivosPromocion}
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

      {/* Paradoja del promotor */}
      <div className="divider">
        <span className="kicker">La paradoja</span>
        <span className="alt">/ del promotor</span>
        <span className="rule" />
      </div>

      <div className="card lg" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="card-eyebrow" style={{ color: ORANGE }}>NPS Paradox</div>
        <div className="serif" style={{ fontSize: 30, lineHeight: 1.25, color: "#fff", marginTop: 8, marginBottom: 20 }}>
          El producto enamora.
          <span style={{ color: ORANGE }}> El modelo de precios, no siempre.</span>
        </div>
        <div className="bento cols-4">
          <DarkStat
            big={`${npsData.promotoresChurnPct.toFixed(0)}%`}
            label="de las cuentas con NPS son Promotores"
            sub="…y aun así se dieron de baja"
          />
          <DarkStat
            big={`${npsData.promotoresCerroNegocioPct.toFixed(0)}%`}
            label={`de esos ${nfmt(npsData.promotores)} promotores`}
            sub="cerró su negocio"
          />
          <DarkStat
            big={`${npsData.promotoresSinMotivoPct.toFixed(0)}%`}
            label="se fueron sin dejar motivo claro"
            sub="no hubo señal previa"
          />
          <DarkStat
            big={nfmt(npsData.promotoresMaxPorPrecio)}
            label="cuentas con NPS = 10"
            sub="se fueron por precio/costo"
          />
        </div>
      </div>

      {/* NPS por plan */}
      <div className="divider">
        <span className="kicker">Por plan</span>
        <span className="alt">/ satisfacción al churnear</span>
        <span className="rule" />
      </div>

      <div className="card lg">
        <div className="card-eyebrow">NPS por plan base</div>
        <div className="card-title" style={{ marginBottom: 16 }}>Quién churnea satisfecho</div>
        <div className="chart-wrap" style={{ height: Math.max(180, npsData.npsPlan.length * 56 + 40) }}>
          <ResponsiveContainer>
            <BarChart data={npsData.npsPlan} layout="vertical" margin={{ top: 10, right: 56, left: 24, bottom: 0 }}>
              <CartesianGrid stroke="#E8E6DC" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plan" tick={{ fontSize: 12, fill: "#2B2B27" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: any, _n: any, p: any) => [`NPS ${Number(v).toFixed(1)} · n=${p?.payload?.n ?? ""}`, "NPS"]}
              />
              <Bar dataKey="nps" radius={[0, 6, 6, 0]}>
                {npsData.npsPlan.map((p, i) => (
                  <Cell key={i} fill={npsColor(p.nps)} />
                ))}
                <LabelList dataKey="nps" position="right" formatter={(v: any) => Number(v).toFixed(1)} style={{ fontSize: 11, fill: "#2B2B27" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="muted fs-12" style={{ marginTop: 8 }}>
          Los planes con NPS más alto se van por motivos externos al producto (cierre, estacionalidad), no por insatisfacción.
        </div>
      </div>

      {/* NPS por ejecutivo */}
      <div className="divider">
        <span className="kicker">Por ejecutivo</span>
        <span className="alt">/ ranking CS</span>
        <span className="rule" />
      </div>

      <div className="card lg">
        <div className="card-eyebrow">NPS por ejecutivo (n ≥ 10)</div>
        <div className="card-title" style={{ marginBottom: 16 }}>Ranking al momento de la baja</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Ejecutivo</th><th>n</th><th>NPS</th><th>% Detractores</th>
            </tr>
          </thead>
          <tbody>
            {npsData.npsEjecutivo.map((e) => (
              <tr key={e.ejecutivo}>
                <td className="strong">{e.ejecutivo}</td>
                <td className="mono">{e.n}</td>
                <td className="mono strong" style={{ color: npsColor(e.nps) }}>{e.nps.toFixed(1)}</td>
                <td className="mono">{e.detPct.toFixed(1)}%</td>
              </tr>
            ))}
            {npsData.npsEjecutivo.length === 0 && (
              <tr><td colSpan={4} className="muted">Sin ejecutivos con n ≥ 10 en el período.</td></tr>
            )}
          </tbody>
        </table>
        <div className="muted fs-12" style={{ marginTop: 10 }}>
          NPS medido sobre cuentas que ya churnearon — indica satisfacción al momento de la baja.
        </div>
      </div>

      {/* Paradoja CSAT */}
      <div className="divider">
        <span className="kicker">CSAT vs Churn</span>
        <span className="alt">/ del churn silencioso</span>
        <span className="rule" />
      </div>

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
            sub={`${nfmt(d.csatTotalConv)} conversaciones CSAT vs ${nfmt(d.ytdClosed)} bajas en el período.`}
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
            text={`${npsData.promPct.toFixed(0)}% de los que respondieron NPS son Promotores y churnearon igual.`}
            sub="La satisfacción no es señal suficiente: necesitamos métricas de uso y valor percibido."
          />
        </div>
      </div>
    </Layout>
  );
}

function NpsBarCell({ fill }: { fill: string }) {
  // Recharts requires Cell, but using a plain rect via fill on Bar's cell prop
  // is awkward — we just reuse a simple span via dangerously-styled approach.
  // Instead, return a Recharts <Cell> equivalent.
  return <rect fill={fill} />;
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
  data: NpsMotivoRow[];
  bg: string;
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.pct), 1);
  return (
    <div style={{ background: bg, padding: 14, borderRadius: "var(--radius-md)" }}>
      <div className="card-eyebrow" style={{ marginBottom: 10, fontWeight: 500, color }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.slice(0, 5).map((d) => (
          <div key={d.motivo}>
            <div className="row-flex" style={{ justifyContent: "space-between", fontSize: 11.5, gap: 8 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.motivo}</span>
              <span className="mono strong" style={{ flex: "0 0 auto" }}>{d.n} · {d.pct.toFixed(0)}%</span>
            </div>
            <div className="progress">
              <i style={{ width: `${(d.pct / max) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
        {data.length === 0 && <div className="muted fs-12">Sin motivos registrados.</div>}
      </div>
    </div>
  );
}

function DarkStat({ big, label, sub }: { big: string; label: string; sub: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "var(--radius-md)",
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 38, fontWeight: 700, color: ORANGE, lineHeight: 1 }}>{big}</div>
      <div style={{ fontSize: 13, color: "#fff", marginTop: 10, lineHeight: 1.35 }}>{label}</div>
      <div className="fs-11" style={{ color: "rgba(255,255,255,0.6)", marginTop: 6 }}>{sub}</div>
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
