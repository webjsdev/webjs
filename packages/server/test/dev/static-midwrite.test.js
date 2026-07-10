/**
 * In dev, a static asset (public/tailwind.css and friends) is often rewritten
 * by an external watcher (tailwindcss --watch, esbuild, ...) with a
 * truncate-then-write, so the file is 0 bytes for a short window during a
 * rebuild. A hot reload that lands in that window used to serve empty CSS and
 * the page painted unstyled (#891). fileResponse now rides over the mid-rewrite
 * in dev: a 0-byte read is retried briefly so the truncated content never
 * reaches the browser. Prod has no such watcher and is left untouched.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-midwrite-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

const CONTENT = 'body{color:red}'.repeat(500);

function makeApp() {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.js'), "export default () => 'ok';\n");
  mkdirSync(join(appDir, 'public'), { recursive: true });
  writeFileSync(join(appDir, 'public', 'style.css'), CONTENT);
  return appDir;
}

test('dev rides over a mid-rewrite: a 0-byte read is retried and serves the settled CSS', async () => {
  const appDir = makeApp();
  const cssPath = join(appDir, 'public', 'style.css');
  const app = await createRequestHandler({ appDir, dev: true });

  // Simulate the external watcher: truncate now, rewrite the content shortly
  // after (inside the retry window).
  truncateSync(cssPath, 0);
  setTimeout(() => writeFileSync(cssPath, CONTENT), 100);

  const res = await app.handle(new Request('http://x/public/style.css'));
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.equal(body.length, CONTENT.length, 'the full CSS is served, not the mid-rewrite empty read');
});

test('COUNTERFACTUAL: prod does not retry, so a mid-rewrite empty read is served as-is', async () => {
  const appDir = makeApp();
  const cssPath = join(appDir, 'public', 'style.css');
  const app = await createRequestHandler({ appDir, dev: false });

  truncateSync(cssPath, 0);
  const res = await app.handle(new Request('http://x/public/style.css'));
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.equal(body.length, 0, 'prod serves the current bytes without the dev retry');
});

test('a genuinely non-empty asset is served immediately (no added latency)', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: true });
  const res = await app.handle(new Request('http://x/public/style.css'));
  assert.equal((await res.text()).length, CONTENT.length, 'a normal read is unaffected');
});
