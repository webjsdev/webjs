/**
 * Cross-runtime check (#1689): a dev page render that reports an error answers
 * with `x-webjs-dev-error: 1` through the in-process dev handler on Node and on
 * Bun, a good render does not, and production never does. The client router's
 * in-place refresh reads it to keep the last good page under the overlay. Run
 * under both:
 *
 *   node test/bun/dev-error-header.mjs
 *   bun  test/bun/dev-error-header.mjs
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes;
 * `packages/server/test/dev/dev-error-header.test.js` is the unit test with the
 * counterfactual.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../packages/server/src/dev.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const root = mkdtempSync(join(tmpdir(), 'webjs-dev-error-header-'));
try {
  mkdirSync(join(root, 'app/broken'), { recursive: true });
  writeFileSync(join(root, 'app/page.js'), 'export default () => "fine";\n');
  writeFileSync(join(root, 'app/broken/page.js'), 'export default () => { throw new Error("render failed"); };\n');

  const dev = await createRequestHandler({ appDir: root, dev: true, logger: quiet });
  const bad = await dev.handle(new Request('http://x/broken'));
  assert.equal(bad.status, 500, `the broken page is a 500 on ${runtime}`);
  assert.equal(bad.headers.get('x-webjs-dev-error'), '1', `a dev render error is marked on ${runtime}`);
  const good = await dev.handle(new Request('http://x/'));
  assert.equal(good.headers.get('x-webjs-dev-error'), null, `a good render is not on ${runtime}`);

  const prod = await createRequestHandler({ appDir: root, dev: false, logger: quiet });
  const prodBad = await prod.handle(new Request('http://x/broken'));
  assert.equal(prodBad.headers.get('x-webjs-dev-error'), null, `production never marks it on ${runtime}`);

  console.log(`OK  a dev render error answers with x-webjs-dev-error on ${runtime} (#1689)`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
