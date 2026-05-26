type Props = { score: number; color: string; size?: number };

export function ScoreRing({ score, color, size = 64 }: Props) {
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: `0 0 ${size}px` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2} y={size / 2 + 4} textAnchor="middle"
        fontSize={size * 0.22} fontFamily="JetBrains Mono" fontWeight={600} fill="var(--ink)"
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}
