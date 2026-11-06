/**
 * Capture every class-bearing string of every registry component, as the
 * components stood BEFORE they were converted to base form (#1666, D8).
 *
 *   node packages/ui/test/fixtures/capture-class-strings.mjs           # NEVER on base form
 *   node packages/ui/test/fixtures/capture-class-strings.mjs --merge   # add new strings
 *
 * The output, class-strings.json, is what test/style-bake-snapshot.test.js
 * holds the `new-york` bake to: baking a base-form component with the
 * `new-york` style must give back, string for string, the classes the
 * component had before the conversion. It was captured once, at the commit
 * where the conversion started, and a plain re-capture must NOT be run on
 * base-form sources, which would make the snapshot compare the bake against
 * itself.
 *
 * `--merge` is for a component that GAINED strings (a new helper, a new
 * part). It aligns the existing baseline with the current baked strings by
 * their merged classes, keeps every baseline string that still matches,
 * inserts the new ones, and FAILS if a baseline string no longer matches
 * anything, because that is a changed look, which needs a deliberate
 * re-baseline (see scripts/logical-properties.mjs for one) rather than a
 * merge. A component with no baseline at all (a new component) is added
 * whole.
 *
 * The strings are found by `classSegments` from src/registry/style-bake.js,
 * the same function the bake rewrites with.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classSegments, segmentValue, bakeForStyle } from '../../src/registry/style-bake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(HERE, '..', '..', 'packages', 'registry', 'components');
const OUT = join(HERE, 'class-strings.json');
const merge = process.argv.includes('--merge') || process.argv.includes('--allow-drop');
// --allow-drop: a refactor removed NON-class strings (a selector, an id, a tag
// name). Those may leave the baseline; a multi-class list never may, and every
// drop is printed for review.
const allowDrop = process.argv.includes('--allow-drop');
const droppable = (v) => !/\s/.test(v.trim()) || /["{}\n]/.test(v) || /^ui-[\w-]+([\s[]|$)/.test(v.trim());

const stringsOf = (src) => classSegments(src).map((s) => segmentValue(src, s));
const key = (v) => v.split(/\s+/).filter((t) => !/^(group|peer)(\/[\w-]+)?$/.test(t)).sort().join(' ');

/** @type {Record<string, string[]>} */
const prior = merge && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
/** @type {Record<string, string[]>} */
const out = {};
let added = 0;
for (const f of readdirSync(COMPONENTS).filter((x) => x.endsWith('.ts')).sort()) {
  const name = `components/${f}`;
  const src = readFileSync(join(COMPONENTS, f), 'utf8');
  if (!merge) { out[name] = stringsOf(src); continue; }
  const now = stringsOf(bakeForStyle(src, 'new-york'));
  const before = prior[name];
  if (!before) { out[name] = now; added += now.length; continue; }
  // Longest common subsequence on the merged-class key.
  const a = before.map(key);
  const b = now.map(key);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const merged = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { merged.push(before[i]); i++; j++; }
    else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { merged.push(now[j]); added++; j++; }
    else if (allowDrop && droppable(before[i])) { console.log(`  dropped from ${name}: ${JSON.stringify(before[i])}`); i++; }
    else { throw new Error(`${name}: the baseline string ${JSON.stringify(before[i])} no longer matches; a changed look needs a deliberate re-baseline, not --merge`); }
  }
  out[name] = merged;
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(merge ? `merged: ${added} new string(s)` : `captured ${Object.keys(out).length} files`);
