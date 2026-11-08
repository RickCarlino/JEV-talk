import { requestCamera, cameraErrorMessage } from './camera.js';

export function recordingFormat(Recorder = globalThis.MediaRecorder) {
  return ['video/mp4;codecs=avc1.42001E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => Recorder?.isTypeSupported(type)) || '';
}

// Media stays in the audience browser. Only status and stop commands cross tabs.
export function createVideoStudio({ stage, key, getDemoStream }) {
  const channel = new BroadcastChannel('jev-studio-' + key);
  let headStream, displayStream, micStream, recorder, preparing = false;
  let chunks = [], downloadUrl, scene = {}, pendingReload = false, cameraVersion = 0;
  const head = document.createElement('div');
  head.className = 'presenter-head'; head.hidden = true;
  head.innerHTML = '<video autoplay playsinline muted aria-label="Presenter camera"></video>';
  stage.append(head);
  const dialog = document.createElement('dialog');
  dialog.id = 'studio-dialog';
  dialog.innerHTML = `<div class="dialog-heading"><h2>Record a video draft.</h2><button class="icon-button" id="studio-close" aria-label="Close video draft settings">×</button></div>
    <p>Your slides, your camera, your voice. Keep speaker notes in the presenter window.</p>
    <label class="studio-option"><input id="studio-camera" type="checkbox"> Show my camera on slides</label>
    <label class="field-label" for="studio-position">Camera corner</label><select id="studio-position"><option value="right">Bottom right</option><option value="left">Bottom left</option></select>
    <p class="small muted">The camera bubble fades out for the demo, where the same camera fills the main frame. It returns on the next slide.</p>
    <label class="studio-option"><input id="studio-microphone" type="checkbox" checked> Include my microphone</label>
    <p class="studio-capture-hint">For live webpages, choose the <strong>audience browser window or projected display</strong> in the sharing picker. For slides only, choose this audience tab. Recording controls disappear from the slide. Stop from the presenter window or press <kbd>Shift</kbd> + <kbd>R</kbd> here.</p>
    <div id="studio-status" class="studio-status" role="status">Camera is off. Nothing is being recorded.</div>
    <div class="studio-actions"><button class="button primary" id="studio-record">Start recording</button><button class="button" id="studio-done">Done</button></div>
    <a id="studio-download" class="studio-download" hidden>Download last take</a>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const status = message => { $('#studio-status').textContent = message; };
  const isRecording = () => recorder?.state === 'recording';
  const publish = () => channel.postMessage({ type: 'status', recording: isRecording(), preparing, camera: Boolean(headStream) });
  const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());

  function syncScene(next = scene) {
    scene = next;
    head.classList.toggle('in-demo', Boolean(scene.demo));
    head.classList.toggle('is-blacked-out', Boolean(scene.blackout));
    head.classList.toggle('on-left', $('#studio-position').value === 'left');
  }
  async function setCamera(enabled) {
    const version = ++cameraVersion;
    if (!enabled) {
      stopTracks(headStream); headStream = null; head.hidden = true;
      head.querySelector('video').srcObject = null; publish(); return;
    }
    try {
      status('Starting camera…');
      const existing = getDemoStream();
      const stream = existing?.active ? existing.clone() : await requestCamera();
      if (version !== cameraVersion) { stopTracks(stream); return; }
      headStream = stream;
      const video = head.querySelector('video'); video.srcObject = stream; await video.play();
      head.hidden = false; syncScene();
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (headStream !== stream) return;
        setCamera(false); $('#studio-camera').checked = false;
        status('Camera disconnected. Reconnect it, then enable the camera again.');
        if (!isRecording()) open();
      }, { once: true });
      status('Camera ready. Adjust your framing before recording.');
    } catch (error) {
      if (version !== cameraVersion) return;
      stopTracks(headStream); headStream = null; head.hidden = true;
      $('#studio-camera').checked = false;
      status(cameraErrorMessage(error));
    }
    publish();
  }
  function open() {
    if (isRecording() || preparing) return;
    if (!dialog.open) dialog.showModal();
  }
  function stop() {
    if (isRecording()) recorder.stop();
  }
  async function start() {
    if (preparing || isRecording()) return;
    if (!navigator.mediaDevices?.getDisplayMedia || !globalThis.MediaRecorder) {
      status('This browser cannot record the tab. Use desktop Chrome or Edge, or capture the audience window with your screen recorder.'); return;
    }
    preparing = true; $('#studio-record').disabled = true; publish();
    try {
      // Call directly in the click handler to retain the required user gesture.
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: false, selfBrowserSurface: 'include' });
      if ($('#studio-microphone').checked) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      }
      const stream = new MediaStream([...displayStream.getVideoTracks(), ...(micStream?.getAudioTracks() || [])]);
      const mimeType = recordingFormat();
      recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 6000000 });
      chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || chunks[0]?.type || 'video/webm';
        const blob = new Blob(chunks, { type }); chunks = [];
        stopTracks(displayStream); stopTracks(micStream); displayStream = micStream = null;
        document.body.classList.remove('studio-recording');
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(blob);
        const link = $('#studio-download');
        link.href = downloadUrl; link.download = `jev-draft-${new Date().toISOString().replace(/[:.]/g, '-')}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
        link.hidden = false; link.textContent = 'Download last take';
        status(`Take ready (${(blob.size / 1024 / 1024).toFixed(1)} MB). Saved locally; nothing was uploaded.${pendingReload ? ' Reload the page before your next take to load deck edits.' : ''}`);
        publish(); open(); link.click();
      };
      recorder.onerror = () => { status('Recording encountered an error. Recover the available take below.'); stop(); };
      displayStream.getVideoTracks()[0].addEventListener('ended', stop, { once: true });
      dialog.close(); document.body.classList.add('studio-recording');
      // Let the dialog and chrome disappear before collecting the first frame.
      await new Promise(resolve => setTimeout(resolve, 350));
      if (!displayStream.active) throw new Error('Screen sharing ended before the recording started.');
      recorder.start(1000);
      status('Recording. Stop from the presenter window or press Shift + R in the audience window.');
    } catch (error) {
      stopTracks(displayStream); stopTracks(micStream); displayStream = micStream = null;
      document.body.classList.remove('studio-recording');
      status(error.name === 'NotAllowedError' ? 'Sharing or microphone access was not allowed. Nothing was recorded; you can try again.' : error.message);
    } finally {
      preparing = false; $('#studio-record').disabled = false; publish();
      if (!isRecording()) open();
    }
  }
  $('#studio-close').onclick = $('#studio-done').onclick = () => dialog.close();
  $('#studio-camera').onchange = event => setCamera(event.target.checked);
  $('#studio-position').onchange = () => syncScene();
  $('#studio-record').onclick = start;
  dialog.addEventListener('cancel', event => { if (preparing) event.preventDefault(); });
  channel.onmessage = event => {
    if (event.data?.type === 'stop') stop();
    if (event.data?.type === 'open') open();
    if (event.data?.type === 'ping') publish();
  };
  window.addEventListener('keydown', event => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.shiftKey && event.key.toLowerCase() === 'r') { event.preventDefault(); stop(); }
    if (!dialog.open && event.key.toLowerCase() === 'v') open();
  });
  window.addEventListener('beforeunload', event => {
    if (isRecording()) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => { stop(); stopTracks(headStream); stopTracks(displayStream); stopTracks(micStream); channel.close(); });
  publish();
  return {
    open, syncScene, stop,
    get cameraStream() { return headStream; },
    get busy() { return preparing || isRecording(); },
    deferReload() { pendingReload = true; }
  };
}
