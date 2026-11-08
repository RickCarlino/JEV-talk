export const MAX_REQUESTS = 10_000;

const number = value => value !== null && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
function resetDelay(value, now, relative = false) {
  if (value === null) return 0;
  const n = number(value);
  if (n !== null) {
    if (relative || n < 1_000_000_000) return n * 1000;
    return Math.max(0, (n > 1_000_000_000_000 ? n : n * 1000) - now);
  }
  const text = value.trim().toLowerCase();
  if (/^(?:\d+(?:\.\d+)?(?:ms|s|m|h|d))+$/.test(text)) {
    return [...text.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)].reduce((sum, [, n, unit]) => sum + Number(n) * ({ ms:1, s:1000, m:60000, h:3600000, d:86400000 }[unit]), 0);
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export function rateLimitDelay(headers, now = Date.now()) {
  const serverDate = Date.parse(headers.get('date'));
  const reference = Number.isFinite(serverDate) ? serverDate : now;
  const delays = [0];
  const ms = number(headers.get('retry-after-ms'));
  if (ms !== null) delays.push(ms);
  const retry = headers.get('retry-after');
  if (retry !== null) {
    const seconds = number(retry);
    delays.push(seconds !== null ? seconds * 1000 : Math.max(0, Date.parse(retry) - reference) || 0);
  }
  if (number(headers.get('ratelimit-remaining')) === 0) delays.push(resetDelay(headers.get('ratelimit-reset'), reference, true));
  for (const suffix of ['', '-requests', '-tokens']) {
    if (number(headers.get(`x-ratelimit-remaining${suffix}`)) === 0) delays.push(resetDelay(headers.get(`x-ratelimit-reset${suffix}`), reference));
  }
  // Structured RateLimit fields: policy name followed by remaining (r) and reset (t).
  for (const policy of (headers.get('ratelimit') || '').split(',')) {
    if (/;\s*r\s*=\s*0(?:\s*;|\s*$)/i.test(policy)) {
      const seconds = policy.match(/;\s*t\s*=\s*(\d+(?:\.\d+)?)/i)?.[1];
      if (seconds) delays.push(Number(seconds) * 1000);
    }
  }
  return Math.ceil(Math.max(...delays.filter(Number.isFinite)));
}

export function createRequestControl({ limit = MAX_REQUESTS, now = Date.now } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_REQUESTS) throw new Error('Request limit must be 1–10,000.');
  let used = 0, lastStartedAt = -Infinity, waitUntil = 0, failures = 0;
  const snapshot = () => ({ used, limit, remaining: limit - used, exhausted: used >= limit, nextAllowedAt: waitUntil, retryAfterMs: Math.max(0, waitUntil - now()) });
  return {
    snapshot,
    reserve({ realtime = true } = {}) {
      if (used >= limit) return { ok:false, reason:'limit', status:snapshot() };
      const deadline = Math.max(waitUntil, realtime ? 0 : lastStartedAt + 900);
      if (deadline > now()) return { ok:false, reason:'wait', status:{ ...snapshot(), nextAllowedAt:deadline, retryAfterMs:deadline - now() } };
      used++; lastStartedAt = now();
      return { ok:true, status:snapshot() };
    },
    observe(headers, status) {
      const retryable = [429, 529, 503].includes(status);
      failures = retryable ? failures + 1 : 0;
      const explicit = rateLimitDelay(headers, now());
      const backoff = retryable ? Math.min(30_000, 1000 * 2 ** Math.min(failures - 1, 5)) : 0;
      waitUntil = Math.max(waitUntil, now() + explicit, now() + backoff);
      return { retryable, status:snapshot() };
    }
  };
}
