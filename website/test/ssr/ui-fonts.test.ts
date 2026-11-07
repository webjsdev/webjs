/**
 * The /ui faces are the files ui.shadcn.com serves (#1666). Google serves a
 * different build of a family to a different browser, and the build this site
 * once fetched drew Geist visibly lighter than shadcn's, so every /ui label
 * looked a weight thin. scripts/fetch-fonts.mjs now asks with next/font's own
 * user agent; these hashes are shadcn's files, so a re-run that brought back
 * another build fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const md5 = (file: string) => createHash('md5').update(readFileSync(resolve(ROOT, 'public/fonts', file))).digest('hex');

test('the /ui fonts are byte for byte the files ui.shadcn.com serves', () => {
  // shadcn's site: Geist (variable) and Geist Mono at weight 400 alone.
  assert.equal(md5('geist.woff2'), 'f4634c3bc1fa7cb53247e1f2872adb5a', 'Geist');
  assert.equal(md5('geist-mono.woff2'), '68bab961eff9f3a6688713c9c93497b6', 'Geist Mono 400');
  // shadcn's preview frames: Geist Mono with every weight.
  assert.equal(md5('geist-mono-variable.woff2'), 'cd5b25781181c5c03d99ac2cbf88016a', 'Geist Mono variable');
});

test('the /ui chrome sets mono in the 400-only face, as shadcn does', () => {
  const css = readFileSync(resolve(ROOT, 'public/ui-input.css'), 'utf8');
  assert.match(css, /font-family:'Geist Mono Regular';font-style:normal;font-weight:400;[^}]*geist-mono\.woff2/);
  assert.match(css, /font-family:'Geist Mono';font-style:normal;font-weight:100 900;[^}]*geist-mono-variable\.woff2/);
  assert.match(css, /--font-mono: 'Geist Mono Regular',/);
});

test('fetch-fonts asks Google with the user agent next/font sends', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/fetch-fonts.mjs'), 'utf8');
  assert.ok(src.includes(
    "'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'",
  ));
});
