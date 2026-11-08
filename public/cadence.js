export function nextInferenceDelay({ realtime, interval = 1000, elapsed = 0, active = true, retryAfterMs = 0 }) {
  const cadence = active ? (realtime ? 0 : Math.max(0, interval - elapsed)) : 100;
  // Long provider cooldowns are rechecked without overflowing a browser timer.
  return Math.min(60_000, Math.max(cadence, retryAfterMs));
}
