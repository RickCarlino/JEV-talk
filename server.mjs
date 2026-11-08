import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { slides, defaults } from './public/deck.js';
import { syncTalk } from './scripts/sync-talk.mjs';
import { createCostTracker, DEFAULT_INPUT_USD_PER_MILLION } from './lib/cost.mjs';
import { createRequestControl, MAX_REQUESTS } from './lib/request-control.mjs';

const publicDir = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const copy = value => structuredClone(value);

export function createTalkServer({ apiKey = process.env.TYPESAFE_API_KEY || '', model = process.env.TYPESAFE_MODEL || 'jev-1.14.0', requestModel = fetch, inputUsdPerMillion = Number(process.env.TYPESAFE_INPUT_USD_PER_MILLION || DEFAULT_INPUT_USD_PER_MILLION), requestLimit = MAX_REQUESTS, now = Date.now } = {}) {
  const token = randomBytes(24).toString('hex');
  let state = { index: 0, blackout: false, demo: { ...copy(defaults), mode: apiKey ? 'live' : 'rehearsal' }, timer: { running: false, startedAt: null, elapsed: 0 }, revision: 0 };
  let telemetry = { status: 'idle', message: '', latency: null };
  const costs = createCostTracker(inputUsdPerMillion, now);
  const requests = createRequestControl({limit:requestLimit, now});
  const clients = new Set();
  let busy = false;
  const validToken = value => typeof value === 'string' && value.length === token.length && timingSafeEqual(Buffer.from(value), Buffer.from(token));
  const broadcast = (event, data) => {
    for (const client of clients) client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const publish = () => { state.revision++; broadcast('state', state); };
  const publishRequests = () => { const status=requests.snapshot(); broadcast('requests',status); return status; };
  const stopAtLimit = () => {
    state.demo.paused = true; state.demo.camera = false;
    telemetry = {status:'paused', message:`${requestLimit.toLocaleString()}-request limit reached. Restart the server to reset.`, latency:null};
    publish(); broadcast('telemetry',telemetry); publishRequests();
  };
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  async function body(req) {
    let raw = ''; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 1_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
      raw += chunk.toString();
    }
    try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
  }
  const shortText = (value, limit = 1000) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
  const error = (message, status = 400) => Object.assign(new Error(message), { status });

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        const authorized = validToken(req.headers['x-presenter-key'] || url.searchParams.get('key'));
        if (url.pathname === '/api/session' && req.method === 'GET') {
          if (!local && !authorized) return json(res, 403, { error: 'Open the remote link from the presenter console.' });
          const port = server.address()?.port;
          const addresses = Object.values(os.networkInterfaces()).flat().filter(i => i && !i.internal && i.family === 'IPv4').map(i => `http://${i.address}:${port}/?key=${token}`);
          return json(res, 200, { key: token, apiConfigured: Boolean(apiKey), model, remoteUrls: addresses, state, telemetry, costs: costs.snapshot(), requests:requests.snapshot() });
        }
        if (!authorized) return json(res, 403, { error: 'Presenter session required. Reload the presenter console.' });
        if (url.pathname === '/api/events' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write(`event: state\ndata: ${JSON.stringify(state)}\n\nevent: telemetry\ndata: ${JSON.stringify(telemetry)}\n\n`);
          res.write(`event: costs\ndata: ${JSON.stringify(costs.snapshot())}\n\n`);
          res.write(`event: requests\ndata: ${JSON.stringify(requests.snapshot())}\n\n`);
          clients.add(res);
          const ping = setInterval(() => res.write(': heartbeat\n\n'), 20000);
          req.on('close', () => { clients.delete(res); clearInterval(ping); });
          return;
        }
        if (url.pathname === '/api/control' && req.method === 'POST') {
          const data = await body(req);
          if (data.action === 'navigate' || data.action === 'step') {
            if (data.action === 'step' && ![-1, 1].includes(data.delta)) throw error('Invalid direction.');
            const index = data.action === 'step' ? Math.max(0, Math.min(slides.length - 1, state.index + data.delta)) : data.index;
            if (!Number.isInteger(index) || index < 0 || index >= slides.length) throw error('Invalid scene.');
            state.index = index;
            if (slides[state.index].kind !== 'demo') { state.demo.camera = false; state.demo.paused = true; }
          } else if (data.action === 'blackout') state.blackout = Boolean(data.value);
          else if (data.action === 'demo') {
            const next = data.value;
            if (!next || typeof next !== 'object' || Array.isArray(next)) throw error('Invalid demo settings.');
            const allowed = new Set(Object.keys(defaults));
            if (Object.keys(next).some(key => !allowed.has(key))) throw error('Unknown demo setting.');
            const d = { ...state.demo, ...next };
            if (!['live', 'rehearsal'].includes(d.mode)) throw error('Invalid mode.');
            if (d.mode === 'live' && !apiKey) throw error('Add TYPESAFE_API_KEY to .env and restart the server.');
            if (typeof d.camera !== 'boolean' || typeof d.paused !== 'boolean') throw error('Invalid camera state.');
            if (typeof d.realtime !== 'boolean') throw error('Invalid realtime setting.');
            if (d.mode === 'live' && !d.paused && requests.snapshot().exhausted) {
              stopAtLimit();
              return json(res,409,{error:telemetry.message,requests:requests.snapshot()});
            }
            if (!Number.isFinite(d.threshold) || d.threshold < 0 || d.threshold > 1) throw error('Threshold must be between 0 and 1.');
            if (!Number.isInteger(d.interval) || d.interval < 1000 || d.interval > 10000) throw error('Frame interval must be 1000–10000 ms.');
            if (![d.noul, d.score, d.choice].every(v => shortText(v))) throw error('Each question needs 1–1000 characters.');
            if (!Array.isArray(d.levels) || d.levels.length < 2 || d.levels.length > 10 || !d.levels.every(v => shortText(v, 200))) throw error('Provide 2–10 nonempty score levels.');
            if (!Array.isArray(d.options) || d.options.length < 2 || d.options.length > 8 || !d.options.every(v => shortText(v, 100))) throw error('Provide 2–8 nonempty choices.');
            if (new Set(d.options).size !== d.options.length) throw error('Choices must be unique.');
            if (!Number.isInteger(d.sample) || d.sample < 0 || d.sample > 2) throw error('Invalid rehearsal sample.');
            state.demo = d;
          } else if (data.action === 'timer') {
            const t = state.timer;
            if (data.command === 'reset') state.timer = { running: false, startedAt: null, elapsed: 0 };
            else if (data.command === 'toggle') {
              if (t.running) { t.elapsed += Date.now() - t.startedAt; t.startedAt = null; t.running = false; }
              else { t.running = true; t.startedAt = Date.now(); }
            } else throw error('Invalid timer command.');
          } else throw error('Unknown action.');
          publish();
          return json(res, 200, { ok: true, revision: state.revision });
        }
        if (url.pathname === '/api/telemetry' && req.method === 'POST') {
          const data = await body(req);
          telemetry = { status: ['idle', 'camera', 'paused', 'error', 'running'].includes(data.status) ? data.status : 'idle', message: typeof data.message === 'string' ? data.message.slice(0, 300) : '', latency: Number.isFinite(data.latency) ? data.latency : null };
          broadcast('telemetry', telemetry);
          return json(res, 200, { ok: true });
        }
        if (url.pathname === '/api/decide' && req.method === 'POST') {
          if (!apiKey) throw error('Add TYPESAFE_API_KEY to .env and restart the server.', 503);
          if (requests.snapshot().exhausted) { stopAtLimit(); return json(res,409,{error:telemetry.message,requests:requests.snapshot()}); }
          if (slides[state.index].kind !== 'demo' || state.demo.mode !== 'live' || state.demo.paused || !state.demo.camera) throw error('Start the live camera demo first.', 409);
          const data = await body(req);
          if (typeof data.image !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.image) || data.image.length > 800000) throw error('Expected a JPEG frame smaller than 600 KB.');
          if (slides[state.index].kind !== 'demo' || state.demo.mode !== 'live' || state.demo.paused || !state.demo.camera) throw error('Start the live camera demo first.', 409);
          if (busy) {
            const status=requests.snapshot();
            const deadline=Math.max(status.nextAllowedAt,now()+100);
            return json(res,429,{error:'Waiting for the previous frame.',retryable:true,retryAfterMs:deadline-now(),requests:{...status,nextAllowedAt:deadline,retryAfterMs:deadline-now()}});
          }
          const reservation=requests.reserve({realtime:state.demo.realtime});
          if (!reservation.ok) {
            if (reservation.reason === 'limit') { stopAtLimit(); return json(res,409,{error:telemetry.message,requests:requests.snapshot()}); }
            res.setHeader('Retry-After',String(Math.ceil(reservation.status.retryAfterMs/1000)));
            return json(res,429,{error:'Waiting for Jev rate limit.',retryable:true,retryAfterMs:reservation.status.retryAfterMs,requests:reservation.status});
          }
          busy = true; publishRequests();
          try {
            const d = copy(state.demo);
            const ref = randomUUID();
            const payload = {
              model, state: { camera_frame: ref },
              assets: { [ref]: { type: 'image', format: 'jpeg', data_base64: data.image.split(',')[1] } },
              questions: {
                visible: { type: 'noul', instructions: d.noul },
                raised: { type: 'score', instructions: d.score, criteria: d.levels },
                gesture: { type: 'choice', instructions: d.choice, criteria: Object.fromEntries(d.options.map((label, i) => [`option_${i}`, label])) },
                hand: { type: 'box', instructions: 'The most visible human hand in `camera_frame`. Enclose the whole hand, including the fingers and palm.' }
              }
            };
            const start = performance.now();
            const costStartedAt = now();
            const upstream = await requestModel('https://api.typesafe.ai/v1/systemone', {
              method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'TypeSafe-Danger-Zone-Images': 'true' },
              body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)
            });
            const rate = requests.observe(upstream.headers,upstream.status);
            publishRequests();
            if (!upstream.ok) {
              if (rate.retryable) {
                await upstream.body?.cancel();
                res.setHeader('Retry-After',String(Math.ceil(rate.status.retryAfterMs/1000)));
                return json(res,503,{error:'Jev rate limit or temporary overload. Retrying after the cooldown.',retryable:true,retryAfterMs:rate.status.retryAfterMs,requests:rate.status});
              }
              const detail = upstream.status === 401 ? 'The API key was rejected.' : upstream.status === 429 ? 'TypeSafe rate limit reached. Pause and try again.' : `TypeSafe returned HTTP ${upstream.status}.`;
              throw error(detail, 502);
            }
            const result = await upstream.json();
            // Count reported usage even if the answer format cannot be displayed.
            const costSnapshot = costs.record(result.usage, costStartedAt);
            broadcast('costs', costSnapshot);
            const a = result.answers;
            if (!a || !Number.isFinite(a.visible?.noul) || !Number.isFinite(a.raised?.score) || !a.gesture?.probabilities || !Object.values(a.gesture.probabilities).every(Number.isFinite)) throw error('TypeSafe returned an unexpected answer format.', 502);
            const latency = Math.round(performance.now() - start);
            telemetry = { status: 'running', message: 'Live Jev', latency };
            broadcast('telemetry', telemetry);
            return json(res, 200, { answers: a, model: result.model || model, latency, usage: result.usage || null, costs: costSnapshot, requests:requests.snapshot(), options: d.options, levels: d.levels, questions: { noul: d.noul, score: d.score, choice: d.choice } });
          } catch (e) {
            if (e.name === 'TimeoutError') throw error('The model request timed out. Retry or switch to rehearsal.', 504);
            if (e.status) throw e;
            throw error('Could not reach TypeSafe. Check the connection or switch to rehearsal.', 502);
          } finally { busy = false; if (requests.snapshot().exhausted) stopAtLimit(); }
        }
        return json(res, 404, { error: 'Unknown endpoint.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
      const name = ['/', '/stage', '/presenter'].includes(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      const filename = path.resolve(publicDir, name);
      if (!filename.startsWith(publicDir + path.sep) || name.split('/').some(p => p.startsWith('.'))) return json(res, 404, { error: 'Not found.' });
      const data = await readFile(filename);
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': name.startsWith('assets/') ? 'public, max-age=86400' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) {
      if (!res.headersSent) json(res, e.status || (e.code === 'ENOENT' ? 404 : 500), { error: e.status ? e.message : e.code === 'ENOENT' ? 'Not found.' : 'An unexpected server error occurred.' });
      else res.end();
    }
  });
  let reloadTimer;
  const watcher = watch(publicDir, { recursive: true }, () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => broadcast('reload', {}), 180);
  });
  watcher.unref();
  const readmeWatcher = watch(new URL('./README.md', import.meta.url), () => { syncTalk().catch(() => {}); });
  readmeWatcher.unref();
  server.on('close', () => { watcher.close(); readmeWatcher.close(); clearTimeout(reloadTimer); for (const client of clients) client.end(); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createTalkServer().listen(port, host, () => {
    console.log(`\n  Decision models · working deck\n  Presenter: http://localhost:${port}\n  Audience:  http://localhost:${port}/stage\n  API: ${process.env.TYPESAFE_API_KEY ? 'configured' : 'rehearsal (set TYPESAFE_API_KEY in .env for live calls)'}\n`);
  });
}
