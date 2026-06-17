import { Link } from "@tanstack/react-router";

export function EmptyPeriod({ section, mes }: { section: string; mes?: string }) {
  return (
    <div className="card" style={{ padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 32, opacity: 0.4 }}>∅</div>
      <h3 className="serif" style={{ fontSize: 20, marginTop: 8 }}>
        Sin datos para este período
      </h3>
      <p className="fs-12" style={{ color: "var(--ink-3)", marginTop: 6 }}>
        {section}{mes ? ` · ${mes}` : ""} no tiene filas cargadas en el dataset actual.
      </p>
      <Link
        to="/importar"
        className="btn ghost"
        style={{ marginTop: 14, display: "inline-block" }}
      >
        Ir a importar
      </Link>
    </div>
  );
}
