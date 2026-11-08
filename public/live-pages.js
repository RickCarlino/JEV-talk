// Use native tabs: provider login flows and frame policies must work normally.
export function livePageLinks(slides) {
  return [...new Map(slides.flatMap(slide => slide.livePages || []).map(page => [page.url, page])).values()];
}

export function renderLiveLinks(container, pages) {
  container.replaceChildren();
  for (const page of pages) {
    const link = document.createElement('a');
    link.className = 'button live-page-link';
    link.href = page.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = `${page.label} ↗`;
    container.append(link);
  }
}

export function createLivePagePanel(slides) {
  const dialog = document.createElement('dialog');
  dialog.className = 'live-pages-dialog';
  dialog.innerHTML = `<div class="dialog-heading"><h2>Live pages</h2><button class="icon-button" aria-label="Close live pages">×</button></div>
    <p>Open these from the audience window on the projected display. Sign in and check each page before the talk.</p>
    <div class="live-page-list"></div>
    <p class="small muted">Each link opens a real browser tab. Pin this deck first; Ctrl+1 (Cmd+1 on Mac) returns here. Keep the site tabs open to preserve your work. Exit slide fullscreen with Esc to see the tabs; use browser fullscreen (F11) for the talk.</p>
    <p class="small muted">If a site fails, close its tab and continue with the bundled slide. Remote slide controls do not switch browser tabs.</p>`;
  renderLiveLinks(dialog.querySelector('.live-page-list'), livePageLinks(slides));
  dialog.querySelector('button').onclick = () => dialog.close();
  document.body.append(dialog);
  return () => dialog.showModal();
}

export async function copyCoinImage() {
  if (!navigator.clipboard?.write || !globalThis.ClipboardItem) throw new Error('Use Download coin.jpg, then drag the file into the playground.');
  // Start the clipboard write during the click; resolve image conversion afterward.
  const png = (async () => {
    const response = await fetch('/assets/coin.jpg');
    if (!response.ok) throw new Error('Could not load coin.jpg.');
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not copy image.')), 'image/png'));
    } finally { bitmap.close(); }
  })();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
