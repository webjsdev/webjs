/**
 * #1689: a dev page render that reports an error answers with
 * `x-webjs-dev-error: 1`, so the client router's in-place refresh leaves the
 * last good page on screen under the dev overlay instead of applying the error
 * page (which shares no boundary with it and hard-navigates). A good render,
 * a speculative prefetch (which raises no overlay, #1047) and production never
 * carry it.
 *
 * COUNTERFACTUAL: drop the header in the dev page wrapper (`dev/serve.js`) and
 * the first assertion fails.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };
const root = mkdtempSync(join(tmpdir(), 'webjs-dev-error-header-'));
after(() => rmSync(root, { recursive: true, force: true }));

function makeApp(name) {
  const appDir = join(root, name);
  mkdirSync(join(appDir, 'app/broken'), { recursive: true });
  writeFileSync(join(appDir, 'app/page.js'), 'export default () => "fine";\n');
  writeFileSync(join(appDir, 'app/broken/page.js'), 'export default () => { throw new Error("render failed"); };\n');
  return appDir;
}

test('a dev render that reports an error carries the header; a good one does not', async () => {
  const app = await createRequestHandler({ appDir: makeApp('dev'), dev: true, logger: quiet });
  const bad = await app.handle(new Request('http://x/broken'));
  assert.equal(bad.status, 500);
  assert.equal(bad.headers.get('x-webjs-dev-error'), '1', 'the failing render is marked');
  const good = await app.handle(new Request('http://x/'));
  assert.equal(good.status, 200);
  assert.equal(good.headers.get('x-webjs-dev-error'), null, 'a good render is not');
  // The error is retained, but a render of the same page that fails AGAIN is a
  // new frame, so it is marked again.
  const again = await app.handle(new Request('http://x/broken'));
  assert.equal(again.headers.get('x-webjs-dev-error'), '1');
});

test('a speculative prefetch of a failing page is never marked', async () => {
  const app = await createRequestHandler({ appDir: makeApp('prefetch'), dev: true, logger: quiet });
  const res = await app.handle(new Request('http://x/broken', { headers: { 'x-webjs-prefetch': '1' } }));
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('x-webjs-dev-error'), null);
});

test('production never sends the header', async () => {
  const app = await createRequestHandler({ appDir: makeApp('prod'), dev: false, logger: quiet });
  const res = await app.handle(new Request('http://x/broken'));
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('x-webjs-dev-error'), null);
});
