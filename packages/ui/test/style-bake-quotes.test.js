/**
 * A baked class survives Tailwind's scanner (#1666). Tailwind reads an
 * installed file's raw text and never unescapes it, so the bake must not
 * escape a quote to fit it inside the string it writes into. It used to write
 * `[&_svg:not([class*=\'size-\'])]:size-4` into single-quoted strings: valid
 * JavaScript, but Tailwind compiled the backslashes into the selector, the
 * rule never matched, and every unsized svg in a baked button rendered at its
 * full size (login-03's Apple icon covered the card). The /ui site never saw
 * it, since it loads the styles unbaked.
 *
 * This bakes every component and block in every style, scans each result the
 * way Tailwind does, and compiles the attribute-selector classes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bakeForStyle, classSegments } from '../src/registry/style-bake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REG = join(HERE, '..', 'packages', 'registry');
const STYLES = ['new-york', 'vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];

// Tailwind is the website's dependency, hoisted to the workspace root.
const require = createRequire(import.meta.url);
let tailwind = null;
try {
  const { Scanner } = require('@tailwindcss/oxide');
  const { compile } = await import(require.resolve('tailwindcss').replace(/\.js$/, '.mjs').replace(/index\.mjs$/, 'lib.mjs'));
  tailwind = { Scanner, compile };
} catch { /* reported by the skip below */ }

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const SOURCES = [...files(join(REG, 'components')), ...files(join(REG, 'blocks'))];

test('no baked class string escapes a quote', () => {
  const bad = [];
  for (const style of STYLES) {
    for (const file of SOURCES) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('cn-')) continue;
      const baked = bakeForStyle(src, style);
      for (const seg of classSegments(baked)) {
        const raw = baked.slice(seg.start, seg.end);
        if (!/\[[^\]]*['"]/.test(raw) && !/&quot;/.test(raw)) continue;
        if (/\\['"]|&quot;/.test(raw)) bad.push(`${style} ${file.slice(REG.length + 1)}: ${raw.match(/\S*(\\['"]|&quot;)\S*/)[0]}`);
      }
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 10), []);
});

test('Tailwind reads a baked attribute-selector class unescaped and compiles a selector that matches', { skip: tailwind ? false : 'tailwindcss is not installed' }, async () => {
  const scanner = new tailwind.Scanner({});
  const found = new Set();
  for (const style of STYLES) {
    for (const file of SOURCES) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('cn-')) continue;
      for (const c of scanner.scanFiles([{ content: bakeForStyle(src, style), extension: 'ts' }])) {
        if (c.includes('class*=')) found.add(c);
      }
    }
  }
  const all = [...found];
  assert.ok(all.length > 0, 'the bakes carry attribute-selector classes');
  assert.deepEqual(all.filter((c) => c.includes('\\')), [], 'no candidate carries a backslash');
  assert.ok(all.includes("[&_svg:not([class*='size-'])]:size-4"), 'the button\'s unsized-svg rule is read whole');
  const compiler = await tailwind.compile('@theme { --spacing: 0.25rem; } @tailwind utilities;', {});
  const css = compiler.build(all);
  assert.match(css, /svg:not\(\[class\*=['"]size-['"]\]\)/, 'and compiles to a selector a browser matches');
  assert.doesNotMatch(css, /class\*=\\/, 'with no escaped quote in it');
});
