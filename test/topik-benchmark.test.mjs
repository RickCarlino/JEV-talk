import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { slides } from '../public/deck.js';

test('TOPIK slide retains published accuracy, round-trip time and cents for all 502 questions', async () => {
  const html = await readFile(new URL('../public/assets/topik-benchmark.html', import.meta.url), 'utf8');
  const rows = [...html.matchAll(/<tr>(<td>.*?)<\/tr>/g)].map(row => [...row[1].matchAll(/<td>(.*?)<\/td>/g)].map(cell => cell[1]));
  assert.deepEqual(rows, [
    ['Jev 1.14', '487/502', '97.0%', '159 ms', '1.31¢'],
    ['OpenAI Decisions', '477/502', '95.0%', '282 ms', '1.85¢'],
    ['Clef Flash 9B', '464/502', '92.4%', '79 ms', '—'],
    ['Nimble 9B', '458/502', '91.2%', '95 ms', '—'],
    ['Tev1 4B', '428/502', '85.3%', '54 ms', '—']
  ]);
  assert.equal(slides.find(slide => slide.id === 'local').image, 'topik-bench-results.png');
});
