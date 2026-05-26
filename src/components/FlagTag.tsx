type Props = { flag: string };

type Style = { bg: string; fg: string; outline?: boolean };

function styleFor(flag: string): Style {
  if (flag === "CAIDA_CRITICA_3M" || flag === "CUENTA_INACTIVA_+2M")
    return { bg: "#FBEAE9", fg: "var(--red)" };
  if (flag === "CAIDA_MODERADA_3M" || flag === "ADOPCION_BAJA" || flag === "ADOPCION_MINIMA")
    return { bg: "#FDF4E7", fg: "var(--amber)" };
  if (flag === "MONO_CANAL")
    return { bg: "transparent", fg: "var(--amber)", outline: true };
  if (flag === "NPS_DETRACTOR")
    return { bg: "#F3EAFB", fg: "#7C3AED" };
  return { bg: "var(--paper-2)", fg: "var(--ink-3)" };
}

export function FlagTag({ flag }: Props) {
  const s = styleFor(flag);
  return (
    <span
      className="tag mono fs-11"
      style={{
        background: s.bg,
        color: s.fg,
        border: s.outline ? `1px solid ${s.fg}` : "1px solid transparent",
      }}
    >
      {flag}
    </span>
  );
}
