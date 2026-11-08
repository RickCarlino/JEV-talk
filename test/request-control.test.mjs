import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestControl, MAX_REQUESTS, rateLimitDelay } from '../lib/request-control.mjs';
import { nextInferenceDelay } from '../public/cadence.js';

const epoch = 1_800_000_000_000;
test('realtime schedules immediately after completion while paced mode targets 1 FPS', () => {
  assert.equal(nextInferenceDelay({realtime:true,elapsed:150}),0);
  assert.equal(nextInferenceDelay({realtime:false,elapsed:150}),850);
  assert.equal(nextInferenceDelay({realtime:true,retryAfterMs:2500}),2500);
  assert.equal(nextInferenceDelay({realtime:true,active:false}),100);
});
test('stops at exactly 10,000 outbound attempts', () => {
  const gate=createRequestControl({now:()=>epoch});
  for(let i=0;i<10_000;i++) assert.equal(gate.reserve().ok,true);
  assert.equal(gate.snapshot().used,10_000);
  assert.equal(gate.snapshot().remaining,0);
  assert.equal(gate.reserve().reason,'limit');
  assert.equal(gate.snapshot().used,10_000);
  assert.equal(MAX_REQUESTS,10_000);
  assert.throws(()=>createRequestControl({limit:10_001}));
});
test('accepts back-to-back requests in realtime but preserves pacing when disabled', () => {
  const realtime=createRequestControl({now:()=>epoch});
  assert.equal(realtime.reserve().ok,true); assert.equal(realtime.reserve().ok,true);
  const paced=createRequestControl({now:()=>epoch});
  assert.equal(paced.reserve({realtime:false}).ok,true);
  assert.equal(paced.reserve({realtime:false}).status.retryAfterMs,900);
  assert.equal(paced.snapshot().used,1);
});
test('honors retry delay headers, including HTTP dates and clock skew', () => {
  assert.equal(rateLimitDelay(new Headers({'retry-after':'2'}),epoch),2000);
  assert.equal(rateLimitDelay(new Headers({'retry-after-ms':'1250'}),epoch),1250);
  assert.equal(rateLimitDelay(new Headers({'retry-after':'2','retry-after-ms':'2500'}),epoch),2500);
  assert.equal(rateLimitDelay(new Headers({date:new Date(epoch).toUTCString(),'retry-after':new Date(epoch+5000).toUTCString()}),epoch+100_000),5000);
  assert.equal(rateLimitDelay(new Headers({'retry-after':'invalid','retry-after-ms':'-1'}),epoch),0);
});
test('honors exhausted request and token quota reset headers on successful responses', () => {
  assert.equal(rateLimitDelay(new Headers({'ratelimit-remaining':'0','ratelimit-reset':'3'}),epoch),3000);
  assert.equal(rateLimitDelay(new Headers({'x-ratelimit-remaining':'0','x-ratelimit-reset':String(epoch/1000+5)}),epoch),5000);
  assert.equal(rateLimitDelay(new Headers({'x-ratelimit-remaining-requests':'0','x-ratelimit-reset-requests':'1m20s'}),epoch),80000);
  assert.equal(rateLimitDelay(new Headers({'x-ratelimit-remaining-tokens':'0','x-ratelimit-reset-tokens':'250ms'}),epoch),250);
  assert.equal(rateLimitDelay(new Headers({'ratelimit':'"requests";r=0;t=7'}),epoch),7000);
  assert.equal(rateLimitDelay(new Headers({'ratelimit-remaining':'4','ratelimit-reset':'3'}),epoch),0);
});
test('uses exponential backoff without retry headers and never spends budget during cooldown', () => {
  let time=epoch;
  const gate=createRequestControl({now:()=>time});
  gate.reserve();
  assert.equal(gate.observe(new Headers(),429).status.retryAfterMs,1000);
  assert.equal(gate.reserve().ok,false); assert.equal(gate.snapshot().used,1);
  time+=1000; assert.equal(gate.reserve().ok,true);
  assert.equal(gate.observe(new Headers(),529).status.retryAfterMs,2000);
  time+=2000; assert.equal(gate.reserve().ok,true);
  assert.equal(gate.observe(new Headers(),200).status.retryAfterMs,0);
  assert.equal(gate.observe(new Headers(),429).status.retryAfterMs,1000);
});
