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

// Order matters (negatives before positives, specific before general).
const MAPPINGS = [
  ['-ml-', '-ms-'], ['-mr-', '-me-'], ['ml-', 'ms-'], ['mr-', 'me-'],
  ['pl-', 'ps-'], ['pr-', 'pe-'],
  ['-left-', '-start-'], ['-right-', '-end-'], ['left-', 'start-'], ['right-', 'end-'],
  ['inset-l-', 'inset-inline-start-'], ['inset-r-', 'inset-inline-end-'],
  ['rounded-tl-', 'rounded-ss-'], ['rounded-tr-', 'rounded-se-'],
  ['rounded-bl-', 'rounded-es-'], ['rounded-br-', 'rounded-ee-'],
  ['rounded-l-', 'rounded-s-'], ['rounded-r-', 'rounded-e-'],
  ['border-l-', 'border-s-'], ['border-r-', 'border-e-'],
  ['border-l', 'border-s'], ['border-r', 'border-e'],
  ['text-left', 'text-start'], ['text-right', 'text-end'],
  ['scroll-ml-', 'scroll-ms-'], ['scroll-mr-', 'scroll-me-'],
  ['scroll-pl-', 'scroll-ps-'], ['scroll-pr-', 'scroll-pe-'],
  ['float-left', 'float-start'], ['float-right', 'float-end'],
  ['clear-left', 'clear-start'], ['clear-right', 'clear-end'],
  ['origin-top-left', 'origin-top-start'], ['origin-top-right', 'origin-top-end'],
  ['origin-bottom-left', 'origin-bottom-start'], ['origin-bottom-right', 'origin-bottom-end'],
  ['origin-left', 'origin-start'], ['origin-right', 'origin-end'],
];
// Direction-neutral centring offsets, left as they are.
const CENTRING = /^-?(left|right)-(\[50%\]|1\/2)$/;

/** The utility part of a class, after its variants (split at the last top-level colon). */
function splitVariant(token) {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) cut = i;
  }
  return [token.slice(0, cut + 1), token.slice(cut + 1)];
}

/** Map one class token to its logical form, or return it unchanged. */
export function logicalToken(token) {
  const [variant, rest] = splitVariant(token);
  const bang = rest.startsWith('!') ? '!' : '';
  const util = bang ? rest.slice(1) : rest;
  if (CENTRING.test(util)) return token;
  for (const [from, to] of MAPPINGS) {
    const exact = !from.endsWith('-');
    if (exact ? util === from || util.startsWith(from + '/') : util.startsWith(from)) {
      return variant + bang + to + util.slice(from.length);
    }
  }
  return token;
}

/** A class list, mapped token by token, whitespace kept as it was. */
export function logicalClassList(value) {
  return value.split(/(\s+)/).map((t) => (/^\s*$/.test(t) ? t : logicalToken(t))).join('');
}

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
