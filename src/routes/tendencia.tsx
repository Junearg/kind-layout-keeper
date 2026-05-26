import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { churnTrend, churnByMotivo, cvrNeto, csatMensual, ORANGE } from "@/data/mockData";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export const Route = createFileRoute("/tendencia")({
  head: () => ({ meta: [{ title: "Tendencia · Churn Hub" }] }),
  component: Tendencia,
});

function Tendencia() {
  return (
    <Layout>
      <div className="bento cols-1">
        <div className="card lg">
          <div className="minihead">
            <div>
              <div className="card-eyebrow">Bajas mensuales + proyección</div>
              <div className="card-title">De 1,008 a 1,846 en 7 meses</div>
            </div>
            <span className="callout orange">↑ +83% en 7 meses</span>
          </div>
          <div className="chart-wrap" style={{ height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={churnTrend}>
                <CartesianGrid stroke="#E8E6DC" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                <Bar dataKey="bajas" fill={ORANGE} radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="pctMotivo" stroke="#0B0B0A" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="divider">
        <span className="kicker">Desglose</span>
        <span className="alt">/ por motivo</span>
        <span className="rule" />
      </div>

      <div className="card lg">
        <table className="tbl">
          <thead>
            <tr>
              <th>Mes</th><th>Total</th><th>Definitivo</th><th>Temporal</th>
              <th>Sin resp.</th><th>Dejó usar</th><th>Eligió otro</th>
              <th>Precio</th><th>Falta func.</th><th>Mal serv.</th>
            </tr>
          </thead>
          <tbody>
            {churnByMotivo.map((r) => (
              <tr key={r.mes}>
                <td className="strong">{r.mes}</td>
                <td className="mono strong">{r.total.toLocaleString()}</td>
                <td className="mono">{r.definitivo}</td>
                <td className="mono">{r.temporal}</td>
                <td className="mono" style={{ color: "var(--red)" }}>{r.sinResp}</td>
                <td className="mono">{r.dejoUsar}</td>
                <td className="mono">{r.eligioOtro}</td>
                <td className="mono">{r.precio}</td>
                <td className="mono">{r.faltaFunc}</td>
                <td className="mono">{r.malServ}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divider">
        <span className="kicker">Compensación</span>
        <span className="alt">/ CVR neto + CSAT</span>
        <span className="rule" />
      </div>

      <div className="bento equal-2">
        <div className="card lg">
          <div className="card-eyebrow">CVR neto de bajas</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Recupero del churn (%)</div>
          <div className="chart-wrap" style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={cvrNeto}>
                <CartesianGrid stroke="#E8E6DC" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cvr" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card cream lg">
          <div className="card-eyebrow">CSAT mensual</div>
          <div className="card-title" style={{ marginBottom: 16 }}>Conversaciones y rating</div>
          <div className="chart-wrap" style={{ height: 240, background: "white" }}>
            <ResponsiveContainer>
              <ComposedChart data={csatMensual}>
                <CartesianGrid stroke="#E8E6DC" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="L" tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="R" orientation="right" domain={[4.5, 5]} tick={{ fontSize: 11, fill: "#6E6D66" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="L" dataKey="rating5" stackId="r" fill={ORANGE} radius={[6, 6, 0, 0]} />
                <Bar yAxisId="L" dataKey="rating4" stackId="r" fill="#FFB089" radius={[6, 6, 0, 0]} />
                <Line yAxisId="R" type="monotone" dataKey="avg" stroke="#0B0B0A" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
