#!/usr/bin/env node
/**
 * The logical-property audit (#1666): rewrite the kit's physical-direction
 * Tailwind classes to their logical forms, so every component reads
 * correctly under `dir="rtl"`.
 *
 *   node packages/ui/scripts/logical-properties.mjs [--write]
 *
 * The table is shadcn's own (`RTL_MAPPINGS` in
 * packages/registry/src/transformers/transform-rtl.ts of the shadcn repo),
 * the mapping its `migrate rtl` and install-time RTL transform apply. Two
 * deliberate exceptions, both centring idioms that are already
 * direction-neutral: `left-[50%]` / `left-1/2` (and the right forms) stay
 * physical, because they pair with a `translate-x-[-50%]` that would need
 * an `rtl:` flip of its own, and swapping only the offset would move the
 * element off centre in RTL.
 *
 * It rewrites three places with the SAME token function: the `@apply`
 * lines of styles/style-new-york.css, the class strings of the registry
 * components, and test/fixtures/class-strings.json (the snapshot's
 * baseline), so the snapshot keeps proving the bake equals the baseline.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classSegments, segmentValue } from '../src/registry/style-bake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const REGISTRY = join(PKG, 'packages', 'registry');
const write = process.argv.includes('--write');

import { logicalToken, logicalClassList } from './logical-classes.mjs';

export { logicalToken, logicalClassList };

const looksLikeClassList = (v) => {
  const t = v.trim();
  return t !== '' && !/[\n{};"]/.test(t) && t.split(/\s+/).every((x) => /^[!-~]+$/.test(x));
};

let changes = 0;
const log = (where, a, b) => { changes++; console.log(`${where}\n  - ${a}\n  + ${b}`); };

// 1. new-york @apply lines
const nyPath = join(REGISTRY, 'styles', 'style-new-york.css');
const ny = readFileSync(nyPath, 'utf8').replace(/(@apply\s+)([^;]+)(;)/g, (m, a, classes, z) => {
  const next = logicalClassList(classes);
  if (next !== classes) log('style-new-york.css', classes, next);
  return a + next + z;
});
if (write) writeFileSync(nyPath, ny);

// 2. component class strings (object keys and non-class strings are skipped)
const compDir = join(REGISTRY, 'components');
for (const f of readdirSync(compDir).filter((x) => x.endsWith('.ts')).sort()) {
  const p = join(compDir, f);
  const src = readFileSync(p, 'utf8');
  let out = '';
  let last = 0;
  for (const seg of classSegments(src)) {
    const v = segmentValue(src, seg);
    if (!looksLikeClassList(v)) continue;
    if (/^\s*:/.test(src.slice(seg.end + 1, seg.end + 8))) continue; // an object key
    const next = logicalClassList(src.slice(seg.start, seg.end));
    if (next === src.slice(seg.start, seg.end)) continue;
    log(`components/${f}`, v, next);
    out += src.slice(last, seg.start) + next;
    last = seg.end;
  }
  if (write && last) writeFileSync(p, out + src.slice(last));
}

// 3. the snapshot baseline, by the same token function
const fxPath = join(PKG, 'test', 'fixtures', 'class-strings.json');
const fx = JSON.parse(readFileSync(fxPath, 'utf8'));
let fxChanges = 0;
for (const file of Object.keys(fx)) {
  // The fixture is paired with the source string by string, so the source
  // tells which positions are object KEYS (popover's 'left-start' position
  // names), which are not classes and must not be mapped.
  const src = readFileSync(join(REGISTRY, file), 'utf8');
  const keys = new Set(classSegments(src).map((s, i) => (/^\s*:/.test(src.slice(s.end + 1, s.end + 8)) ? i : -1)));
  fx[file] = fx[file].map((v, i) => {
    if (keys.has(i) || !looksLikeClassList(v)) return v;
    const next = logicalClassList(v);
    if (next !== v) fxChanges++;
    return next;
  });
}
if (write) writeFileSync(fxPath, JSON.stringify(fx, null, 1) + '\n');
console.log(`${changes} rewrites in sources, ${fxChanges} in the fixture${write ? '' : ' (dry run)'}`);
