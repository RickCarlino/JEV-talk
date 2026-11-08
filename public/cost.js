export function formatCost(cost) {
  if (!cost || !Number.isFinite(cost.totalCents) || cost.totalCents < 0) return '—¢';
  if (cost.missingUsageRequests && cost.inputTokens === 0) return '—¢';
  if (cost.missingUsageRequests) return `≥${cost.totalCents.toFixed(4)}¢`;
  if (cost.totalCents > 0 && cost.totalCents < 0.0001) return '<0.0001¢';
  return `~${cost.totalCents.toFixed(4)}¢`;
}

export function formatCostRate(cost, now = Date.now()) {
  if (!Array.isArray(cost?.recentCosts)) return '— ¢/min';
  const samples = cost.recentCosts.filter(sample => sample.at > now - 60_000 && sample.at <= now);
  const elapsed = Number.isFinite(cost.rateStartedAt) ? Math.min(60_000, now - cost.rateStartedAt) : 60_000;
  if (samples.length && elapsed <= 0) return '— ¢/min';
  const cents = samples.reduce((sum, sample) => sum + sample.cents, 0) * 60_000 / Math.max(1, elapsed);
  const missing = samples.some(sample => sample.missingUsageRequests > 0);
  if (missing && cents === 0) return '— ¢/min';
  if (!missing && cents > 0 && cents < 0.01) return '<0.01 ¢/min';
  return `${missing ? '≥' : '~'}${cents.toFixed(2)} ¢/min`;
}
