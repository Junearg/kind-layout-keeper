import { Link } from "@tanstack/react-router";

type Props = { color: "red" | "amber"; icon?: string; text: string; link?: string };

const map = {
  red:   { bg: "rgba(179,38,30,0.06)",  border: "var(--red)",   fg: "var(--red)"   },
  amber: { bg: "rgba(181,116,15,0.06)", border: "var(--amber)", fg: "var(--amber)" },
};

export function AlertBanner({ color, icon, text, link }: Props) {
  const c = map[color];
  return (
    <div style={{
      background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: 10,
      padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
    }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span className="fs-12" style={{ color: "var(--ink-2)", flex: 1 }}>{text}</span>
      {link && (
        <Link to={link} className="fs-12 strong" style={{ color: c.fg, textDecoration: "none", whiteSpace: "nowrap" }}>
          Ver →
        </Link>
      )}
    </div>
  );
}
