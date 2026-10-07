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
  const s = devImportSpecifier(FILE, true, { bun: false, now: () => 42 });
  assert.match(s, /^file:\/\/\/srv\/app\/app\/page\.ts\?t=42-[a-z0-9]+$/);
});

test('in dev on Bun the query rides the plain path', () => {
  const s = devImportSpecifier(FILE, true, { bun: true, now: () => 42 });
  assert.match(s, /^\/srv\/app\/app\/page\.ts\?t=42-[a-z0-9]+$/);
});

test('on Bun a path that already holds ? or # falls back to the file URL', () => {
  for (const f of ['/srv/a?b/page.ts', '/srv/a#b/page.ts']) {
    assert.match(devImportSpecifier(f, true, { bun: true }), /^file:\/\//);
  }
});

test('two specifiers for the same file differ', () => {
  assert.notEqual(devImportSpecifier(FILE, true, { bun: true, now: () => 1 }), devImportSpecifier(FILE, true, { bun: true, now: () => 1 }));
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
