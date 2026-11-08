export function visibleHandBox(probability, box) {
  if (!Number.isFinite(probability) || probability <= 0.5 || probability > 1 || !box) return null;
  const { left, top, right, bottom } = box;
  if (![left, top, right, bottom].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return null;
  if (left >= right || top >= bottom) return null;
  return { left, top, right, bottom };
}

// The API sees a letterboxed frame; the UI shows mirrored, object-fit:cover video.
export function projectHandBox(box, { sourceWidth, sourceHeight, viewWidth, viewHeight, frameWidth = 640, frameHeight = 480, mirrored = true }) {
  if (!visibleHandBox(1, box) || ![sourceWidth, sourceHeight, viewWidth, viewHeight, frameWidth, frameHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const captureScale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const padX = (frameWidth - sourceWidth * captureScale) / 2;
  const padY = (frameHeight - sourceHeight * captureScale) / 2;
  const displayScale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const offsetX = (viewWidth - sourceWidth * displayScale) / 2;
  const offsetY = (viewHeight - sourceHeight * displayScale) / 2;
  let left = (box.left * frameWidth - padX) / captureScale * displayScale + offsetX;
  let right = (box.right * frameWidth - padX) / captureScale * displayScale + offsetX;
  let top = (box.top * frameHeight - padY) / captureScale * displayScale + offsetY;
  let bottom = (box.bottom * frameHeight - padY) / captureScale * displayScale + offsetY;
  if (mirrored) [left, right] = [viewWidth - right, viewWidth - left];
  left = Math.max(0, left); right = Math.min(viewWidth, right);
  top = Math.max(0, top); bottom = Math.min(viewHeight, bottom);
  if (left >= right || top >= bottom) return null;
  return { left, top, width: right - left, height: bottom - top };
}
