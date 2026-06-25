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

test('appDeclaredVersion: reads the cwd package.json dep, returns null when missing/unsafe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-iw-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    dependencies: { '@webjsdev/server': '^0.8.0', local: 'workspace:*' },
  }));
  assert.equal(appDeclaredVersion('@webjsdev/server', dir), '^0.8.0');
  assert.equal(appDeclaredVersion('local', dir), null, 'workspace: is not inline-safe');
  assert.equal(appDeclaredVersion('@webjsdev/missing', dir), null);
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

test('importWebjsdev: bare ENOENT with no declared version rethrows', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-iw3-'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: {} }));
  t.mock.method(process, 'cwd', () => cwd);
  await assert.rejects(
    importWebjsdev('@webjsdev/server', () => Promise.reject(new Error('boom'))),
    /boom/,
  );
});
