/**
 * Verifies the publish-time `@webjsdev/core` dist build (#145) produces a
 * SINGLE self-contained browser bundle, not a fan of per-subpath entries plus
 * code-split chunks. The browser surface ships as one request:
 * `webjs-core-browser.js`, with no `chunk-*.js` and no per-subpath browser
 * entries (directives / context / task / client-router are folded in, since
 * `index-browser.js` already re-exports them and the package.json `exports`
 * point those subpaths at the one bundle).
 *
 * Runs the actual build (esbuild, ~15ms) into `packages/core/dist` (gitignored,
 * regenerated at prepublish) and asserts the output shape. Guards against a
 * regression that re-enables `splitting` or re-adds a per-subpath entry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = join(ROOT, 'packages/core/dist');

test('core dist build: one chunkless browser bundle, browser subpaths folded in', () => {
  // Build fresh so the assertions reflect the current build script, not a
  // stale dist left over from a prior run.
  execFileSync('node', [join(ROOT, 'scripts/build-framework-dist.js')], { cwd: ROOT, stdio: 'pipe' });

  const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));

  // No code-split chunks: splitting must stay off.
  const chunks = files.filter((f) => f.startsWith('chunk-'));
  assert.deepEqual(chunks, [], `expected no chunk-*.js, got ${chunks.join(', ')}`);

  // The browser bundle exists and is self-contained (imports no chunk).
  assert.ok(files.includes('webjs-core-browser.js'), 'webjs-core-browser.js must be built');
  const browserSrc = readFileSync(join(DIST, 'webjs-core-browser.js'), 'utf8');
  assert.ok(!/from\s*["']\.\/chunk-/.test(browserSrc), 'browser bundle must not import a chunk');

  // The per-subpath browser entries are GONE: those subpaths resolve to the
  // one browser bundle via package.json exports, so building them separately
  // would be dead weight.
  for (const gone of ['webjs-core-directives.js', 'webjs-core-context.js', 'webjs-core-task.js', 'webjs-core-client-router.js']) {
    assert.ok(!files.includes(gone), `${gone} should no longer be built (folded into webjs-core-browser.js)`);
  }

  // What stays its own file: the Node full bundle, the on-demand lazy loader,
  // and the test-only helpers.
  for (const kept of ['webjs-core.js', 'webjs-core-lazy-loader.js', 'webjs-core-testing.js']) {
    assert.ok(files.includes(kept), `${kept} must be built`);
  }
});

test('core dist build: the browser bundle actually exports the folded surface', async () => {
  // index-browser.js re-exports directives, context, task, and the client
  // router, so each `import { ... } from '@webjsdev/core/<subpath>'` can pick
  // its named exports from the one bundle. Confirm they are present.
  const mod = await import(join(DIST, 'webjs-core-browser.js'));
  for (const name of ['html', 'render', 'WebComponent', 'enableClientRouter', 'navigate', 'repeat', 'unsafeHTML', 'createContext', 'Task', 'signal']) {
    assert.ok(name in mod, `webjs-core-browser.js must export ${name}`);
  }
  // Server-only symbols stay OUT of the browser bundle (the #128 split).
  for (const serverOnly of ['renderToString', 'renderToStream', 'expose', 'setCspNonceProvider']) {
    assert.ok(!(serverOnly in mod), `webjs-core-browser.js must NOT export server-only ${serverOnly}`);
  }
});
