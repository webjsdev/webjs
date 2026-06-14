/**
 * Source-fidelity assertion (issue #185).
 *
 * "Source is the runtime, served verbatim with identical line and column
 * numbers" is a core webjs promise: you debug the served file with no
 * sourcemap because every (line, column) maps to itself in the authored
 * source. That rests on two position-preserving transforms, and nothing
 * asserted the property until now:
 *   - TypeScript type-strip blanks type syntax to whitespace IN PLACE, so the
 *     served bytes have the same length and every code character keeps its
 *     exact (line, column).
 *   - Elision swaps an elidable component's side-effect import for a comment
 *     on the SAME line (no newline added or removed), so line numbers are
 *     preserved for every token; only the import's own line changes.
 *   - Import versioning (#369, PROD only) appends `?v=<hash>` to a same-origin
 *     relative import specifier, again on the SAME line, so it shifts columns
 *     only on that import statement's own line and never moves a line. DEV
 *     emits no `?v`, so the debug-time served bytes stay byte-faithful.
 *   - A `.server.*` file is served as a stub (out of scope here).
 *
 * This requests source files through the in-process handler and asserts the
 * served bytes match the authored file's line/column structure. The
 * counterfactual proves a line-shifting transform would fail.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Use the framework's OWN runtime-portable stripper (Node's built-in on Node,
// amaro on Bun), NOT a named `import { stripTypeScriptTypes } from 'node:module'`
// (which is a LINK-TIME SyntaxError on Bun, where that export is absent). This
// also pins the served bytes against the EXACT stripper the server used on this
// runtime, so the byte-identity assertion holds on both.
import { stripTypeScript } from '../../packages/server/src/ts-strip.js';

import { createRequestHandler } from '@webjsdev/server';

const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), 'fixture');

let handler;
before(async () => {
  handler = await createRequestHandler({ appDir: FIXTURE, dev: false });
  if (handler.warmup) await handler.warmup();
});

async function served(rel) {
  const r = await handler.handle(new Request('http://localhost/' + rel));
  assert.ok(r.status < 400, `${rel} should be servable (got ${r.status})`);
  return r.text();
}
const authored = (rel) => readFile(resolve(FIXTURE, rel), 'utf8');

/** Line numbers are preserved: same number of lines. */
function sameLineCount(a, b) {
  return a.split('\n').length === b.split('\n').length;
}

/**
 * Full position preservation: identical byte length, identical per-line
 * length, and every served character is either the authored character or a
 * space that replaced stripped type syntax (the strip never moves code).
 */
function positionPreserved(servedSrc, authoredSrc) {
  if (servedSrc.length !== authoredSrc.length) return false;
  for (let i = 0; i < authoredSrc.length; i++) {
    if (servedSrc[i] !== authoredSrc[i] && servedSrc[i] !== ' ') return false;
  }
  return true;
}

test('TS type-strip is position-preserving: served line/column equals authored', async () => {
  const s = await served('components/typed.ts');
  const a = await authored('components/typed.ts');
  assert.ok(sameLineCount(s, a), `line count must match (served ${s.split('\n').length}, authored ${a.split('\n').length})`);
  assert.equal(s.length, a.length, 'type-strip must preserve total byte length (blank in place)');
  const sl = s.split('\n'), al = a.split('\n');
  for (let i = 0; i < al.length; i++) {
    assert.equal(sl[i].length, al[i].length, `line ${i + 1} length must be preserved`);
  }
  assert.ok(positionPreserved(s, a), 'every code character must keep its exact position (types blanked to spaces)');
  // The strongest pin: the served bytes are EXACTLY Node's position-preserving
  // strip of the authored source, with no extra transform layered on top
  // (no banner, no sourcemap comment, no import rewrite, nothing that could
  // shift a line or column). This also closes the gap where positionPreserved
  // alone would tolerate a real code character being blanked to a space: only
  // genuine type syntax is blanked here.
  assert.equal(s, await stripTypeScript(a),
    'served bytes must equal the position-preserving type-strip of the authored source, nothing more');
  // Sampled column fidelity: a code line with no types is byte-identical and
  // at the same line index.
  const idx = al.findIndex((l) => l.includes("TypedComp.register('typed-comp');"));
  assert.ok(idx >= 0, 'sample line present in authored');
  assert.equal(sl[idx], al[idx], 'a non-type line must be served byte-identical at the same line');
  // The type-bearing lines ARE transformed (so the test is not vacuous).
  assert.notEqual(s, a, 'the file does carry types, so served must differ from authored (blanked)');
});

test('a file with no types is served verbatim (byte-for-byte)', async () => {
  const s = await served('components/plain.ts');
  const a = await authored('components/plain.ts');
  assert.equal(s, a, 'a file with nothing to transform must be served byte-identical to its source');
});

test('elision + versioning preserve line numbers: only import lines change, all on their own line', async () => {
  // PROD serve. Three same-line transforms can touch THIS file: the badge
  // import is elided (-> comment), and the two other same-origin relative
  // imports (typed.ts / plain.ts) are versioned (-> `?v=<hash>` appended). All
  // three stay on their own line, so line numbers never shift; every non-import
  // line is byte-identical, which is the debug-without-sourcemap promise.
  const s = await served('app/page.ts');
  const a = await authored('app/page.ts');
  assert.ok(sameLineCount(s, a), `transforms must not shift line numbers (served ${s.split('\n').length}, authored ${a.split('\n').length})`);
  const sl = s.split('\n'), al = a.split('\n');

  for (let i = 0; i < al.length; i++) {
    const authoredLine = al[i];
    if (/^import .*badge\.ts/.test(authoredLine)) {
      // Elided: the side-effect import becomes the elision comment on its line.
      assert.match(sl[i], /webjs: elided display-only component/, `line ${i + 1} is the elision comment`);
    } else if (/^import '\.\.\/components\/(typed|plain)\.ts'/.test(authoredLine)) {
      // Versioned: same import, on the same line, with `?v=<hash>` appended.
      assert.match(sl[i], /^import '\.\.\/components\/(typed|plain)\.ts\?v=[0-9a-f]{6,}'/, `line ${i + 1} is the versioned import`);
    } else {
      // Everything else (the bare `@webjsdev/core` import, the body) is byte-identical.
      assert.equal(sl[i], authoredLine, `non-transformed line ${i + 1} must be byte-identical`);
    }
  }
});

test('counterfactual: a line-shifting transform fails the fidelity assertion', async () => {
  // A transform that strips a type by DELETING it (collapsing) instead of
  // blanking it in place would shift every following column on that line and,
  // if it removed a newline, shift every following line. Simulate both and
  // assert the fidelity checks catch them.
  const a = await authored('components/typed.ts');
  const columnShifted = a.replace('(by: number)', '(by)');      // deletes a type, shifting that line's columns
  const lineShifted = a.replace('\n  constructor() {', '  constructor() {'); // removes a newline
  assert.ok(!positionPreserved(columnShifted, a), 'a column-shifting (delete-not-blank) transform must fail position preservation');
  assert.ok(!sameLineCount(lineShifted, a), 'a line-removing transform must fail the line-count check');
});
