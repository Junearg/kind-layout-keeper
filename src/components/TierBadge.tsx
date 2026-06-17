type Tier = "Champion" | "Healthy" | "At Risk" | "Critical";

export function TierBadge({ tier }: { tier: Tier }) {
  const cls = tier === "At Risk" ? "tier-AtRisk" : tier;
  return <span className={`tag tier-${cls}`}>{tier}</span>;
}
