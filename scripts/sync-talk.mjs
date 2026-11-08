import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export function parseTalk(readme) {
  const start = readme.search(/^## (?:Self-intro|Introduction)$/m);
  if (start < 0) throw new Error('README must contain ## Introduction.');
  const text = readme.slice(start);
  const headings = [...text.matchAll(/^#{1,2} (.+)$/gm)];
  return headings.map((heading, i) => ({
    title: heading[1],
    notes: text.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? text.length).trim().split(/\n\s*\n/)
  }));
}
export async function syncTalk() {
  const content = parseTalk(await readFile(path.join(root, 'README.md'), 'utf8'));
  const output = '// Generated verbatim from README.md by npm run sync-talk.\nexport const talk = ' + JSON.stringify(content, null, 2) + ';\n';
  const target = path.join(root, 'public/talk-content.js');
  if (await readFile(target, 'utf8').catch(() => '') !== output) await writeFile(target, output);
  return content;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await syncTalk();
