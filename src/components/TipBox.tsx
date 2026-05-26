type Row = { k: string; v: string | number; color?: string };
type Props = {
  title?: string;
  rows: Row[];
  active?: boolean;
};

export function TipBox({ title, rows, active }: Props) {
  if (!active) return null;
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--rule)",
      borderRadius: 10,
      padding: "10px 12px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      fontSize: 12,
      minWidth: 160,
    }}>
      {title && (
        <div className="serif" style={{ fontSize: 16, marginBottom: 6, color: "var(--ink)" }}>{title}</div>
      )}
      {rows.map((r) => (
        <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" }}>
          <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {r.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color }} />}
            {r.k}
          </span>
          <span className="mono strong" style={{ color: "var(--ink)" }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}
