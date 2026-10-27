/**
 * Cross-runtime proof that the one-pass SSR renderer (#1646) emits the SAME
 * bytes under WHICHEVER runtime executes this file. Run under both:
 *
 *   node test/bun/ssr-one-pass-parity.mjs
 *   bun  test/bun/ssr-one-pass-parity.mjs
 *
 * The compile-once tokenizer, the op walker and the in-walk component
 * expansion are the SSR hot path, so they are runtime-sensitive: a regex or
 * string-slicing difference between V8 and JavaScriptCore would show up as a
 * byte difference. The whole golden corpus (every slot, form, Suspense,
 * shadow, error and inert-context shape) is rendered here and compared with
 * the committed fixtures, so the two runtimes are held to one output. A plain
 * assert script (not `*.test.mjs`), exits non-zero on failure.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cases } from '../../packages/core/test/rendering/ssr-golden/corpus.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../packages/core/test/rendering/ssr-golden/fixtures');

let n = 0;
for (const c of cases) {
  const expected = readFileSync(join(fixtures, `${c.name}.html`), 'utf8');
  const actual = await c.run();
  assert.equal(actual, expected, `[${runtime}] golden ${c.name} differs on this runtime`);
  n += 1;
}
assert.ok(n >= 80, `[${runtime}] the corpus rendered (${n} cases)`);
console.log(`[${runtime}] one-pass SSR renderer byte parity OK (${n} goldens)`);
