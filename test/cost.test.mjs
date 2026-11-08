import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCostTracker } from '../lib/cost.mjs';
import { formatCost, formatCostRate } from '../public/cost.js';

test('one million billable input tokens cost 4.2 US cents, with free output', () => {
  const cost = createCostTracker().record({input_tokens:1_000_000,output_tokens:5_000_000});
  assert.equal(cost.totalCents,4.2);
  assert.equal(formatCost(cost),'~4.2000¢');
});
test('accumulates tokens before rounding and snapshots do not alter the running total', () => {
  const tracker=createCostTracker();
  for(let i=0;i<3;i++) tracker.record({input_tokens:100,output_tokens:10});
  const cost=tracker.snapshot();
  assert.equal(cost.inputTokens,300); assert.equal(cost.requests,3);
  assert.equal(formatCost(cost),'~0.0013¢');
  cost.inputTokens=0;
  assert.equal(tracker.snapshot().inputTokens,300);
});
test('does not report unknown usage as zero cost', () => {
  const tracker=createCostTracker();
  assert.equal(formatCost(tracker.record(undefined)),'—¢');
  const cost=tracker.record({input_tokens:1_000_000,output_tokens:0});
  assert.equal(cost.missingUsageRequests,1);
  assert.equal(formatCost(cost),'≥4.2000¢');
});
test('supports a configured input rate and displays fractional cents', () => {
  const tracker=createCostTracker(0.1);
  assert.equal(tracker.record({input_tokens:1_000_000}).totalCents,10);
  assert.equal(formatCost(createCostTracker().record({input_tokens:1})),'<0.0001¢');
  assert.throws(()=>createCostTracker(NaN));
  assert.throws(()=>createCostTracker(-1));
});

test('minute rate uses recent billed usage and expires while paused', () => {
  let now = 1_000_000;
  const tracker = createCostTracker(0.042, () => now);
  tracker.record({input_tokens:1_000_000}, now - 30_000);
  now += 30_000;
  const snapshot = tracker.record({input_tokens:1_000_000});
  assert.equal(formatCostRate(snapshot, now), '~8.40 ¢/min');
  assert.equal(formatCostRate(snapshot, now + 30_000), '~4.20 ¢/min');
  assert.equal(formatCostRate(snapshot, now + 60_000), '~0.00 ¢/min');
  now += 60_000;
  assert.deepEqual(tracker.snapshot().recentCosts, []);
  assert.equal(tracker.snapshot().totalCents, 8.4);
});

test('minute rate retains missing-usage warnings only within its window', () => {
  let now = 1_000_000;
  const tracker = createCostTracker(0.042, () => now);
  assert.equal(formatCostRate(tracker.record(undefined, now - 60_000), now), '— ¢/min');
  now += 1000;
  const snapshot = tracker.record({input_tokens:1_000_000});
  assert.equal(formatCostRate(snapshot, now), '≥4.20 ¢/min');
  assert.equal(formatCostRate(snapshot, now + 59_000), '~4.20 ¢/min');
  snapshot.recentCosts[1].cents = 0;
  assert.equal(formatCostRate(tracker.snapshot(), now), '≥4.20 ¢/min');
  assert.equal(formatCostRate(null, now), '— ¢/min');
});

test('minute rate rounds to two decimal places while preserving tiny nonzero spend', () => {
  const cost = cents => ({recentCosts:[{at:1000,cents,missingUsageRequests:0}]});
  assert.equal(formatCostRate(cost(0.1234), 1000), '~0.12 ¢/min');
  assert.equal(formatCostRate(cost(0.126), 1000), '~0.13 ¢/min');
  assert.equal(formatCostRate(cost(0.0001), 1000), '<0.01 ¢/min');
});

test('constant spending shows the same per-minute rate throughout warm-up and after a minute', () => {
  let now = 100_000;
  const tracker = createCostTracker(1, () => now);
  const start = now;
  for (let seconds = 10; seconds <= 120; seconds += 10) {
    now = start + seconds * 1000;
    const cost = tracker.record({input_tokens:10_000}, now - 10_000);
    assert.equal(formatCostRate(cost, now), '~6.00 ¢/min', `at ${seconds} seconds`);
  }
  now += 120_000;
  assert.equal(formatCostRate(tracker.snapshot(), now), '~0.00 ¢/min');
  now += 10_000;
  assert.equal(formatCostRate(tracker.record({input_tokens:10_000}, now - 10_000), now), '~6.00 ¢/min');
});
