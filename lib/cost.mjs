// Jev list price, verified 2026-10-31: https://typesafe.ai/
export const DEFAULT_INPUT_USD_PER_MILLION = 0.042;

export function createCostTracker(inputUsdPerMillion = DEFAULT_INPUT_USD_PER_MILLION, now = Date.now) {
  if (!Number.isFinite(inputUsdPerMillion) || inputUsdPerMillion < 0) throw new Error('TYPESAFE_INPUT_USD_PER_MILLION must be a nonnegative number.');
  const startedAt = new Date().toISOString();
  let requests = 0, inputTokens = 0, outputTokens = 0, missingUsageRequests = 0;
  let recentCosts = [];
  let rateStartedAt = null, lastCostAt = null;
  const validCount = value => Number.isSafeInteger(value) && value >= 0;
  const snapshot = () => {
    recentCosts = recentCosts.filter(sample => sample.at > now() - 60_000);
    return {
      estimated: true, startedAt, inputUsdPerMillion,
      requests, inputTokens, outputTokens, missingUsageRequests,
      totalCents: inputTokens * inputUsdPerMillion / 10_000,
      recentCosts: recentCosts.map(sample => ({ ...sample })), rateStartedAt
    };
  };
  return {
    snapshot,
    record(usage, requestStartedAt = now()) {
      requests++;
      if (rateStartedAt === null || (lastCostAt !== null && requestStartedAt - lastCostAt >= 60_000)) rateStartedAt = requestStartedAt;
      lastCostAt = now();
      const at = Math.floor(lastCostAt / 1000) * 1000;
      let sample = recentCosts.at(-1);
      if (!sample || sample.at !== at) {
        sample = { at, cents: 0, missingUsageRequests: 0 };
        recentCosts.push(sample);
      }
      if (validCount(usage?.input_tokens)) sample.cents += usage.input_tokens * inputUsdPerMillion / 10_000;
      else sample.missingUsageRequests++;
      if (validCount(usage?.input_tokens)) inputTokens += usage.input_tokens;
      else missingUsageRequests++;
      if (validCount(usage?.output_tokens)) outputTokens += usage.output_tokens;
      return snapshot();
    }
  };
}
