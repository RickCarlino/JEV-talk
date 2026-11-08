import { renderLiveLinks, createLivePagePanel, copyCoinImage } from './live-pages.js';
import { slides, rehearsals, defaults } from './deck.js';
import { requestCamera, cameraErrorMessage } from './camera.js';
import { visibleHandBox, projectHandBox } from './hand-box.js';
import { formatCost, formatCostRate } from './cost.js';
import { nextInferenceDelay } from './cadence.js';
import { renderGestureChoices, selectedChoiceIndex } from './gesture-choices.js';
import { createVideoStudio } from './studio.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = n => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
const num = n => String(n + 1).padStart(2, '0');
const icons = {
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>', left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  play: '<path d="m9 5 11 7-11 7z"/>', pause: '<path d="M9 5v14M15 5v14"/>', reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  screen: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  black: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m4 4 16 16"/>',
  camera: '<rect x="3" y="6" width="13" height="13" rx="2"/><path d="m16 10 5-3v11l-5-3"/>',
  link: '<path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 0) scale(.85)"/>',
  check: '<path d="m5 12 4 4 10-10"/>', settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const stageMode = location.pathname === '/stage';
let session, state, telemetry, events, currentIndex = -1, inspectorTab = 'notes';
let cameraStream = null, cameraPending = false, cameraVersion = 0, inferenceTimer, requesting = false, lastResult = null, resultSignature = '', toastTimer;
let resultTimes = [];
let previewChannel;
let settingsOpen = false;
let openLivePages;
let cameraFailed = false;
let lastHandBox = null, lastFrameGeometry = null, previewHandBox = null, boxObserver;
let costTotals;
let requestStatus;
let controlQueue = Promise.resolve();
let studio, studioChannel, studioStatus, audienceWindow, lastStudioSeen = 0;
const demoSignature = d => JSON.stringify([d.mode, d.noul, d.score, d.choice, d.levels, d.options]);

async function api(route, data) {
  const res = await fetch(`/api/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Presenter-Key': session.key }, body: JSON.stringify(data)
  });
  const result = await res.json();
  if (result.requests) updateRequestStatus(result.requests);
  if (!res.ok) throw Object.assign(new Error(result.error || 'Request failed.'), { status:res.status, retryable:result.retryable, retryAfterMs:result.retryAfterMs });
  if (result.costs) updateCost(result.costs);
  return result;
}
function control(data) {
  const request = controlQueue.then(() => api('control', data));
  controlQueue = request.catch(() => {});
  return request.catch(e => { toast(e.message); });
}
function toast(message) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 6000);
}
function go(index) { if (index >= 0 && index < slides.length) control({ action: 'navigate', index }); }
function step(delta) { control({ action: 'step', delta }); }
function runDemo() {
  if (session.apiConfigured && requestStatus?.exhausted) { toast(`${requestStatus.limit.toLocaleString()}-request limit reached.`); return; }
  if (!state.demo.paused) return control({ action: 'demo', value: { paused: true } });
  if (!stageMode && !studioStatus) openStage();
  if (slides[state.index].kind !== 'demo') go(slides.findIndex(slide => slide.kind === 'demo'));
  resultTimes = [];
  return control({ action: 'demo', value: { mode: session.apiConfigured ? 'live' : 'rehearsal', camera: true, paused: false, interval: 1000 } });
}
function imageMarkup(slide, cls = '') {
  return `<img class="scene-image ${slide.treatment} ${cls}" src="/assets/${slide.image}" alt="${h(slide.alt)}" style="object-position:${slide.position}" draggable="false">`;
}

function buildPresenter() {
  document.title = 'Decision models · Presenter';
  $('#app').innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="Decision models presenter"><span class="brand-mark">d<span>m</span></span><span class="brand-name">Decision models<span>A meetup talk, in progress</span></span></a>
      <div class="header-actions"><span id="connection" class="connection"><i></i>Connected</span><button class="button quiet" id="video-draft">${icon('camera')}<span>Video draft</span></button><button class="button quiet remote-button" id="remote">${icon('link')}<span>Remote control</span></button><button class="button primary" id="open-stage">${icon('screen')}<span>Open audience view</span>${icon('arrow')}</button></div>
    </header>
    <div class="workspace">
      <aside class="outline"><div class="outline-heading"><span>THE RUN OF SHOW</span><span>${slides.length}</span></div><nav aria-label="Talk scenes">${slides.map((s, i) => `<button class="scene-link" data-slide="${i}"><span class="scene-number">${num(i)}</span><span>${h(s.label || s.title)}</span>${s.kind === 'demo' ? '<span class="live-mark">LIVE</span>' : ''}</button>`).join('')}</nav><div class="outline-bottom"><span class="draft-dot"></span> Working draft <span>~20 min</span></div></aside>
      <main class="main-workspace">
        <div class="scene-heading"><div><div class="eyebrow" id="chapter"></div><h1 id="scene-title"></h1></div><span id="scene-time" class="scene-time"></span></div>
        <div class="preview-shell"><div id="current-preview" class="preview" aria-label="Current audience scene"></div><div class="preview-bar"><span><i class="audience-dot"></i> AUDIENCE VIEW</span><button id="preview-open" class="text-button">Open ${icon('arrow')}</button></div></div>
        <div class="below-preview"><div class="next-preview" id="next-preview"></div><div class="presenter-tip"><span class="eyebrow">ONE IDEA TO LAND</span><p id="takeaway"></p></div></div>
        <div class="keyboard-hint"><kbd>←</kbd><kbd>→</kbd> change scene <span></span><kbd>B</kbd> blackout <span></span><kbd>F</kbd> fullscreen</div>
      </main>
      <aside class="inspector"><div class="inspector-tabs" role="tablist" aria-label="Presenter tools"><button id="notes-tab" role="tab" aria-selected="true">Speaker notes</button><button id="demo-tab" role="tab" aria-selected="false">${icon('settings')} Demo</button></div><div id="inspector-content"></div></aside>
    </div>
    <footer class="transport"><div class="transport-scene"><span class="eyebrow">SCENE</span><span><b id="current-number">01</b><span class="muted"> / ${slides.length}</span></span></div><div class="transport-controls"><button class="icon-button" id="previous" aria-label="Previous scene">${icon('left')}</button><div class="progress-track"><div id="progress"></div></div><button class="icon-button next-button" id="next" aria-label="Next scene">${icon('right')}</button></div><div class="timer-controls"><span id="timer" aria-label="Talk elapsed time">00:00</span><button class="icon-button" id="timer-toggle" aria-label="Start timer">${icon('play')}</button><button class="icon-button" id="timer-reset" aria-label="Reset timer">${icon('reset')}</button><span class="footer-divider"></span><button class="icon-button" id="blackout" aria-label="Toggle audience blackout" aria-pressed="false">${icon('black')}</button><button class="icon-button" id="fullscreen" aria-label="Toggle fullscreen">${icon('expand')}</button></div></footer>
    <dialog id="remote-dialog"><div class="dialog-heading"><h2>Take the controls with you.</h2><button class="icon-button" id="close-remote" aria-label="Close remote control dialog">${icon('close')}</button></div><p>Open this presenter view in another tab or device. All views follow the same scene.</p><label for="remote-url">Presenter link</label><div class="copy-row"><input id="remote-url" readonly><button class="button primary" id="copy-url">Copy</button></div><p class="small muted">For another device, set HOST=0.0.0.0 in .env, restart, and use the same Wi-Fi. The camera runs in the audience window on this computer. Keep this control link private.</p><div id="copy-status" role="status"></div></dialog>`;
  $$('[data-slide]').forEach(button => button.addEventListener('click', () => go(Number(button.dataset.slide))));
  $('.brand').href = `/?key=${session.key}`;
  $('#open-stage').onclick = openStage; $('#preview-open').onclick = openStage;
  $('#video-draft').onclick = () => {
    if (studioStatus?.recording) studioChannel.postMessage({ type: 'stop' });
    else if (studioStatus) { studioChannel.postMessage({ type: 'open' }); audienceWindow?.focus(); }
    else openStage(true);
  };
  $('#previous').onclick = () => step(-1); $('#next').onclick = () => step(1);
  $('#blackout').onclick = () => control({ action: 'blackout', value: !state.blackout });
  $('#fullscreen').onclick = fullscreen;
  $('#timer-toggle').onclick = () => control({ action: 'timer', command: 'toggle' });
  $('#timer-reset').onclick = () => control({ action: 'timer', command: 'reset' });
  $('#notes-tab').onclick = () => { inspectorTab = 'notes'; renderInspector(); };
  $('#demo-tab').onclick = () => { inspectorTab = 'demo'; renderInspector(); };
  $('#remote').onclick = () => {
    $('#remote-url').value = session.remoteUrls[0] || `${location.origin}/?key=${session.key}`;
    $('#remote-dialog').showModal();
  };
  $('#close-remote').onclick = () => $('#remote-dialog').close();
  $('#copy-url').onclick = async () => {
    try { await navigator.clipboard.writeText($('#remote-url').value); $('#copy-status').textContent = 'Copied. Open it on your other device.'; }
    catch { $('#remote-url').select(); $('#copy-status').textContent = 'Select and copy the link above.'; }
  };
  $('#remote-dialog').addEventListener('click', e => { if (e.target === $('#remote-dialog')) $('#remote-dialog').close(); });
  addCostIndicator($('.preview-bar'), $('#preview-open'));
}

function renderPresenter(changed) {
  const slide = slides[state.index];
  if (changed) {
    $('#chapter').textContent = `${num(state.index)} / ${slides.length}`;
    $('#scene-title').textContent = slide.title;
    $('#scene-time').hidden = !slide.duration;
    $('#scene-time').textContent = slide.duration ? `${slide.duration} planned` : '';
    $('#current-preview').innerHTML = slide.kind === 'demo' ? `<div class="demo-preview"><img id="demo-preview-image" hidden alt="Live camera preview"><button class="button primary demo-launch" id="launch-demo">${icon('play')} Start demo</button><span id="preview-demo-status" class="demo-preview-caption">Show your hand.</span></div>` : imageMarkup(slide);
    if ($('#launch-demo')) $('#launch-demo').onclick = runDemo;
    if (slide.kind === 'demo') {
      const overlay = document.createElement('div');
      overlay.id = 'preview-hand-box'; overlay.className = 'hand-box'; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
      $('.demo-preview').append(overlay);
    }
    observeHandBoxContainer();
    const next = slides[state.index + 1];
    $('#next-preview').innerHTML = next ? `<div class="next-image">${imageMarkup(next)}</div><div><span class="eyebrow">UP NEXT · ${num(state.index + 1)}</span><p>${h(next.title)}</p><span class="muted small">${h(next.chapter)}</span></div>` : '<div><span class="eyebrow">END OF THE TALK</span><p>Leave room for questions.</p></div>';
    $('#takeaway').textContent = slide.takeaway || '';
    $('.presenter-tip').hidden = !slide.takeaway;
    $$('[data-slide]').forEach((el, i) => { el.classList.toggle('selected', i === state.index); if (i === state.index) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
    $('.scene-link.selected').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    renderInspector();
    $('#inspector-content').scrollTop = 0;
  }
  $('#current-number').textContent = num(state.index);
  $('#progress').style.width = `${((state.index + 1) / slides.length) * 100}%`;
  $('#previous').disabled = state.index === 0; $('#next').disabled = state.index === slides.length - 1;
  $('#blackout').setAttribute('aria-pressed', state.blackout);
  $('#current-preview').classList.toggle('blacked-out', state.blackout);
  $('#timer-toggle').innerHTML = icon(state.timer.running ? 'pause' : 'play');
  $('#timer-toggle').setAttribute('aria-label', state.timer.running ? 'Pause timer' : 'Start timer');
  if (slide.kind === 'demo' && $('#launch-demo')) {
    $('#launch-demo').hidden = false;
    $('#launch-demo').innerHTML = `${icon(state.demo.paused ? 'play' : 'pause')} ${state.demo.paused ? 'Start demo' : 'Pause'}`;
    $('.demo-preview').classList.toggle('has-feed', state.demo.camera);
    if (!state.demo.camera) $('#demo-preview-image').hidden = true;
  }
  if (!changed && inspectorTab === 'demo' && !($('#inspector-content').contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) renderInspector();
  updateTelemetry();
  renderHandBoxes();
  updateRequestStatus();
  if ($('#demo-cost')) $('#demo-cost').hidden = slide.kind !== 'demo';
}

function renderInspector() {
  $('#notes-tab').setAttribute('aria-selected', inspectorTab === 'notes'); $('#demo-tab').setAttribute('aria-selected', inspectorTab === 'demo');
  const slide = slides[state.index];
  if (inspectorTab === 'notes') {
    $('#inspector-content').innerHTML = `<div class="notes-content"><div class="eyebrow notes-label">SPEAKING NOTES</div><div class="speaking-notes">${slide.notes.map((p, i) => `<p${i === 0 && !/https?:\/\//.test(p) ? ' class="lead-note"' : ''}>${h(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`).join('')}</div>${slide.sources.length ? `<details class="sources"><summary>Sources & things to share <span>${slide.sources.length}</span></summary>${slide.sources.map(s => `<a href="${s.url}" target="_blank" rel="noreferrer">${h(s.label)}${icon('arrow')}</a>`).join('')}</details>` : ''}</div>`;
    addSlideResources(slide);
    return;
  }
  const d = state.demo;
  $('#inspector-content').innerHTML = `<div class="demo-controls"><div class="demo-actions"><button class="button primary" id="pause-demo">${icon(d.paused ? 'play' : 'pause')}${d.paused ? 'Start demo' : 'Pause'}</button><button class="button" id="camera-toggle" ${d.camera ? '' : 'hidden'}>Stop</button></div><p class="demo-instruction">Show your hand.</p><div id="demo-status" class="demo-status" role="status"></div><details class="demo-settings" ${settingsOpen ? 'open' : ''}><summary>${icon('settings')} Settings</summary><div class="mode-toggle" role="group" aria-label="Demo mode"><button id="live-mode" aria-pressed="${d.mode === 'live'}" ${session.apiConfigured ? '' : 'disabled'}>Live Jev</button><button id="rehearsal-mode" aria-pressed="${d.mode === 'rehearsal'}">Sample data</button></div>${d.mode === 'rehearsal' ? `<label class="field-label" for="sample">Sample</label><select id="sample">${rehearsals.map((sample, i) => `<option value="${i}" ${i === d.sample ? 'selected' : ''}>${sample.name}</option>`).join('')}</select>` : ''}<form id="questions-form"><div class="question-group"><div class="question-title"><h3>Noul</h3></div><label class="sr-only" for="noul">Noul question</label><textarea id="noul" rows="2" maxlength="1000" required>${h(d.noul)}</textarea><label class="threshold-label" for="threshold">Threshold <output id="threshold-value">${pct(d.threshold)}</output></label><input type="range" id="threshold" min="0" max="1" step="0.01" value="${d.threshold}"></div><div class="question-group"><div class="question-title"><h3>Score</h3></div><label class="sr-only" for="score">Score question</label><textarea id="score" rows="2" maxlength="1000" required>${h(d.score)}</textarea><label class="field-label" for="levels">Levels · one per line</label><textarea id="levels" rows="3" required>${h(d.levels.join('\n'))}</textarea></div><div class="question-group"><div class="question-title"><h3>Choice</h3></div><label class="sr-only" for="choice">Choice question</label><textarea id="choice" rows="2" maxlength="1000" required>${h(d.choice)}</textarea><label class="field-label" for="options">Options · one per line</label><textarea id="options" rows="4" required>${h(d.options.join('\n'))}</textarea></div><button type="submit" class="button primary apply-button">Apply</button><div id="form-status" role="status" class="small"></div></form><p class="privacy-note">Camera runs in the audience window. Live frames go to TypeSafe. Images are experimental.</p></details></div>`;
  $('.demo-settings').ontoggle = e => { settingsOpen = e.target.open; };
  const cadence = document.createElement('div'); cadence.className = 'cadence-control';
  cadence.innerHTML = `<label class="realtime-toggle"><input id="realtime-toggle" type="checkbox" ${d.realtime ? 'checked' : ''}>Realtime</label><span id="request-count" class="request-count"></span>`;
  $('.demo-actions').after(cadence);
  $('#realtime-toggle').onchange = e => control({action:'demo',value:{realtime:e.target.checked}});
  $('#pause-demo').onclick = runDemo;
  $('#camera-toggle').onclick = () => control({ action: 'demo', value: { camera: false, paused: true } });
  $('#rehearsal-mode').onclick = () => control({ action: 'demo', value: { mode: 'rehearsal', camera: false, paused: true } });
  $('#live-mode').onclick = () => control({ action: 'demo', value: { mode: 'live', paused: true } });
  if ($('#sample')) $('#sample').onchange = e => control({ action: 'demo', value: { sample: Number(e.target.value) } });
  $('#threshold').oninput = e => { $('#threshold-value').textContent = pct(Number(e.target.value)); };
  $('#threshold').onchange = e => control({ action: 'demo', value: { threshold: Number(e.target.value) } });
  $('#questions-form').onsubmit = async e => {
    e.preventDefault();
    const button = $('button[type=submit]', e.target); button.disabled = true;
    const result = await control({ action: 'demo', value: {
      noul: $('#noul').value.trim(), score: $('#score').value.trim(), choice: $('#choice').value.trim(),
      levels: $('#levels').value.split('\n').map(v => v.trim()).filter(Boolean), options: $('#options').value.split('\n').map(v => v.trim()).filter(Boolean)
    } });
    if (button.isConnected) { button.disabled = false; $('#form-status').textContent = result ? 'Applied.' : 'Not applied.'; }
  };
  updateTelemetry();
  updateRequestStatus();
}

function addSlideResources(slide) {
  if (!slide.livePages?.length && !slide.coin) return;
  const resources = document.createElement('section'); resources.className = 'slide-resources';
  if (slide.livePages?.length) {
    const hint = document.createElement('p'); hint.className = 'small muted';
    hint.textContent = 'Open the live page from the audience window on the projected display. These links open on this screen.';
    resources.append(hint);
    const links = document.createElement('div'); links.className = 'live-page-list';
    renderLiveLinks(links, slide.livePages); resources.append(links);
  }
  if (slide.coin) {
    resources.insertAdjacentHTML('beforeend', `<img class="coin-reference" src="/assets/coin.jpg" alt="Coin example for pasting into the live playground"><div class="coin-actions"><button class="button" id="copy-coin">Copy coin image</button><a class="button" href="/assets/coin.jpg" download="coin.jpg">Download coin.jpg</a><a class="text-button" href="/assets/coin.jpg" target="_blank" rel="noopener noreferrer">Open image ↗</a></div><p class="small muted" id="coin-status" role="status">Paste into the playground, or drag in the downloaded file.</p>`);
  }
  $('#inspector-content').prepend(resources);
  if ($('#copy-coin')) $('#copy-coin').onclick = async () => {
    try { await copyCoinImage(); $('#coin-status').textContent = 'Copied. Paste into the playground.'; }
    catch { if ($('#coin-status')) $('#coin-status').textContent = 'Clipboard unavailable. Download coin.jpg and drag it into the playground.'; }
  };
}

function updateTelemetry() {
  if (!stageMode && $('#demo-status')) $('#demo-status').textContent = telemetry?.message || (state.demo.camera ? 'Waiting for the audience camera…' : 'Open the audience view to use the camera.');
}
function addCostIndicator(container, before = null) {
  const indicator = document.createElement('span');
  indicator.id = 'demo-cost'; indicator.className = 'cost-indicator';
  container.insertBefore(indicator, before);
  updateCost();
}
function updateCost(next) {
  if (next && (!costTotals || next.requests >= costTotals.requests)) costTotals = next;
  const indicator = $('#demo-cost');
  if (!indicator) return;
  indicator.innerHTML = `<span>${formatCost(costTotals)}</span><span class="cost-rate">${formatCostRate(costTotals)}</span>`;
  const missing = costTotals?.missingUsageRequests || 0;
  indicator.title = `Estimated USD cost since server start. ${costTotals?.requests || 0} requests; ${(costTotals?.inputTokens || 0).toLocaleString()} input tokens at $${costTotals?.inputUsdPerMillion ?? '—'} per million. Output is free.${missing ? ` Usage unavailable for ${missing} request(s); total is incomplete.` : ''}`;
  indicator.title += ' Rate is estimated US cents per minute over the last 60 seconds, or elapsed time since the first request during warm-up.';
  indicator.setAttribute('aria-label', `Estimated API spend in US cents: ${formatCost(costTotals)}; last minute: ${formatCostRate(costTotals)}`);
}
function updateRequestStatus(next) {
  if (next && (!requestStatus || next.used >= requestStatus.used)) requestStatus = {...next,nextAllowedAt:Math.max(next.nextAllowedAt || 0,requestStatus?.nextAllowedAt || 0,next.retryAfterMs > 0 ? Date.now()+next.retryAfterMs : 0)};
  if (!requestStatus) return;
  if ($('#request-count')) {
    $('#request-count').textContent = `${requestStatus.used.toLocaleString()} / ${requestStatus.limit.toLocaleString()}`;
    $('#request-count').title = 'Outbound Jev requests since server start. Failures and retries count toward the limit.';
  }
  const capped = requestStatus.exhausted && session?.apiConfigured;
  for (const button of $$('#launch-demo, #pause-demo, #enable-camera, #stage-run')) {
    button.disabled = Boolean(capped);
    if (capped) button.textContent = 'Limit reached';
  }
  const waiting = !state?.demo.paused && requestStatus.nextAllowedAt > Date.now();
  const seconds = Math.ceil((requestStatus.nextAllowedAt - Date.now()) / 1000);
  const message = capped ? `${requestStatus.limit.toLocaleString()}-request limit reached.` : waiting ? `Rate limited · retrying in ${seconds}s` : null;
  if ($('#camera-message') && capped) $('#camera-message').textContent = message;
  if (stageMode && $('#enable-camera')) {
    $('#enable-camera').hidden = Boolean(capped);
    if (capped) $('#camera-message').textContent = `${requestStatus.limit.toLocaleString()} requests`;
  }
  if ($('#demo-state') && slides[state.index].kind === 'demo') {
    $('#demo-state').textContent = message || (state.demo.mode === 'rehearsal' ? `Sample: ${rehearsals[state.demo.sample].name}` : state.demo.paused ? 'Paused' : 'Show your hand.');
  }
  if ($('#demo-status') && message) $('#demo-status').textContent = message;
  updateAudienceRate();
}
function updateAudienceRate() {
  if (!stageMode || !$('#latency') || !state) return;
  const fps = resultTimes.length > 1 ? (resultTimes.length-1)*1000/(resultTimes.at(-1)-resultTimes[0]) : null;
  const waiting = !state.demo.paused && requestStatus?.nextAllowedAt > Date.now();
  $('#latency').textContent = requestStatus?.exhausted ? 'Stopped' : state.demo.mode === 'rehearsal' ? 'Sample' : waiting ? `Waiting ${Math.ceil((requestStatus.nextAllowedAt-Date.now())/1000)}s` : state.demo.paused && state.demo.camera ? 'Paused' : fps ? `${fps.toFixed(1)} FPS` : '— FPS';
}
function openStage(videoDraft = false) {
  // Event listeners pass a MouseEvent; only an explicit true opens the studio.
  // Retrieve the named window without navigating it: a presenter reload must
  // not interrupt the audience camera or an ongoing recording.
  if (!audienceWindow || audienceWindow.closed) audienceWindow = window.open('', 'jev-audience-display');
  if (audienceWindow && !audienceWindow.closed) {
    if (audienceWindow.location.href === 'about:blank') {
      audienceWindow.location.href = `/stage?key=${session.key}${videoDraft === true ? '&studio=1' : ''}`;
      return;
    }
    audienceWindow.focus();
    if (videoDraft === true) studioChannel?.postMessage({ type: 'open' });
    return;
  }
  toast('Allow popups to open the audience window.');
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => toast('Use your browser’s fullscreen control.'));
}

function buildStage() {
  document.body.classList.add('stage-body'); document.title = 'Decision models · Audience';
  $('#app').innerHTML = `<main class="stage" id="stage"><div class="stage-photo" id="stage-photo"></div><section class="live-demo" id="live-demo" hidden><div class="demo-topline"><span><i></i><b id="demo-mode-label">REHEARSAL</b><span id="demo-subtitle">Fixed sample answers</span></span><span id="latency">—</span></div><div class="demo-layout"><div class="camera-area"><video id="camera-video" autoplay playsinline muted></video><div class="camera-empty" id="camera-empty">${icon('camera')}<button id="enable-camera" class="button primary">Start demo</button><p id="camera-message">Show your hand.</p></div><div id="camera-caption" class="camera-caption">CAMERA INPUT</div><div id="demo-pause-label" class="pause-label" hidden>Paused</div></div><div class="demo-results"><div class="result-block"><div class="result-heading"><span>Has hand?</span><b id="noul-policy">—</b></div><p id="noul-question"></p><div class="noul-number" id="noul-number">—</div><div class="probability-track"><div id="noul-fill"></div><i id="threshold-marker"></i></div><div class="range-labels"><span>0</span><span id="policy-label">Threshold 70%</span><span>1</span></div></div><div class="result-block"><div class="result-heading"><span>Hand height</span><span id="score-confidence">—</span></div><p id="score-question"></p><div class="score-number" id="score-number">—</div><div class="score-track"><i id="score-marker"></i></div><div class="range-labels"><span id="score-low">0</span><span id="score-high">2</span></div></div><div class="result-block choice-block"><div class="result-heading"><span>03 / CHOICE</span><span id="choice-confidence">—</span></div><p id="choice-question"></p><div id="choice-bars"></div></div></div></div><div class="demo-bottom"><span id="demo-state">Rehearsal · sample values, no model calls</span><button class="text-button" id="stage-run">Run demo</button></div></section><div id="black-screen" class="black-screen" hidden></div></main><div class="stage-toolbar"><button class="icon-button" id="stage-prev" aria-label="Previous scene">${icon('left')}</button><button class="icon-button" id="stage-next" aria-label="Next scene">${icon('right')}</button><button class="icon-button" id="stage-black" aria-label="Toggle blackout">${icon('black')}</button><button class="icon-button" id="stage-full" aria-label="Fullscreen">${icon('expand')}</button><a class="icon-button" href="/" target="_blank" aria-label="Open presenter view">${icon('screen')}</a></div>`;
  $('#stage-prev').onclick = () => step(-1); $('#stage-next').onclick = () => step(1);
  $('.stage-toolbar a').href = `/?key=${session.key}`;
  $('#stage-black').onclick = () => control({ action: 'blackout', value: !state.blackout }); $('#stage-full').onclick = fullscreen;
  $('#enable-camera').onclick = runDemo;
  $('#stage-run').onclick = runDemo;
  const metrics = document.createElement('div'); metrics.className = 'demo-metrics';
  $('.demo-topline').append(metrics); metrics.append($('#latency'));
  addCostIndicator(metrics);
  $$('.result-heading > span:first-child').forEach((label,index)=>{label.textContent=['Has hand?','Hand height','Choice'][index];});
  const scoreValue=document.createElement('div');scoreValue.className='score-value';
  $('#score-number').before(scoreValue);scoreValue.append($('#score-number'));
  const maximum=document.createElement('span');maximum.id='score-maximum';scoreValue.append(maximum);
  const choiceValue=document.createElement('div');choiceValue.id='choice-value';choiceValue.className='choice-value';
  $('#choice-bars').before(choiceValue);
  const choices=document.createElement('div'); choices.id='gesture-choices'; choices.className='gesture-choices';
  choices.setAttribute('role','list'); choices.setAttribute('aria-label','Available choices');
  choiceValue.before(choices);
  const counter = document.createElement('span'); counter.id = 'request-count'; counter.className = 'request-count';
  $('.demo-bottom').insertBefore(counter, $('#stage-run'));
  const overlay = document.createElement('div');
  overlay.id = 'hand-box'; overlay.className = 'hand-box'; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
  $('.camera-area').append(overlay);
  observeHandBoxContainer();
  document.addEventListener('pointermove', () => { document.body.classList.add('toolbar-visible'); clearTimeout(window.toolbarTimer); window.toolbarTimer = setTimeout(() => document.body.classList.remove('toolbar-visible'), 2000); });
  const studioButton = document.createElement('button');
  studioButton.className = 'studio-open'; studioButton.textContent = 'Video draft';
  studioButton.setAttribute('aria-label', 'Open video draft settings');
  document.body.append(studioButton);
  studio = createVideoStudio({ stage: $('#stage'), key: session.key, getDemoStream: () => cameraStream });
  studioButton.onclick = studio.open;
  const liveButton = document.createElement('button'); liveButton.className = 'studio-open live-pages-open'; liveButton.textContent = 'Live pages';
  openLivePages = createLivePagePanel(slides); liveButton.onclick = openLivePages; liveButton.title = 'Live pages (L)'; document.body.append(liveButton);
  const liveDock = document.createElement('nav'); liveDock.id = 'live-page-dock'; liveDock.setAttribute('aria-label', 'Live page for this slide'); document.body.append(liveDock);
  if (new URLSearchParams(location.search).has('studio')) studio.open();
}

function renderStage(changed) {
  const slide = slides[state.index], demo = slide.kind === 'demo';
  $('#stage').dataset.kind = demo ? 'demo' : 'slide';
  $('#live-demo').hidden = !demo; $('#stage-photo').hidden = demo; $('#black-screen').hidden = !state.blackout;
  studio?.syncScene({ demo, blackout: state.blackout });
  const liveDock = $('#live-page-dock');
  liveDock.hidden = !slide.livePages?.length || state.blackout;
  if (changed) renderLiveLinks(liveDock, slide.livePages || []);
  if (changed && !demo) {
    const previous = $('#stage-photo').lastElementChild;
    $('#stage-photo').insertAdjacentHTML('beforeend', imageMarkup(slide));
    if (previous) setTimeout(() => previous.remove(), 750);
  }
  if (!demo) { stopCamera(); return; }
  const d = state.demo;
  if (demoSignature(d) !== resultSignature) { lastResult = null; resultTimes = []; clearHandBoxes(); resultSignature = demoSignature(d); }
  $('#demo-mode-label').textContent = d.mode === 'live' ? (d.paused ? 'READY' : d.realtime ? 'REALTIME' : 'LIVE JEV') : 'SAMPLE DATA';
  $('#demo-subtitle').textContent = '';
  $('#live-demo').classList.toggle('rehearsal', d.mode === 'rehearsal');
  $('#demo-pause-label').hidden = !d.paused;
  $('#stage-run').textContent = d.paused ? 'Start demo' : 'Pause';
  $('#stage-run').hidden = !d.camera && d.paused;
  $('#demo-state').textContent = d.mode === 'rehearsal' ? `Sample: ${rehearsals[d.sample].name}` : d.paused ? 'Paused' : 'Show your hand.';
  if (d.camera) startCamera(); else stopCamera();
  renderResults();
  renderHandBoxes();
  updateRequestStatus();
}

function observeHandBoxContainer() {
  boxObserver ||= new ResizeObserver(renderHandBoxes);
  boxObserver.disconnect();
  const container = stageMode ? $('.camera-area') : $('.demo-preview');
  if (container) boxObserver.observe(container);
}
function clearHandBoxes() {
  lastHandBox = null; lastFrameGeometry = null; previewHandBox = null;
  for (const overlay of $$('.hand-box')) overlay.hidden = true;
  if (stageMode) previewChannel?.postMessage({ handBox: null });
}
function renderHandBoxes() {
  const overlay = stageMode ? $('#hand-box') : $('#preview-hand-box');
  if (!overlay) return;
  const container = overlay.parentElement;
  const box = stageMode ? lastHandBox : previewHandBox;
  const geometry = stageMode ? lastFrameGeometry : { sourceWidth: 640, sourceHeight: 480 };
  const active = slides[state.index].kind === 'demo' && state.demo.mode === 'live' && state.demo.camera;
  const rect = active && box && geometry ? projectHandBox(box, { ...geometry, viewWidth: container.clientWidth, viewHeight: container.clientHeight }) : null;
  overlay.hidden = !rect;
  if (rect) Object.assign(overlay.style, Object.fromEntries(Object.entries(rect).map(([name, n]) => [name, `${n}px`])));
}

function renderResults() {
  const d = state.demo;
  const sample = d.mode === 'rehearsal' ? rehearsals[d.sample] : null;
  const result = sample ? { noul: sample.noul, score: sample.score, scoreConfidence: sample.confidence, choiceConfidence: sample.confidence, probabilities: sample.probabilities, options: ['Open palm', 'Closed fist', 'Pointing', 'Other or no hand'], levels: ['Below shoulder', 'At shoulder', 'Above head'] } : lastResult;
  const v = result?.noul;
  $('#noul-question').textContent = sample || d.noul === defaults.noul ? 'Hand visible?' : d.noul;
  $('#score-question').textContent = sample || d.score === defaults.score ? 'Hand height' : d.score;
  $('#choice-question').textContent = sample || d.choice === defaults.choice ? 'Gesture' : d.choice;
  $('#noul-number').textContent = result ? pct(v) : '—';
  $('#noul-fill').style.width = result ? pct(v) : '0%';
  $('#threshold-marker').style.left = pct(d.threshold);
  $('#noul-policy').textContent = result ? (v >= d.threshold ? 'TRUE' : 'FALSE') : '—';
  $('#noul-policy').classList.toggle('positive', result && v >= d.threshold);
  $('#policy-label').textContent = `Threshold ${pct(d.threshold)}`;
  $('#score-number').textContent = result ? result.score.toFixed(2) : '—';
  const max = (result?.levels || d.levels).length - 1;
  $('#score-marker').style.left = result ? pct(result.score / max) : '0%';
  $('#score-high').textContent = String(max);
  if ($('#score-maximum')) $('#score-maximum').textContent = `/ ${max}`;
  $('#score-confidence').textContent = result && Number.isFinite(result.scoreConfidence) ? `${pct(result.scoreConfidence)}` : '—';
  $('#choice-confidence').textContent = result && Number.isFinite(result.choiceConfidence) ? `${pct(result.choiceConfidence)}` : '—';
  const options = result?.options || d.options;
  const probs = result?.probabilities || options.map(() => 0);
  const best = result ? selectedChoiceIndex(result.choiceId,probs,options.length) : -1;
  if ($('#gesture-choices')) renderGestureChoices($('#gesture-choices'),options,best);
  if ($('#choice-value')) {
    $('#choice-value').textContent = result ? options[best] || '—' : '—';
    $('#choice-value').title = $('#choice-value').textContent;
  }
  $('#choice-bars').innerHTML = options.map((option, i) => `<div class="choice-row ${result && i === best ? 'winning' : ''}"><div><span>${h(option)}</span><span>${result ? pct(probs[i] || 0) : '—'}</span></div><div class="choice-track"><i style="width:${pct(probs[i] || 0)}"></i></div></div>`).join('');
  const fps = resultTimes.length > 1 ? (resultTimes.length - 1) * 1000 / (resultTimes.at(-1) - resultTimes[0]) : null;
  updateAudienceRate();
}

async function report(status, message) { try { await api('telemetry', { status, message }); } catch { /* reconnect handles server restarts */ } }
async function startCamera() {
  if (cameraStream || cameraPending) return;
  cameraPending = true;
  const version = ++cameraVersion;
  try {
    $('#camera-message').textContent = 'Starting camera…';
    const stream = studio?.cameraStream?.active ? studio.cameraStream.clone() : await requestCamera();
    if (version !== cameraVersion || !state.demo.camera || slides[state.index].kind !== 'demo') { stream.getTracks().forEach(t => t.stop()); return; }
    cameraStream = stream; $('#camera-video').srcObject = stream; await $('#camera-video').play();
    if (version !== cameraVersion || !state.demo.camera) { stopCamera(); return; }
    cameraFailed = false;
    $('#enable-camera').textContent = 'Start demo';
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
      if (cameraStream !== stream) return;
      stopCamera(); cameraFailed = true;
      $('#camera-message').textContent = 'Camera disconnected. Reconnect it, then click Retry camera.';
      $('#enable-camera').textContent = 'Retry camera';
      report('error', 'Camera disconnected. Reconnect it, then click Retry camera.');
      control({ action: 'demo', value: { camera: false, paused: true } });
    }, { once: true });
    $('#camera-empty').hidden = true; $('#camera-caption').textContent = 'CAMERA INPUT · MIRRORED PREVIEW';
    report('camera', 'Camera ready in the audience window.');
  } catch (e) {
    if (version !== cameraVersion) return;
    stopCamera(); cameraFailed = true;
    const message = cameraErrorMessage(e);
    $('#camera-message').textContent = message;
    $('#enable-camera').textContent = 'Retry camera';
    report('error', message); toast(message);
    control({ action: 'demo', value: { camera: false, paused: true } });
  } finally { cameraPending = false; }
}
function stopCamera() {
  clearHandBoxes();
  if (cameraPending) cameraVersion++;
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; $('#camera-video').srcObject = null; }
  if ($('#camera-empty')) $('#camera-empty').hidden = false;
}
async function cameraDevicesChanged() {
  if (!stageMode || !cameraFailed || slides[state.index].kind !== 'demo') return;
  const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => []);
  if (devices?.some(device => device.kind === 'videoinput')) {
    const message = 'Camera detected. Click Retry camera.';
    $('#camera-message').textContent = message;
    report('idle', message);
  }
}
async function inferenceLoop() {
  if (!stageMode) return;
  const loopStarted = performance.now();
  const d = state.demo;
  const eligible = () => slides[state.index].kind === 'demo' && !state.blackout && state.demo.mode === 'live' && !state.demo.paused && cameraStream && !requesting && !document.hidden && !requestStatus?.exhausted;
  if (eligible() && !(requestStatus?.nextAllowedAt > Date.now())) {
    const video = $('#camera-video');
    if (video.readyState >= 2) {
      requesting = true; const signature = demoSignature(d);
      const captureVersion = cameraVersion;
      try {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const width = video.videoWidth * scale, height = video.videoHeight * scale;
        const geometry = { sourceWidth: video.videoWidth, sourceHeight: video.videoHeight, frameWidth: canvas.width, frameHeight: canvas.height };
        canvas.getContext('2d').drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        const image = canvas.toDataURL('image/jpeg', 0.65);
        previewChannel?.postMessage({image, status: 'Live Jev'});
        const result = await api('decide', { image });
        if (signature === demoSignature(state.demo) && slides[state.index].kind === 'demo' && state.demo.camera && captureVersion === cameraVersion) {
          const a = result.answers;
          lastHandBox = visibleHandBox(a.visible.noul, a.hand?.box);
          lastFrameGeometry = geometry;
          lastResult = { noul: a.visible.noul, score: a.raised.score, scoreConfidence: a.raised.confidence, choiceConfidence: a.gesture.confidence, choiceId:a.gesture.choice, probabilities: result.options.map((_, i) => a.gesture.probabilities[`option_${i}`] || 0), options: result.options, levels: result.levels, latency: result.latency };
          resultTimes.push(performance.now()); resultTimes = resultTimes.slice(-6);
          renderResults();
          renderHandBoxes();
          previewChannel?.postMessage({status: $('#latency').textContent, handBox: lastHandBox});
        }
      } catch (e) {
        if (e.retryable) {
          if (requestStatus && e.retryAfterMs > 0) requestStatus.nextAllowedAt = Math.max(requestStatus.nextAllowedAt, Date.now() + e.retryAfterMs);
          updateRequestStatus();
        } else {
          clearHandBoxes(); report('error', e.message); toast(e.message); await control({ action: 'demo', value: { paused: true } });
        }
      }
      finally { requesting = false; }
    }
  }
  const delay = nextInferenceDelay({realtime:state.demo.realtime, interval:state.demo.interval, elapsed:performance.now()-loopStarted, active:eligible(), retryAfterMs:Math.max(0,(requestStatus?.nextAllowedAt || 0)-Date.now())});
  inferenceTimer = setTimeout(inferenceLoop, delay);
}

function onState(next) {
  const realtimeChanged=state && next.demo.realtime !== state.demo.realtime;
  if (!state || next.demo.paused !== state.demo.paused) resultTimes = [];
  if (!next.demo.camera || next.demo.mode !== 'live' || (state && demoSignature(next.demo) !== demoSignature(state.demo))) clearHandBoxes();
  state = next;
  const changed = currentIndex !== state.index; currentIndex = state.index;
  if (stageMode) renderStage(changed); else renderPresenter(changed);
  if (stageMode && realtimeChanged && !requesting) { clearTimeout(inferenceTimer); inferenceTimer=setTimeout(inferenceLoop,0); }
}
function connect() {
  events = new EventSource(`/api/events?key=${session.key}`);
  events.addEventListener('state', e => { onState(JSON.parse(e.data)); const el = $('#connection'); if (el) { el.classList.remove('offline'); el.innerHTML = '<i></i>Connected'; } });
  events.addEventListener('telemetry', e => { telemetry = JSON.parse(e.data); updateTelemetry(); });
  events.addEventListener('costs', e => updateCost(JSON.parse(e.data)));
  events.addEventListener('requests', e => updateRequestStatus(JSON.parse(e.data)));
  events.addEventListener('reload', () => { if (studio?.busy || studioStatus?.recording) studio?.deferReload(); else location.reload(); });
  events.onerror = async () => {
    const el = $('#connection'); if (el) { el.classList.add('offline'); el.innerHTML = '<i></i>Reconnecting…'; }
    try { const r = await fetch(`/api/session?key=${session.key}`); if (r.ok && (await r.json()).key !== session.key) location.reload(); } catch { /* EventSource retries */ }
  };
}

document.addEventListener('keydown', e => {
  if (!state || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || $('dialog[open]')) return;
  if (e.target.tagName === 'BUTTON' && [' ', 'Enter'].includes(e.key)) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
  if (e.key === 'Home') { e.preventDefault(); go(0); }
  if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
  if (stageMode && e.key.toLowerCase() === 'l') openLivePages?.();
  if (e.key.toLowerCase() === 'b') control({ action: 'blackout', value: !state.blackout });
  if (e.key.toLowerCase() === 'f') fullscreen();
  if (e.key.toLowerCase() === 'p' && stageMode) window.open(`/?key=${session.key}`, 'jev-presenter');
});
window.addEventListener('beforeunload', () => { cameraStream?.getTracks().forEach(t => t.stop()); events?.close(); clearTimeout(inferenceTimer); });

async function boot() {
  try {
    const key = new URLSearchParams(location.search).get('key') || '';
    const response = await fetch(`/api/session?key=${encodeURIComponent(key)}`);
    session = await response.json(); if (!response.ok) throw new Error(session.error);
    state = session.state; telemetry = session.telemetry; costTotals = session.costs; requestStatus = session.requests;
    if (stageMode) buildStage(); else buildPresenter();
    if (!stageMode) {
      studioChannel = new BroadcastChannel('jev-studio-' + session.key);
      studioChannel.onmessage = event => {
        if (event.data?.type !== 'status') return;
        lastStudioSeen = Date.now();
        studioStatus = event.data;
        const button = $('#video-draft');
        button.classList.toggle('recording', Boolean(studioStatus.recording));
        button.disabled = studioStatus.preparing;
        button.innerHTML = `${icon(studioStatus.recording ? 'pause' : 'camera')}<span>${studioStatus.recording ? 'Stop recording' : studioStatus.preparing ? 'Preparing…' : 'Video draft'}</span>`;
      };
      studioChannel.postMessage({ type: 'ping' });
      setInterval(() => {
        if (Date.now() - lastStudioSeen > 5000) {
          studioStatus = null;
          const button = $('#video-draft'); button.disabled = false;
          button.classList.remove('recording');
          button.innerHTML = `${icon('camera')}<span>Video draft</span>`;
        }
        studioChannel.postMessage({ type: 'ping' });
      }, 2000);
    }
    if (stageMode) navigator.mediaDevices?.addEventListener('devicechange', cameraDevicesChanged);
    previewChannel = new BroadcastChannel('jev-preview-' + session.key);
    if (!stageMode) previewChannel.onmessage = event => {
      if (slides[state.index].kind !== 'demo') return;
      const data = event.data;
      if (Object.hasOwn(data, 'handBox')) { previewHandBox = visibleHandBox(1, data.handBox); renderHandBoxes(); }
      const image = $('#demo-preview-image');
      if (image && state.demo.camera && typeof data.image === 'string' && data.image.startsWith('data:image/jpeg;base64,')) { image.src = data.image; image.hidden = false; }
      if ($('#preview-demo-status') && data.status) $('#preview-demo-status').textContent = data.status;
    };
    onState(state); connect();
    setInterval(() => { updateRequestStatus(); updateCost(); }, 250);
    if (stageMode) inferenceLoop();
    else setInterval(() => {
      const t = state.timer; const ms = t.elapsed + (t.running ? Date.now() - t.startedAt : 0); const s = Math.floor(ms / 1000);
      $('#timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
    // Warm up the local image cache for smooth scene changes, including offline presenting.
    slides.forEach(slide => { const img = new Image(); img.src = `/assets/${slide.image}`; });
  } catch (e) { $('#app').innerHTML = `<div class="boot"><h1>Could not open the deck.</h1><p>${h(e.message)}</p><a href="/">Try again</a></div>`; }
}
boot();
