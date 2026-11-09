/**
 * #1689: under `webjs dev`, `/sw.js` is a kill switch. A caching worker on a
 * dev origin serves `.js` and `.css` stale-while-revalidate, so a tab that once
 * registered one is an edit behind forever. The dev server answers `/sw.js`
 * with a worker that clears every cache and unregisters, whether or not the app
 * ships a `public/sw.js`, and production keeps serving the app's own file.
 *
 * The scaffold template's `isCacheableAsset` is checked too: it must leave every
 * framework probe and dev-reload path to the server, so a worker a production
 * build registered can never answer the reload client's requests.
 *
 * COUNTERFACTUAL: drop the dev branch in `tryServePublicAsset` and the dev
 * `/sw.js` serves the app's caching worker (or 404s with none).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { createRequestHandler } from '../../src/dev.js';
import { DEV_SERVICE_WORKER_SOURCE } from '../../src/dev/dev-service-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_WORKER = "self.addEventListener('fetch', () => {}); // APP_WORKER\n";

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-dev-sw-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp({ worker } = {}) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.js'), 'export default () => "ok";\n');
  if (worker) {
    mkdirSync(join(appDir, 'public'), { recursive: true });
    writeFileSync(join(appDir, 'public', 'sw.js'), worker);
  }
  return appDir;
}

for (const worker of [APP_WORKER, undefined]) {
  test(`dev answers /sw.js with the kill switch (${worker ? 'the app ships a worker' : 'the app ships none'})`, async () => {
    const app = await createRequestHandler({ appDir: makeApp({ worker }), dev: true });
    const res = await app.handle(new Request('http://x/sw.js'));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /javascript/);
    assert.equal(res.headers.get('service-worker-allowed'), '/', 'it can replace a worker registered at the root scope');
    assert.match(res.headers.get('cache-control') || '', /no-store/, 'a browser never runs a cached copy');
    const body = await res.text();
    assert.equal(body, DEV_SERVICE_WORKER_SOURCE);
    assert.doesNotMatch(body, /APP_WORKER/, 'the app worker is never served in dev');
  });
}

test('production serves the app worker unchanged', async () => {
  const app = await createRequestHandler({ appDir: makeApp({ worker: APP_WORKER }), dev: false });
  const res = await app.handle(new Request('http://x/sw.js'));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /APP_WORKER/);
});

test('the kill switch clears every cache, unregisters, claims the tabs, and answers no fetch', async () => {
  const handlers = {};
  const calls = [];
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => { calls.push('skipWaiting'); },
    registration: { unregister: async () => { calls.push('unregister'); return true; } },
    clients: { claim: async () => { calls.push('claim'); } },
  };
  const caches = {
    keys: async () => ['webjs-a', 'webjs-b'],
    delete: async (k) => { calls.push('delete ' + k); return true; },
  };
  const logs = [];
  vm.runInNewContext(DEV_SERVICE_WORKER_SOURCE, { self, caches, Promise, console: { info: (m) => logs.push(m) } });
  assert.equal(handlers.fetch, undefined, 'no fetch listener, so it never answers a request');
  handlers.install({});
  let done;
  handlers.activate({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(calls, ['skipWaiting', 'delete webjs-a', 'delete webjs-b', 'unregister', 'claim']);
  assert.deepEqual(logs, ['[webjs] the service worker is off under webjs dev; test offline behaviour with npm run start']);
});

test('the scaffold worker leaves every framework probe and dev-reload path to the server', () => {
  const src = readFileSync(resolve(__dirname, '../../../cli/templates/public/sw.js'), 'utf8');
  const sandbox = {
    self: { location: new URL('https://app.test/sw.js?v=1'), addEventListener: () => {} },
    URL,
  };
  vm.runInNewContext(src + '\nself.__isCacheableAsset = isCacheableAsset;', sandbox);
  const isCacheableAsset = sandbox.self.__isCacheableAsset;
  for (const p of ['/__webjs/version', '/__webjs/reload-worker.js', '/__webjs/reload.js', '/__webjs/events', '/__webjs/action/abc/fn', '/__webjs/ready', '/__webjs/dev/status']) {
    assert.equal(isCacheableAsset(p), false, p);
  }
  for (const p of ['/__webjs/core/webjs-core-browser.js', '/__webjs/vendor/x.js', '/public/app.css', '/components/x.ts']) {
    assert.equal(isCacheableAsset(p), true, p);
  }
});
