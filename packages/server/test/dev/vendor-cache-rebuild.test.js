/**
 * #1689: a dev rebuild clears the jspm vendor cache only when the app's
 * `package.json` changed. It used to clear on EVERY rebuild, so an unpinned app
 * re-resolved its importmap against api.jspm.io and re-fetched every bundle's
 * SRI after each save, although the cache is keyed by the sorted install set
 * (a new bare import misses it anyway) and only a dependency version change can
 * make a hit stale. A bare `rebuild()` that names no files (an embedder) keeps
 * the old clear-everything behaviour.
 *
 * The cache is seeded with one jspm resolve answered by a stubbed fetch, so the
 * test makes no network call.
 *
 * COUNTERFACTUAL: restore the unconditional `clearVendorCache()` in `doRebuild`
 * and the first rebuild below empties the cache.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';
import { jspmGenerate, _jspmCacheSize } from '../../src/vendor/jspm.js';

const root = mkdtempSync(join(tmpdir(), 'webjs-vendor-rebuild-'));
after(() => rmSync(root, { recursive: true, force: true }));

/** Put one successful resolve in the jspm cache without touching the network. */
async function seedJspmCache() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ map: { imports: { 'seed-a': 'https://ga.jspm.io/a.js', 'seed-b': 'https://ga.jspm.io/b.js' } } });
  try {
    await jspmGenerate(['seed-a@1.0.0', 'seed-b@1.0.0']);
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('an ordinary edit keeps the vendor cache, a package.json edit clears it', async () => {
  mkdirSync(join(root, 'app'), { recursive: true });
  writeFileSync(join(root, 'app/page.js'), 'export default () => "ok";\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'vendor-rebuild', type: 'module' }));
  const app = await createRequestHandler({ appDir: root, dev: true });
  assert.equal((await app.handle(new Request('http://x/'))).status, 200);

  await seedJspmCache();
  const seeded = _jspmCacheSize();
  assert.ok(seeded > 0, 'the cache holds the seeded resolve');

  await app.rebuild({ v: 'page', by: 'app/page.js', why: 'page-module' }, { changed: [join(root, 'app/page.js')] });
  assert.equal(_jspmCacheSize(), seeded, 'a page edit keeps every cached resolve');

  await app.rebuild({ v: 'reload', by: 'package.json', why: 'unknown-path' }, { changed: [join(root, 'package.json')] });
  assert.equal(_jspmCacheSize(), 0, 'a package.json edit clears it');

  await seedJspmCache();
  await app.rebuild();
  assert.equal(_jspmCacheSize(), 0, 'a bare rebuild() with no changed files still clears it');
});
