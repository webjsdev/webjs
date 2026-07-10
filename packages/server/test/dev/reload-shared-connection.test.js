/**
 * The dev live-reload client shares ONE connection across all tabs via a
 * SharedWorker (#887). Before this, each tab opened its own `EventSource`, and
 * on an HTTP/1.1 dev server the browser's ~6-connections-per-host cap meant a
 * handful of open tabs held every slot with idle SSE streams and later tabs
 * could not fetch their HTML. Here we drive the two dev routes directly through
 * the handler (no browser needed; the served scripts are pure strings) and
 * assert the client uses the SharedWorker with an EventSource fallback and the
 * worker holds the single stream and relays to every port.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-reload-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(webjs) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.js'), "export default function P() { return 'ok'; }\n");
  if (webjs) writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', webjs }));
  return appDir;
}

test('dev serves the reload SharedWorker, and the client uses it with a direct EventSource fallback', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: true });

  const client = await app.handle(new Request('http://x/__webjs/reload.js'));
  assert.equal(client.status, 200);
  assert.match(client.headers.get('content-type') || '', /javascript/);
  const clientSrc = await client.text();
  // The primary path is one shared connection through the SharedWorker.
  assert.match(clientSrc, /new SharedWorker\(/, 'client constructs a SharedWorker');
  assert.match(clientSrc, /reload-worker\.js/, 'client points the worker at the worker route');
  // The fallback keeps the original per-tab EventSource where SharedWorker is
  // unavailable, and the whole thing is guarded so a construction failure (a
  // strict dev CSP) degrades instead of breaking.
  assert.match(clientSrc, /typeof SharedWorker/, 'client feature-detects SharedWorker');
  assert.match(clientSrc, /new EventSource\(/, 'client keeps an EventSource fallback');
  assert.match(clientSrc, /catch\s*\(_\)\s*\{\s*__webjsDirectEvents/, 'a worker failure falls back');
  // The overlay still renders on the main thread (a worker has no DOM).
  assert.match(clientSrc, /renderDevOverlay/, 'the error overlay still renders in the client');

  const worker = await app.handle(new Request('http://x/__webjs/reload-worker.js'));
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get('content-type') || '', /javascript/);
  const workerSrc = await worker.text();
  // The worker inlines the shared relay module and bootstraps it with the real
  // globals (the relay behaviour itself is exercised in the browser test).
  assert.match(workerSrc, /function startReloadWorker/, 'the worker inlines the relay module');
  assert.match(workerSrc, /startReloadWorker\(self, EventSource, "\/__webjs\/events"\)/, 'it wires the single events stream to the worker');
  assert.match(workerSrc, /scope\.onconnect/, 'the relay accepts a port per tab');
  assert.match(workerSrc, /lastError = null/, 'the relay clears the cached error on reload');
  assert.match(workerSrc, /if \(lastError != null\)/, 'a late-joining tab gets the current error');
});

test('both reload routes 404 in prod (never shipped to a production page)', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: false });
  const client = await app.handle(new Request('http://x/__webjs/reload.js'));
  const worker = await app.handle(new Request('http://x/__webjs/reload-worker.js'));
  assert.equal(client.status, 404, 'reload client is dev-only');
  assert.equal(worker.status, 404, 'reload worker is dev-only');
});

test('the worker events URL carries the base path under a sub-path deploy (#256)', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: true });
  const worker = await (await app.handle(new Request('http://x/app/__webjs/reload-worker.js'))).text();
  assert.match(worker, /startReloadWorker\(self, EventSource, "\/app\/__webjs\/events"\)/, 'events URL is base-path prefixed in the worker');
  const client = await (await app.handle(new Request('http://x/app/__webjs/reload.js'))).text();
  assert.match(client, /reload-worker\.js/, 'client references the worker');
  assert.match(client, /\/app\/__webjs\/reload-worker\.js/, 'worker URL is base-path prefixed in the client');
});
