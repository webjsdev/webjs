/**
 * Byte-identity gate for the SSR renderer (#1646): every corpus case must
 * reproduce its committed golden exactly. See `corpus.js` for the cases and
 * the regeneration command. A failure prints the first differing offset with
 * context on both sides, which is usually enough to name the pass that moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cases } from './corpus.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const update = process.env.WEBJS_GOLDEN_UPDATE === '1';

function describeDiff(expected, actual) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i += 1;
  const from = Math.max(0, i - 60);
  return `first difference at offset ${i}\n  golden: ${JSON.stringify(expected.slice(from, i + 80))}\n  actual: ${JSON.stringify(actual.slice(from, i + 80))}`;
}

const seen = new Set();
for (const c of cases) {
  assert.ok(!seen.has(c.name), `duplicate golden case name ${c.name}`);
  seen.add(c.name);
  test(`golden: ${c.name}`, async () => {
    const actual = await c.run();
    assert.equal(typeof actual, 'string', 'a case returns the rendered bytes');
    const file = join(dir, `${c.name}.html`);
    if (update) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, actual);
      return;
    }
    assert.ok(existsSync(file), `missing golden ${file} (run with WEBJS_GOLDEN_UPDATE=1 to create it)`);
    const expected = readFileSync(file, 'utf8');
    if (expected !== actual) assert.fail(`${c.name}: ${describeDiff(expected, actual)}`);
  });
}

test('golden: the corpus is non-trivial', () => {
  assert.ok(cases.length >= 80, `${cases.length} cases`);
});
