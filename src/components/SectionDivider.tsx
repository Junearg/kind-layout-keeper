type Props = { kicker: string; alt?: string; sub?: string };

export function SectionDivider({ kicker, alt, sub }: Props) {
  return (
    <div className="divider">
      <span className="kicker">{kicker}</span>
      {alt && <span className="alt">/ {alt}</span>}
      {sub && <span className="sub">{sub}</span>}
      <span className="rule" />
    </div>
  );
}
