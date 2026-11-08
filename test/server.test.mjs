import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createTalkServer } from '../server.mjs';
import { slides } from '../public/deck.js';

async function fixture(options = {}) {
  const server = createTalkServer(options);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await (await fetch(`${origin}/api/session`)).json();
  const request = async (route, data, key = session.key) => {
    const res = await fetch(`${origin}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Presenter-Key': key }, body: JSON.stringify(data) });
    return { status: res.status, data: await res.json() };
  };
  return { origin, session, request, stop: () => { server.closeAllConnections(); server.close(); } };
}

test('serves the wordless audience shell and keeps private files outside the static root', async t => {
  const f = await fixture(); t.after(f.stop);
  assert.equal((await fetch(`${f.origin}/stage`)).status, 200);
  assert.equal((await fetch(`${f.origin}/.env`)).status, 404);
  assert.equal((await fetch(`${f.origin}/server.mjs`)).status, 404);
  for (const slide of slides) assert.equal((await fetch(`${f.origin}/assets/${slide.image}`)).status, 200, slide.image);
});

test('requires the session key for mutations and rejects invalid scene numbers', async t => {
  const f = await fixture(); t.after(f.stop);
  assert.equal((await f.request('control', { action: 'navigate', index: 1 }, 'bad-key')).status, 403);
  assert.equal((await f.request('control', { action: 'navigate', index: -1 })).status, 400);
  assert.equal((await f.request('control', { action: 'navigate', index: slides.length })).status, 400);
  assert.equal((await f.request('control', { action: 'navigate', index: 2 })).status, 200);
  const next = await (await fetch(`${f.origin}/api/session`)).json();
  assert.equal(next.state.index, 2);
  assert.equal(next.key, f.session.key);
});

test('pushes navigation to connected audience views', async t => {
  const f = await fixture(); t.after(f.stop);
  const abort = new AbortController(); t.after(() => abort.abort());
  const response = await fetch(`${f.origin}/api/events?key=${f.session.key}`, { signal: abort.signal });
  const reader = response.body.getReader();
  await reader.read();
  await f.request('control', { action: 'navigate', index: 4 });
  const chunk = new TextDecoder().decode((await reader.read()).value);
  assert.match(chunk, /event: state/);
  assert.match(chunk, /"index":4/);
  await reader.cancel();
});

test('relative navigation uses the server scene and stops at the deck boundaries', async t => {
  const f = await fixture(); t.after(f.stop);
  await f.request('control', { action: 'navigate', index: 0 });
  await f.request('control', { action: 'step', delta: 1 });
  let current = await (await fetch(`${f.origin}/api/session`)).json();
  assert.equal(current.state.index, 1);
  await f.request('control', { action: 'navigate', index: slides.length - 1 });
  await f.request('control', { action: 'step', delta: 1 });
  current = await (await fetch(`${f.origin}/api/session`)).json();
  assert.equal(current.state.index, slides.length - 1);
  assert.equal((await f.request('control', { action: 'step', delta: 50 })).status, 400);
});

test('supports rehearsal without a key and prevents entering live mode', async t => {
  const f = await fixture({ apiKey: '' }); t.after(f.stop);
  assert.equal(f.session.apiConfigured, false);
  assert.equal((await f.request('control', { action: 'demo', value: { mode: 'live' } })).status, 400);
  assert.equal((await f.request('decide', { image: 'not-an-image' })).status, 503);
  assert.equal((await f.request('control', { action: 'demo', value: { sample: 1 } })).status, 200);
});

test('validates prompts, bounds, rubric and options before making model calls', async t => {
  const f = await fixture(); t.after(f.stop);
  for (const value of [{ threshold: 1.2 }, { interval: 50 }, { realtime:'yes' }, { options: ['same', 'same'] }, { levels: ['only one'] }, { noul: '' }, { unknown: true }]) {
    assert.equal((await f.request('control', { action: 'demo', value })).status, 400);
  }
});

test('batches hand localization with the three decision questions without exposing the API key', async t => {
  let sent;
  const f = await fixture({ apiKey: 'test-private-key', requestModel: async (url, options) => {
    sent = { url, ...options, payload: JSON.parse(options.body) };
    return Response.json({ model: 'jev-1.14.0', usage: {input_tokens:1000,output_tokens:50}, answers: { visible: { type: 'noul', noul: 0.95 }, raised: { type: 'score', score: 1.5, confidence: 0.8 }, gesture: { type: 'choice', choice: 'option_0', confidence: 0.9, probabilities: { option_0: 0.9, option_1: 0.05, option_2: 0.03, option_3: 0.02 } }, hand: { type: 'box', box: {left:0.1,top:0.2,right:0.4,bottom:0.7},confidence:0.9 } } });
  } }); t.after(f.stop);
  const demoIndex = slides.findIndex(s => s.kind === 'demo');
  await f.request('control', { action: 'navigate', index: demoIndex });
  await f.request('control', { action: 'demo', value: { mode: 'live', camera: true, paused: false } });
  const response = await f.request('decide', { image: 'data:image/jpeg;base64,/9j/2Q==' });
  assert.equal(response.status, 200);
  assert.equal(sent.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(sent.headers.Authorization, 'Bearer test-private-key');
  assert.equal(sent.headers['TypeSafe-Danger-Zone-Images'], 'true');
  assert.equal(sent.payload.assets[sent.payload.state.camera_frame].data_base64, '/9j/2Q==');
  assert.deepEqual(Object.values(sent.payload.questions).map(q => q.type), ['noul', 'score', 'choice', 'box']);
  assert.match(sent.payload.questions.hand.instructions, /human hand/);
  assert.equal(Object.hasOwn(sent.payload.questions.hand, 'criteria'), false);
  assert.equal(response.data.answers.visible.noul, 0.95);
  assert.deepEqual(response.data.answers.hand.box, {left:0.1,top:0.2,right:0.4,bottom:0.7});
  assert.deepEqual(response.data.usage,{input_tokens:1000,output_tokens:50});
  assert.equal(response.data.costs.totalCents,0.0042);
  assert.equal(response.data.costs.requests,1);
  assert.equal(JSON.stringify(f.session).includes('test-private-key'), false);
  assert.equal(JSON.stringify(response.data).includes('test-private-key'), false);
  await f.request('control', { action: 'navigate', index: 0 });
  const after = await (await fetch(`${f.origin}/api/session`)).json();
  assert.equal(after.state.demo.camera, false);
  assert.equal(after.state.demo.paused, true);
  assert.equal(after.costs.totalCents,0.0042);
  assert.equal(after.costs.requests,1);
});

test('retains billable usage when a successful model response has an unusable answer', async t => {
  const f=await fixture({apiKey:'private',requestModel:async()=>Response.json({usage:{input_tokens:2000,output_tokens:10},answers:{}})});t.after(f.stop);
  await f.request('control',{action:'navigate',index:slides.findIndex(s=>s.kind==='demo')});
  await f.request('control',{action:'demo',value:{mode:'live',camera:true,paused:false}});
  assert.equal((await f.request('decide',{image:'data:image/jpeg;base64,/9j/2Q=='})).status,502);
  const freshSession=await(await fetch(`${f.origin}/api/session`)).json();
  assert.equal(freshSession.costs.inputTokens,2000);
  assert.equal(freshSession.costs.totalCents,0.0084);
});

test('surfaces a model failure as a safe error', async t => {
  const f = await fixture({ apiKey: 'private', requestModel: async () => new Response('upstream details', { status: 401 }) }); t.after(f.stop);
  await f.request('control', { action: 'navigate', index: slides.findIndex(s => s.kind === 'demo') });
  await f.request('control', { action: 'demo', value: { mode: 'live', camera: true, paused: false } });
  const res = await f.request('decide', { image: 'data:image/jpeg;base64,/9j/2Q==' });
  assert.equal(res.status, 502);
  assert.match(res.data.error, /key was rejected/);
  assert.equal(res.data.error.includes('private'), false);
});

const frame={image:'data:image/jpeg;base64,/9j/2Q=='};
const success=()=>Response.json({usage:{input_tokens:1000,output_tokens:10},answers:{visible:{noul:0.9},raised:{score:1},gesture:{probabilities:{option_0:1}}}});
async function startLive(f) {
  await f.request('control',{action:'navigate',index:slides.findIndex(s=>s.kind==='demo')});
  await f.request('control',{action:'demo',value:{mode:'live',camera:true,paused:false,realtime:true}});
}
test('enforces the shared cap across refresh, Start, and mode changes', async t => {
  let calls=0;
  const f=await fixture({apiKey:'private',requestLimit:2,requestModel:async()=>{calls++;return success();}});t.after(f.stop);
  await startLive(f);
  assert.equal((await f.request('decide',frame)).status,200);
  assert.equal((await f.request('decide',frame)).status,200);
  const third=await f.request('decide',frame);
  assert.equal(third.status,409); assert.equal(third.data.requests.exhausted,true);
  await f.request('control',{action:'demo',value:{realtime:false}});
  const start=await f.request('control',{action:'demo',value:{camera:true,paused:false}});
  assert.equal(start.status,409);
  const fresh=await(await fetch(`${f.origin}/api/session`)).json();
  assert.equal(fresh.requests.used,2); assert.equal(fresh.state.demo.camera,false); assert.equal(fresh.state.demo.paused,true);
  assert.equal(calls,2);
});
test('failed and timed-out upstream attempts consume the cap', async t => {
  let calls=0;
  const f=await fixture({apiKey:'private',requestLimit:2,requestModel:async()=>{calls++;throw Object.assign(new Error('timeout'),{name:'TimeoutError'});}});t.after(f.stop);
  await startLive(f);
  assert.equal((await f.request('decide',frame)).status,504);
  assert.equal((await f.request('decide',frame)).status,504);
  assert.equal((await f.request('decide',frame)).status,409);
  assert.equal(calls,2);
});
test('rate-limited requests wait server-side without pausing the demo or consuming extra attempts', async t => {
  let time=1_800_000_000_000,calls=0;
  const f=await fixture({apiKey:'private',now:()=>time,requestModel:async()=>++calls===1?new Response('',{status:429,headers:{'retry-after':'2'}}):success()});t.after(f.stop);
  await startLive(f);
  const limited=await f.request('decide',frame);
  assert.equal(limited.status,503); assert.equal(limited.data.retryable,true); assert.equal(limited.data.retryAfterMs,2000);
  assert.equal((await f.request('decide',frame)).status,429); assert.equal(calls,1);
  time+=2000;
  assert.equal((await f.request('decide',frame)).status,200);
  const fresh=await(await fetch(`${f.origin}/api/session`)).json();
  assert.equal(fresh.requests.used,2); assert.equal(fresh.state.demo.paused,false);
});
test('an exhausted quota header on success blocks other tabs until its reset', async t => {
  let time=1_800_000_000_000,calls=0;
  const f=await fixture({apiKey:'private',now:()=>time,requestModel:async()=>{
    calls++; const res=success();
    if(calls===1) { res.headers.set('x-ratelimit-remaining-tokens','0');res.headers.set('x-ratelimit-reset-tokens','3s'); }
    return res;
  }});t.after(f.stop);
  await startLive(f);
  assert.equal((await f.request('decide',frame)).data.requests.retryAfterMs,3000);
  assert.equal((await f.request('decide',frame)).status,429);assert.equal(calls,1);
  time+=3000;
  assert.equal((await f.request('decide',frame)).status,200);assert.equal(calls,2);
});
test('two clients cannot start overlapping model requests or overcount the budget', async t => {
  let release,notify,calls=0;
  const started=new Promise(resolve=>{notify=resolve;});
  const f=await fixture({apiKey:'private',requestModel:async()=>{calls++;notify();await new Promise(resolve=>{release=resolve;});return success();}});t.after(f.stop);
  await startLive(f);
  const first=f.request('decide',frame);await started;
  const second=await f.request('decide',frame);
  assert.equal(second.status,429);assert.equal(second.data.retryable,true);assert.equal(calls,1);
  release();assert.equal((await first).status,200);
  assert.equal((await(await fetch(`${f.origin}/api/session`)).json()).requests.used,1);
});
