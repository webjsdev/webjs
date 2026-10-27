/**
 * The dev cache-bust import specifier (#1550). On Node the query rides the file
 * URL; on Bun, which drops a `file://` specifier's query, it rides a plain
 * absolute path. Outside dev it is the plain file URL. The last test imports a
 * module twice through the helper on WHICHEVER runtime runs this file and
 * asserts the edit is seen (the counterfactual: a file URL plus query returns
 * the stale module on Bun).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { devImportSpecifier, devImport, clearProdImportCache } from '../../src/dev-import.js';

const FILE = '/srv/app/app/page.ts';

test('outside dev the specifier is the file URL, with no query', () => {
  assert.equal(devImportSpecifier(FILE, false, { bun: false }), pathToFileURL(FILE).toString());
  assert.equal(devImportSpecifier(FILE, false, { bun: true }), pathToFileURL(FILE).toString());
});

test('in dev on Node the query rides the file URL', () => {
  const s = devImportSpecifier(FILE, true, { bun: false, version: () => 'v42' });
  assert.equal(s, 'file:///srv/app/app/page.ts?t=v42');
});

test('in dev on Bun the query rides the plain path', () => {
  const s = devImportSpecifier(FILE, true, { bun: true, version: () => 'v42' });
  assert.equal(s, '/srv/app/app/page.ts?t=v42');
});

test('on Bun a path that already holds ? or # falls back to the file URL', () => {
  for (const f of ['/srv/a?b/page.ts', '/srv/a#b/page.ts']) {
    assert.match(devImportSpecifier(f, true, { bun: true }), /^file:\/\//);
  }
});

test('the query names the content: same bytes, same specifier; new bytes, a new one (#1575)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-import-'));
  try {
    const file = join(dir, 'm.mjs');
    writeFileSync(file, 'export default "a1";\n');
    const first = devImportSpecifier(file, true);
    // A random query per call made every request a new, never-freed module.
    assert.equal(devImportSpecifier(file, true), first);
    // Same length, written immediately: a coarse mtime cannot tell these apart.
    writeFileSync(file, 'export default "a2";\n');
    assert.notEqual(devImportSpecifier(file, true), first);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unreadable file gets a unique specifier each call', () => {
  assert.notEqual(devImportSpecifier('/nope/x.ts', true, { bun: true }), devImportSpecifier('/nope/x.ts', true, { bun: true }));
});

test('a re-import through the helper sees an edit on this runtime', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-import-'));
  try {
    const file = join(dir, 'm.mjs');
    writeFileSync(file, 'export default "one";\n');
    assert.equal((await import(devImportSpecifier(file, true))).default, 'one');
    writeFileSync(file, 'export default "two";\n');
    assert.equal((await import(devImportSpecifier(file, true))).default, 'two');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------ the prod import memo (#1644) ------------ */

test('outside dev, devImport hands back the same module namespace, before and after a clear', async () => {
  // `devImport` is an async function, so each call wraps the memoized import
  // in a fresh outer promise; the namespace is what must be shared. The
  // loader-count test below is the counterfactual that proves the memo.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-prod-import-'));
  try {
    const file = join(dir, 'memo.mjs');
    writeFileSync(file, 'export default "memo";\n');
    clearProdImportCache();
    const [a, b] = await Promise.all([devImport(file, false), devImport(file, false)]);
    assert.equal(a, b, 'concurrent calls share one evaluation');
    assert.equal(a.default, 'memo');
    clearProdImportCache();
    const c = await devImport(file, false);
    assert.equal(c, a, 'a cleared memo goes through the loader again and lands on the same cached module');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('outside dev, a module that throws at evaluation rejects on every call (no poisoned memo)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-prod-import-throw-'));
  try {
    const file = join(dir, 'boom.mjs');
    writeFileSync(file, 'throw new Error("boom at load");\n');
    clearProdImportCache();
    await assert.rejects(devImport(file, false), /boom at load/);
    await assert.rejects(devImport(file, false), /boom at load/, 'the rejection was evicted, so the second call re-imports and rejects again rather than hanging or resolving undefined');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('outside dev on Node, the loader resolves a route module once per build, not once per call', { skip: !!process.versions.bun && 'module.registerHooks is Node-only; the Bun half is the identity test above' }, async () => {
  const { registerHooks } = await import('node:module');
  const dir = mkdtempSync(join(tmpdir(), 'webjs-prod-import-hooks-'));
  try {
    const file = join(dir, 'counted.mjs');
    writeFileSync(file, 'export default "counted";\n');
    const target = pathToFileURL(file).toString();
    let resolves = 0;
    const hook = registerHooks({
      resolve(specifier, context, next) {
        if (specifier === target) resolves++;
        return next(specifier, context);
      },
    });
    try {
      clearProdImportCache();
      await devImport(file, false);
      await devImport(file, false);
      await devImport(file, false);
      assert.equal(resolves, 1, 'three renders, one loader resolve (without the memo it is three)');
    } finally {
      hook.deregister();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
