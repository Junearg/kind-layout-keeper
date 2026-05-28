import { usePeriod, periodLabel } from "@/contexts/PeriodContext";
import { useSupabaseMetrics } from "@/data/supabase-metrics";

const nfmt = (n: number) => n.toLocaleString("es-AR");

export function SupabaseMetricsPanel() {
  const { selectedPeriod } = usePeriod();
  const { data, isLoading, error } = useSupabaseMetrics(selectedPeriod);

  if (!selectedPeriod) {
    return (
      <section className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="fs-12 muted">
          No hay períodos cargados en Supabase. Importá un mes desde{" "}
          <a href="/importar" style={{ color: "var(--orange)" }}>/importar</a>.
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 18, margin: 0 }}>
          Métricas en vivo · <span className="alt">Supabase</span>
        </h2>
        <span className="mono fs-11" style={{ color: "var(--ink-3)" }}>
          {periodLabel(selectedPeriod)}
        </span>
      </div>

      {isLoading && <div className="fs-12 muted">Cargando…</div>}
      {error && <div className="fs-12" style={{ color: "var(--red)" }}>Error: {(error as Error).message}</div>}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Kpi label="Cuentas activas" value={nfmt(data.cuentasActivas)} />
          <Kpi label="Bajas del mes" value={nfmt(data.bajasTotal)} hint={data.bajasPorMotivo[0] ? `Top motivo: ${data.bajasPorMotivo[0].motivo} (${data.bajasPorMotivo[0].n})` : undefined} />
          <Kpi
            label="NPS"
            value={data.nps.total ? data.nps.score.toFixed(1) : "—"}
            hint={`${nfmt(data.nps.total)} respuestas · P:${data.nps.promotores} / Pa:${data.nps.pasivos} / D:${data.nps.detractores}`}
          />
          <Kpi
            label="Distribución health"
            value=""
            extra={
              <div className="fs-11" style={{ color: "var(--ink-2)", lineHeight: 1.7, marginTop: 4 }}>
                {data.tierDist.map((t) => (
                  <div key={t.tier} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{t.tier}</span>
                    <span className="mono">{nfmt(t.n)} · {t.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, hint, extra }: { label: string; value: string; hint?: string; extra?: React.ReactNode }) {
  return (
    <div style={{ padding: 12, background: "var(--paper-2)", borderRadius: 10, border: "1px solid var(--rule)" }}>
      <div className="fs-11" style={{ color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {value && <div className="serif" style={{ fontSize: 26, marginTop: 4, color: "var(--ink)" }}>{value}</div>}
      {hint && <div className="fs-11" style={{ color: "var(--ink-3)", marginTop: 4 }}>{hint}</div>}
      {extra}
    </div>
  );
}
