/**
 * Integration tests for #830: the service-worker root assets. A worker
 * registered at /sw.js scopes to the origin root, so the framework must serve
 * public/sw.js (and its offline fallback) at the SITE ROOT, not only at
 * /public/*, and the /sw.js response must carry Service-Worker-Allowed: / so it
 * controls the whole origin.
 *
 * Exercised through createRequestHandler against a minimal app fixture, in dev
 * AND prod (dev: false), since the static branch is the shared runtime-agnostic
 * handler (so this also covers the Bun listener, which calls the same handle()).
 *
 * COUNTERFACTUAL: assert GET /sw.js is 200. Reverting the ROOT_ASSETS remap in
 * dev.js makes /sw.js fall through to a 404, turning this red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-rootassets-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp() {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  mkdirSync(join(appDir, 'public'), { recursive: true });
  writeFileSync(join(appDir, 'public', 'sw.js'), "self.addEventListener('install', () => {});\n");
  writeFileSync(join(appDir, 'public', 'offline.html'), '<!doctype html><title>offline</title>\n');
  return appDir;
}

for (const dev of [true, false]) {
  test(`/sw.js serves public/sw.js at the site root with Service-Worker-Allowed (dev=${dev})`, async () => {
    const app = await createRequestHandler({ appDir: makeApp(), dev });
    const res = await app.handle(new Request('http://x/sw.js'));
    assert.equal(res.status, 200, '/sw.js is served at the root');
    assert.match(res.headers.get('content-type') || '', /javascript/, 'served as JS');
    assert.equal(res.headers.get('service-worker-allowed'), '/',
      '/sw.js opts into the root scope');
    assert.match(await res.text(), /addEventListener/, 'body is the worker source');
  });

  test(`/offline.html serves public/offline.html at the site root (dev=${dev})`, async () => {
    const app = await createRequestHandler({ appDir: makeApp(), dev });
    const res = await app.handle(new Request('http://x/offline.html'));
    assert.equal(res.status, 200, '/offline.html is served at the root');
    assert.match(await res.text(), /offline/, 'body is the offline fallback');
  });
}

test('the underlying /public/* path still serves (backward compatible)', async () => {
  const app = await createRequestHandler({ appDir: makeApp(), dev: true });
  const res = await app.handle(new Request('http://x/public/sw.js'));
  assert.equal(res.status, 200, '/public/sw.js still works');
  // The root-scope header is only added for the root /sw.js path.
  assert.equal(res.headers.get('service-worker-allowed'), null,
    'the /public/* path does not carry the root-scope header');
});

test('a non-remapped root path is not exposed (no traversal, no accidental root serving)', async () => {
  const appDir = makeApp();
  writeFileSync(join(appDir, 'secret.txt'), 'nope\n');
  const app = await createRequestHandler({ appDir, dev: true });
  const res = await app.handle(new Request('http://x/secret.txt'));
  assert.notEqual(res.status, 200, 'only the allowlisted root assets are remapped');
});
