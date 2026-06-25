/**
 * Unit tests for the CLI's inline, dependency-free Node-version preflight
 * (issue #238). The inline check is the PRIMARY guard: it must run before any
 * `import @webjsdev/server`, since on an old Node that import LINK-fails before
 * the server-side `assertNodeVersion` could run. These tests prove the pure
 * comparison passes on >= the minimum, FAILS the counterfactual older version,
 * sources the minimum from the engines range, and the message names found +
 * required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkNodeInline, nodeInlineMessage } from '../../lib/node-preflight.js';

const ENGINES = '>=24.0.0';

test('checkNodeInline passes on the minimum and above', () => {
  for (const v of ['24.0.0', '24.1.0', '25.0.0', 'v24.3.1', '26.1.0']) {
    assert.equal(checkNodeInline(v, ENGINES).ok, true, `${v} should be ok`);
  }
});

test('checkNodeInline COUNTERFACTUAL: an older Node fails the check', () => {
  // The exact #238 audience. Must fail when the guard is reverted.
  for (const v of ['22.0.0', '22.5.0', '22.12.0', '20.0.0', '18.19.1', 'v23.9.0']) {
    assert.equal(checkNodeInline(v, ENGINES).ok, false, `${v} should fail`);
  }
});

test('webjs.js imports @webjsdev/server dynamically, never statically (the guard structure)', async () => {
  // The inline guard only wins on old Node if the server package is NOT a
  // static top-level import (static imports link, and link-fail, before any
  // body code runs). Pin that structure so the #238 link-fail bug cannot
  // silently return: a static `import ... from '@webjsdev/server'` would
  // defeat the inline check on Node below 24.
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const src = await readFile(fileURLToPath(new URL('../../bin/webjs.js', import.meta.url)), 'utf8');
  // No static `import ... from '@webjsdev/server...'` (a dynamic await import is fine).
  const staticServerImport = /(^|\n)\s*import\b[^\n]*\bfrom\s*['"]@webjsdev\/server/;
  assert.equal(staticServerImport.test(src), false, 'webjs.js must not statically import @webjsdev/server');
  // It reaches the server via the dynamic `importWebjsdev` helper (#709).
  assert.ok(/await\s+importWebjsdev\(\s*['"]@webjsdev\/server/.test(src), 'webjs.js should reach @webjsdev/server via importWebjsdev');
  // The guard moved into the helper, so it must NOT statically import the server
  // either (a static import there would link-fail on old Node before the guard).
  const helper = await readFile(fileURLToPath(new URL('../../lib/import-webjsdev.js', import.meta.url)), 'utf8');
  assert.equal(staticServerImport.test(helper), false, 'import-webjsdev.js must not statically import @webjsdev/server');
});

test('checkNodeInline sources the minimum from the engines range', () => {
  // Different engines ranges parse to their major; the requirement is DRY.
  assert.equal(checkNodeInline('20.0.0', '>=24.0.0').requiredMajor, 24);
  assert.equal(checkNodeInline('20.0.0', '>= 22').requiredMajor, 22);
  assert.equal(checkNodeInline('20.0.0', '^26.0.0').requiredMajor, 26);
  // A 20 runtime passes a >=18 engines but fails >=24.
  assert.equal(checkNodeInline('20.0.0', '>=18').ok, true);
  assert.equal(checkNodeInline('20.0.0', '>=24').ok, false);
});

test('checkNodeInline falls back to 24 when engines has no integer', () => {
  assert.equal(checkNodeInline('22.0.0', '*').requiredMajor, 24);
  assert.equal(checkNodeInline('22.0.0', '*').ok, false);
});

test('checkNodeInline reports structured fields', () => {
  const r = checkNodeInline('22.5.0', ENGINES);
  assert.equal(r.current, '22.5.0');
  assert.equal(r.currentMajor, 22);
  assert.equal(r.requiredMajor, 24);
});

test('checkNodeInline fails open on an unparseable running version', () => {
  assert.equal(checkNodeInline('weird-runtime', ENGINES).ok, true);
});

test('nodeInlineMessage names the found AND required version + the reason', () => {
  const msg = nodeInlineMessage(checkNodeInline('22.0.0', ENGINES));
  assert.ok(msg.includes('22.0.0'), 'names the found version');
  assert.ok(msg.includes('24'), 'names the required major');
  assert.ok(/stripTypeScriptTypes/.test(msg), 'explains why (TS strip)');
  assert.ok(/fs\.watch/.test(msg), 'explains why (fs.watch)');
});

test('node-preflight module imports nothing (dependency-free)', async () => {
  // The whole point: this guard must not transitively link @webjsdev/server
  // (whose dev.js touches Node 24+ builtins). Assert the source has no import
  // statements at all, so it cannot be defeated by a link error on old Node.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const src = readFileSync(
    fileURLToPath(new URL('../../lib/node-preflight.js', import.meta.url)),
    'utf8',
  );
  assert.equal(/^\s*import\s/m.test(src), false, 'node-preflight.js must not import anything');
});
