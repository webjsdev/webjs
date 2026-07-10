/**
 * Cross-runtime deploy-build-id test (#899): the published build id folds in a
 * per-deploy fingerprint (WEBJS_BUILD_ID / platform commit id). That id rides
 * the `X-Webjs-Build` response header via the shell-agnostic request handler,
 * so proving the FOLD on each runtime proves the header on each runtime (the
 * node:http and Bun.serve shells carry the same string). Run:
 *
 *   node test/bun/build-id-deploy.mjs
 *   bun  test/bun/build-id-deploy.mjs
 *
 * Imports the real `importmap.js` and exercises deployFingerprint/publishBuildId
 * directly; a plain assert script (not node:test) so the SAME file runs on both.
 */
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const IMPORTMAP = pathToFileURL(join(ROOT, 'packages/server/src/importmap.js')).href;
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const DEPLOY_ENVS = [
  'WEBJS_BUILD_ID', 'RAILWAY_GIT_COMMIT_SHA', 'RAILWAY_DEPLOYMENT_ID',
  'VERCEL_GIT_COMMIT_SHA', 'RENDER_GIT_COMMIT', 'GIT_COMMIT', 'SOURCE_COMMIT', 'SOURCE_VERSION',
];

/** Fresh importmap module + a published id, under the given env. */
async function publishedIdFor(env, tag) {
  const saved = {};
  for (const k of DEPLOY_ENVS) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try {
    const m = await import(`${IMPORTMAP}?build-${tag}`);
    await m.setVendorEntries({ x: '/x.js' }); // a fixed importmap for every case
    m.publishBuildId();
    return { id: m.publishedBuildId(), hash: m.importMapHash(), fp: m.deployFingerprint() };
  } finally {
    for (const k of DEPLOY_ENVS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

const bare = await publishedIdFor({}, 'none');
assert.equal(bare.fp, '', `no env means no fingerprint on ${runtime}`);
assert.equal(bare.id, bare.hash, `no fingerprint means the importmap hash alone on ${runtime}`);

const withId = await publishedIdFor({ WEBJS_BUILD_ID: 'deploy-99' }, 'env');
assert.equal(withId.id, `${withId.hash}.deploy-99`, `WEBJS_BUILD_ID folds into the id on ${runtime}`);
assert.notEqual(withId.id, bare.id, `same map + new fingerprint changes the id (SSR-only deploy) on ${runtime}`);

const withRailway = await publishedIdFor({ RAILWAY_GIT_COMMIT_SHA: 'rw123' }, 'railway');
assert.equal(withRailway.fp, 'rw123', `a platform commit id is detected on ${runtime}`);

// Determinism: no per-process boot-id fallback, so the same inputs on repeat
// imports yield the SAME id (a boot-id fallback would flap and reload-loop).
const again = await publishedIdFor({ WEBJS_BUILD_ID: 'deploy-99' }, 'env2');
assert.equal(again.id, withId.id, `the id is deterministic (no per-process boot-id fallback) on ${runtime}`);

console.log(`OK  deploy fingerprint folds into the published build id on ${runtime} (#899)`);
