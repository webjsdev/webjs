// #709: under Bun zero-install a bare @webjsdev/server import ENOENTs; the cli
// retries with the version the app declares, inline. These test the pure logic
// with an injected importer (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlineSafeVersion, appDeclaredVersion, importWebjsdev } from '../../lib/import-webjsdev.js';

test('inlineSafeVersion: accepts exact + single range, rejects caret-prerelease/wildcard/protocol', () => {
  for (const v of ['0.8.37', '^0.8.0', '~0.8', '>=0.8.0', '1.0.0-rc.3']) assert.equal(inlineSafeVersion(v), true, v);
  for (const v of ['^1.0.0-rc.3', '*', 'x', 'latest', 'workspace:*', 'file:../x', '>=1 <2', '']) assert.equal(inlineSafeVersion(v), false, v);
});

test('appDeclaredVersion: app pkg first, then the cli pkg fallback, null when neither', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-iw-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    dependencies: { '@webjsdev/server': '^0.8.0', local: 'workspace:*' },
  }));
  assert.equal(appDeclaredVersion('@webjsdev/server', dir), '^0.8.0', 'app declares it -> app version');
  assert.equal(appDeclaredVersion('local', dir), null, 'workspace: is not inline-safe');
  // @webjsdev/mcp is NOT in the app deps, but the cli's own package.json declares
  // it, so the fallback supplies the cli-declared range (covers webjs mcp / check --json).
  assert.match(appDeclaredVersion('@webjsdev/mcp', dir) || '', /^[\^~]?\d/, 'cli-own fallback for an undeclared @webjsdev/* dep');
  assert.equal(appDeclaredVersion('@webjsdev/does-not-exist', dir), null, 'neither declares it -> null');
});

test('importWebjsdev: bare success returns it, no retry', async () => {
  let calls = 0;
  const r = await importWebjsdev('@webjsdev/server', (s) => { calls++; return Promise.resolve({ spec: s }); });
  assert.deepEqual(r, { spec: '@webjsdev/server' });
  assert.equal(calls, 1, 'no retry on success');
});

test('importWebjsdev: bare ENOENT retries with the app-declared inline version (subpath preserved)', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-iw2-'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: { '@webjsdev/server': '^0.8.0' } }));
  t.mock.method(process, 'cwd', () => cwd);
  const seen = [];
  const importer = (s) => { seen.push(s); if (s.includes('@^') || s.includes('@0.')) return Promise.resolve({ ok: s }); return Promise.reject(new Error('ENOENT')); };
  const r = await importWebjsdev('@webjsdev/server/check', importer);
  assert.deepEqual(seen, ['@webjsdev/server/check', '@webjsdev/server@^0.8.0/check']);
  assert.deepEqual(r, { ok: '@webjsdev/server@^0.8.0/check' });
});

test('importWebjsdev: a non-resolution (load-time) throw is rethrown WITHOUT a retry', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-iw3-'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: { '@webjsdev/server': '^0.8.0' } }));
  t.mock.method(process, 'cwd', () => cwd);
  let calls = 0;
  // A real error from inside the module's eval (not ENOENT): must NOT retry, or
  // it would re-run the module's side effects and mask the real error.
  await assert.rejects(
    importWebjsdev('@webjsdev/server', () => { calls++; return Promise.reject(new TypeError('x is not a function')); }),
    /not a function/,
  );
  assert.equal(calls, 1, 'no retry on a non-resolution error');
});

test('importWebjsdev: a resolution error for a dep NEITHER app nor cli declares rethrows', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-iw4-'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: {} }));
  t.mock.method(process, 'cwd', () => cwd);
  await assert.rejects(
    importWebjsdev('@webjsdev/does-not-exist', () => Promise.reject(new Error('ENOENT'))),
    /ENOENT/,
  );
});
