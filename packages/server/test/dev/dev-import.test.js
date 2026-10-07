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
import { devImportSpecifier } from '../../src/dev-import.js';

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
