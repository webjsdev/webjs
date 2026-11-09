/**
 * Cross-runtime check (#1689): a dev rebuild keeps the jspm vendor cache for an
 * ordinary edit and clears it for an edit to the app's `package.json`, through
 * the in-process dev handler on Node and on Bun. It used to clear on every
 * rebuild, so an unpinned app re-resolved its importmap and re-fetched every
 * bundle's SRI after each save. Run under both:
 *
 *   node test/bun/dev-vendor-cache-rebuild.mjs
 *   bun  test/bun/dev-vendor-cache-rebuild.mjs
 *
 * The cache is seeded with one resolve answered by a stubbed fetch, so nothing
 * touches the network. A plain assert script (not node:test) so the SAME file
 * runs on both runtimes; `packages/server/test/dev/vendor-cache-rebuild.test.js`
 * is the unit test with the counterfactual.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { jspmGenerate, _jspmCacheSize } from '../../packages/server/src/vendor/jspm.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

async function seedJspmCache() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ map: { imports: { 'seed-a': 'https://ga.jspm.io/a.js', 'seed-b': 'https://ga.jspm.io/b.js' } } });
  try {
    await jspmGenerate(['seed-a@1.0.0', 'seed-b@1.0.0']);
  } finally {
    globalThis.fetch = realFetch;
  }
}

const root = mkdtempSync(join(tmpdir(), 'webjs-vendor-rebuild-'));
try {
  mkdirSync(join(root, 'app'), { recursive: true });
  writeFileSync(join(root, 'app/page.js'), 'export default () => "ok";\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'vendor-rebuild', type: 'module' }));
  const app = await createRequestHandler({ appDir: root, dev: true, logger: quiet });
  assert.equal((await app.handle(new Request('http://x/'))).status, 200, `the page renders on ${runtime}`);

  await seedJspmCache();
  const seeded = _jspmCacheSize();
  assert.ok(seeded > 0, `the cache holds the seeded resolve on ${runtime}`);
  await app.rebuild({ v: 'page', by: 'app/page.js', why: 'page-module' }, { changed: [join(root, 'app/page.js')] });
  assert.equal(_jspmCacheSize(), seeded, `a page edit keeps the vendor cache on ${runtime}`);
  await app.rebuild({ v: 'reload', by: 'package.json', why: 'unknown-path' }, { changed: [join(root, 'package.json')] });
  assert.equal(_jspmCacheSize(), 0, `a package.json edit clears it on ${runtime}`);

  console.log(`OK  a dev rebuild clears the vendor cache only for a package.json edit on ${runtime} (#1689)`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
