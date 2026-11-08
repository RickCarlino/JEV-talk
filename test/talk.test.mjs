import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { parseTalk } from '../scripts/sync-talk.mjs';
import { slides, buildSlides } from '../public/deck.js';

test('every title, paragraph, example and WIP placeholder matches README verbatim', async () => {
  const original = parseTalk(await readFile(new URL('../README.md', import.meta.url), 'utf8'));
  assert.deepEqual(slides.map(({title, notes}) => ({title, notes})), original);
  assert.equal(slides.length, original.length);
});

test('every current section has its own bundled visual and accessible description', async () => {
  assert.equal(new Set(slides.map(slide => slide.id)).size, slides.length);
  assert.equal(new Set(slides.map(slide => slide.image)).size, slides.length);
  for (const slide of slides) {
    assert.notEqual(slide.alt, slide.title, `${slide.title} needs a dedicated visual`);
    await access(new URL(`../public/assets/${slide.image}`, import.meta.url));
  }
});

test('project demos and alternatives expose the right sources without starting the camera demo', () => {
  for (const title of ['Demo 2', 'Demo 3', 'Alternatives: OpenAI Decisions API']) {
    const slide = slides.find(slide => slide.title === title);
    assert.equal(slide.kind, undefined);
    assert.ok(slide.sources.length, `${title} needs a source to share`);
  }
  const alternatives = slides.filter(slide => slide.title.startsWith('Alternatives:'));
  assert.equal(new Set(alternatives.map(slide => slide.label)).size, alternatives.length);
});

test('visuals and the live demo follow their headings when the talk is reordered', () => {
  const reordered = buildSlides([...slides].reverse().map(({ title, notes }) => ({ title, notes })));
  assert.deepEqual(reordered.filter(slide => slide.kind === 'demo').map(slide => slide.title), ['Demo']);
  for (const slide of slides) {
    const moved = reordered.find(section => section.title === slide.title);
    assert.equal(moved.image, slide.image);
    assert.equal(moved.id, slide.id);
  }
  assert.equal(slides.find(slide => slide.title === 'Problems').id, 'problems');
  assert.equal(slides.find(slide => slide.title === 'JEV').id, 'jev');
});

test('a new section gets a wordless fallback without displacing known visuals', () => {
  const result = buildSlides([{ title: 'A new thought', notes: ['New notes'] }, { title: 'Demo', notes: ['Demo notes'] }]);
  assert.equal(result[0].kind, undefined);
  assert.equal(result[1].kind, 'demo');
  assert.deepEqual(result[0].notes, ['New notes']);
});

test('self-intro is generated before Introduction and uses its plain title visual', () => {
  const sections = parseTalk('Preamble\n\n## Self-intro\n\nDecision Models\nRick Carlino\n\n## Introduction\n\nIntro notes');
  assert.deepEqual(sections.map(section => section.title), ['Self-intro', 'Introduction']);
  assert.equal(slides[0].title, 'Self-intro');
  assert.equal(slides[0].image, 'self-intro-dark.svg');
  assert.equal(slides[1].title, 'Introduction');
});

test('Demo 2 covers archives and Demo 3 moves from Pokémon to serious applications', () => {
  const archives = slides.find(slide => slide.title === 'Demo 2');
  const pokemon = slides.find(slide => slide.title === 'Demo 3');
  assert.equal(archives.id, 'archives');
  assert.equal(archives.image, 'meteorite-report.jpg');
  assert.equal(pokemon.id, 'pokemon');
  assert.equal(pokemon.image, 'pokemon-project.png');
  assert.ok(pokemon.livePages.some(page => page.url === 'https://jev-pokemon.vercel.app/'));
  assert.ok(pokemon.notes.some(note => note.includes('Detect phishing')));
});
