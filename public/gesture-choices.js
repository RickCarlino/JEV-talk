const artwork = new Map([
  ['open palm','palm'], ['palm','palm'], ['open hand','palm'],
  ['closed fist','fist'], ['fist','fist'],
  ['pointing','point'], ['point','point'],
  ['other or no hand','fallback'], ['other','fallback'], ['no hand','fallback'], ['none','fallback']
]);

export function gestureArtwork(label) {
  const name = artwork.get(String(label).trim().toLowerCase());
  return name ? `/assets/gestures/${name}.svg` : null;
}

export function selectedChoiceIndex(choiceId, probabilities, count) {
  const key = typeof choiceId === 'string' ? choiceId.match(/^option_(\d+)$/) : null;
  if (key && Number(key[1]) < count) return Number(key[1]);
  let selected = -1, highest = 0;
  for (let index = 0; index < count; index++) {
    const value = probabilities?.[index];
    if (Number.isFinite(value) && value > highest) { highest = value; selected = index; }
  }
  return selected;
}

export function renderGestureChoices(container, options, selected) {
  const signature = JSON.stringify(options);
  if (container.dataset.options !== signature) {
    const document = container.ownerDocument;
    container.replaceChildren(...options.map((label,index) => {
      const option = document.createElement('div'); option.className = 'gesture-option';
      option.setAttribute('role','listitem'); option.setAttribute('aria-label',label); option.title = label;
      const symbol = document.createElement('span'); symbol.className = 'gesture-symbol'; symbol.setAttribute('aria-hidden','true');
      const image = gestureArtwork(label);
      const art = document.createElement('span');
      if (image) { art.className = 'gesture-art'; art.style.setProperty('--gesture-image',`url("${image}")`); }
      else { art.className = 'gesture-index'; art.textContent = String(index+1); }
      symbol.append(art);
      const stop = document.createElement('span'); stop.className = 'gesture-stop'; stop.setAttribute('aria-hidden','true');
      option.append(symbol,stop);
      return option;
    }));
    container.dataset.options = signature; delete container.dataset.selected;
    container.style.setProperty('--choice-columns',String(Math.max(1,Math.min(options.length,4))));
    container.classList.toggle('multiple-rows',options.length>4);
  }
  if (container.dataset.selected === String(selected)) return;
  [...container.children].forEach((option,index) => {
    option.classList.toggle('selected',index===selected);
    if (index===selected) option.setAttribute('aria-current','true');
    else option.removeAttribute('aria-current');
  });
  container.dataset.selected = String(selected);
}
