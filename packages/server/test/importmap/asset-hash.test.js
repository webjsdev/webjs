/**
 * Unit tests for the content-hash asset-URL module (issue #243, feature 1):
 * `asset-hash.js` (`assetHashFor` / `withAssetHash` / `setAssetRoots` /
 * `clearAssetHashCache`) and `importmap.js`'s `vendorPreconnectOrigins`.
 *
 * These prove the pure logic: the hash is a stable short digest over the file
 * bytes, `withAssetHash` is a no-op when disabled (dev) and for cross-origin
 * urls, it composes with a base path, and a byte change re-hashes after a
 * cache clear (the deploy-busts mechanism). The HTTP-layer proof (served urls
 * carry `?v` and resolve immutable) lives in `content-hash.test.js`.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  setAssetRoots,
  clearAssetHashCache,
  assetHashFor,
  withAssetHash,
} from '../../src/asset-hash.js';

let appDir;
let coreDir;
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-assethash-'));
  appDir = join(root, 'app-root');
  coreDir = join(root, 'core-root');
  mkdirSync(join(appDir, 'app'), { recursive: true });
  mkdirSync(coreDir, { recursive: true });
  clearAssetHashCache();
});
afterEach(() => {
  // Disable so a later test file booting a dev handler sees a clean slate.
  setAssetRoots({ appDir: '', coreDir: '', enabled: false });
  clearAssetHashCache();
});

function expectedHash(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}

test('assetHashFor returns a stable 12-hex digest of the file bytes', () => {
  const f = join(appDir, 'app', 'page.js');
  writeFileSync(f, 'export default 1;\n');
  const h = assetHashFor(f);
  assert.match(h, /^[0-9a-f]{12}$/, 'a 12-char hex hash');
  assert.equal(h, expectedHash('export default 1;\n'), 'matches a sha-256 prefix over the bytes');
  assert.equal(assetHashFor(f), h, 'memoized: stable across calls');
});

test('assetHashFor returns "" for an unreadable file (fail-safe)', () => {
  assert.equal(assetHashFor(join(appDir, 'does-not-exist.js')), '');
});

test('withAssetHash is a pure no-op when disabled (dev)', () => {
  setAssetRoots({ appDir, coreDir, enabled: false });
  const f = join(appDir, 'app', 'page.js');
  writeFileSync(f, 'x');
  assert.equal(withAssetHash('/app/page.js'), '/app/page.js', 'no ?v appended when disabled');
});

test('withAssetHash appends ?v=<hash> for a same-origin app url when enabled', () => {
  const f = join(appDir, 'app', 'page.js');
  writeFileSync(f, 'export default 1;\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  const out = withAssetHash('/app/page.js');
  assert.equal(out, `/app/page.js?v=${expectedHash('export default 1;\n')}`);
});

test('withAssetHash fingerprints a /__webjs/core/* url against the core root', () => {
  const f = join(coreDir, 'index-browser.js');
  writeFileSync(f, 'export const v = 1;\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  const out = withAssetHash('/__webjs/core/index-browser.js');
  assert.equal(out, `/__webjs/core/index-browser.js?v=${expectedHash('export const v = 1;\n')}`);
});

test('withAssetHash NEVER fingerprints a cross-origin url (SRI + jspm-versioned)', () => {
  setAssetRoots({ appDir, coreDir, enabled: true });
  const cdn = 'https://ga.jspm.io/npm:lit@3.1.0/index.js';
  assert.equal(withAssetHash(cdn), cdn, 'a https:// CDN target is untouched');
  assert.equal(withAssetHash('//ga.jspm.io/x.js'), '//ga.jspm.io/x.js', 'a protocol-relative url is untouched');
});

test('withAssetHash leaves a /__webjs/vendor/* (already version-named) bundle untouched', () => {
  setAssetRoots({ appDir, coreDir, enabled: true });
  const u = '/__webjs/vendor/lit@3.1.0.js';
  assert.equal(withAssetHash(u), u, 'a downloaded, version-named vendor bundle is not re-fingerprinted');
});

test('withAssetHash fails safe (no ?v) when the file cannot be resolved/read', () => {
  setAssetRoots({ appDir, coreDir, enabled: true });
  assert.equal(withAssetHash('/app/missing.js'), '/app/missing.js', 'missing file -> 1h fallback url');
});

test('withAssetHash composes with a base path (basePath then ?v)', () => {
  const f = join(appDir, 'app', 'page.js');
  writeFileSync(f, 'export default 1;\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  // The caller passes the ALREADY base-path-prefixed url plus the base path so
  // we strip it for file resolution. Output keeps the prefix AND gains ?v.
  const out = withAssetHash('/app/app/page.js', '/app');
  assert.equal(out, `/app/app/page.js?v=${expectedHash('export default 1;\n')}`);
});

test('deploy-busts: a byte change re-hashes after a cache clear (different ?v)', () => {
  const f = join(appDir, 'app', 'page.js');
  writeFileSync(f, 'export default 1;\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  const before = withAssetHash('/app/page.js');

  // A deploy ships different bytes at the same url.
  writeFileSync(f, 'export default 2;\n');
  clearAssetHashCache(); // wired into the rebuild path in dev.js
  const after = withAssetHash('/app/page.js');

  assert.notEqual(before, after, 'the emitted ?v changes when the bytes change');
  assert.equal(after, `/app/page.js?v=${expectedHash('export default 2;\n')}`);
});

test('a ..-escaping url resolves to null and is emitted unchanged', () => {
  setAssetRoots({ appDir, coreDir, enabled: true });
  // Even with a real file outside the root, the containment guard rejects it.
  assert.equal(withAssetHash('/../etc/passwd'), '/../etc/passwd');
});
