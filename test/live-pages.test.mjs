import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { slides, buildSlides } from '../public/deck.js';
import { livePageLinks } from '../public/live-pages.js';

test('README live examples retain their exact destinations and local fallback images after reordering', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const reversed = buildSlides([...slides].reverse());
  for (const title of ['The main show: JEV', 'Alternatives: OpenAI Decisions API']) {
    const slide = reversed.find(slide => slide.title === title);
    assert.ok(slide.livePages.length);
    assert.equal(slide.kind, undefined, 'visiting a webpage must not enable camera inference');
    assert.equal(slide.coin, true);
    assert.ok(readme.includes(slide.livePages[0].url));
    for (const link of slide.livePages) assert.equal(new URL(link.url).protocol, 'https:');
  }
  assert.equal(reversed.find(slide => slide.id === 'playground').image, 'coin.jpg');
  assert.equal(reversed.find(slide => slide.id === 'conclusion').title, 'Conclusion');
});

test('preflight includes all slide websites exactly once', () => {
  const pages = livePageLinks(slides);
  const total = new Set(slides.flatMap(slide => slide.livePages.map(page => page.url)));
  assert.equal(pages.length, total.size);
  assert.ok(pages.some(page => page.label === 'Jev playground'));
  assert.ok(pages.some(page => page.label === 'OpenAI Decisions'));
  assert.deepEqual(livePageLinks([{livePages:pages}, {livePages:pages}, {}]), pages);
});
