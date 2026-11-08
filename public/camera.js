// Keep capture independent of the model's frame size; app.js scales frames to 640x480.
export async function requestCamera(mediaDevices = globalThis.navigator?.mediaDevices) {
  if (!mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost or HTTPS.');
  try {
    return await mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (firstError) {
    if (!['NotFoundError', 'OverconstrainedError'].includes(firstError.name)) throw firstError;
    // A browser can retain a default camera that was unplugged. Try the cameras
    // it actually reports instead of treating a stale default as no hardware.
    const devices = await mediaDevices.enumerateDevices?.().catch(() => []) || [];
    for (const device of devices.filter(d => d.kind === 'videoinput' && d.deviceId)) {
      try {
        return await mediaDevices.getUserMedia({ video: { deviceId: { exact: device.deviceId } }, audio: false });
      } catch (error) {
        if (!['NotFoundError', 'OverconstrainedError'].includes(error.name)) throw error;
      }
    }
    throw firstError;
  }
}

export function cameraErrorMessage(error) {
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No camera is available to Chrome. Reconnect it, then click Retry camera.';
  if (error.name === 'NotAllowedError') return 'Camera access is blocked. Allow it in Chrome, then click Retry camera.';
  if (error.name === 'NotReadableError' || error.name === 'AbortError') return 'Camera is busy or unavailable. Close other camera apps, then click Retry camera.';
  return error.message || 'Could not start the camera. Click Retry camera.';
}
