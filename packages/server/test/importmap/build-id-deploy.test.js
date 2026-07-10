/**
 * #899: the published build id must reflect a DEPLOY, not just the importmap.
 * An SSR-only change (syntax highlighting, a template tweak) leaves the
 * importmap byte-identical, so before this the build id never changed and the
 * client router never detected the deploy, serving stale pre-deploy HTML on
 * soft nav until a manual refresh. A per-deploy fingerprint (WEBJS_BUILD_ID or
 * a detected platform commit id) folded into the id makes ANY deploy bump it.
 *
 * Each case fresh-imports importmap.js so the module singleton is clean, and
 * saves/restores the env it pokes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const MOD = '../../src/importmap.js';
const DEPLOY_ENVS = [
  'WEBJS_BUILD_ID', 'RAILWAY_GIT_COMMIT_SHA', 'RAILWAY_DEPLOYMENT_ID',
  'VERCEL_GIT_COMMIT_SHA', 'RENDER_GIT_COMMIT', 'GIT_COMMIT', 'SOURCE_COMMIT', 'SOURCE_VERSION',
];

/** Run `fn` with the deploy env vars set to `env`, restoring afterward. */
async function withEnv(env, fn) {
  const saved = {};
  for (const k of DEPLOY_ENVS) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try { return await fn(); }
  finally {
    for (const k of DEPLOY_ENVS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test('with no deploy fingerprint, the published id is exactly the importmap hash (unchanged)', async () => {
  await withEnv({}, async () => {
    const m = await import(`${MOD}?deploy-none`);
    await m.setVendorEntries({ x: '/x.js' });
    m.publishBuildId();
    assert.notEqual(m.importMapHash(), '');
    assert.equal(m.publishedBuildId(), m.importMapHash(), 'no fingerprint means importmap-hash only');
    assert.equal(m.deployFingerprint(), '', 'no env means empty fingerprint');
  });
});

test('WEBJS_BUILD_ID is folded into the published id (an SSR-only deploy bumps it)', async () => {
  await withEnv({ WEBJS_BUILD_ID: 'deploy-abc123' }, async () => {
    const m = await import(`${MOD}?deploy-env`);
    await m.setVendorEntries({ x: '/x.js' });
    m.publishBuildId();
    const hash = m.importMapHash();
    assert.equal(m.deployFingerprint(), 'deploy-abc123');
    assert.equal(m.publishedBuildId(), `${hash}.deploy-abc123`, 'the id carries the deploy fingerprint');
    assert.notEqual(m.publishedBuildId(), hash, 'so it differs from the importmap hash alone');
  });
});

test('two deploys with the SAME importmap but different fingerprints publish different ids', async () => {
  const idFor = (build) => withEnv({ WEBJS_BUILD_ID: build }, async () => {
    const m = await import(`${MOD}?deploy-${build}`);
    await m.setVendorEntries({ x: '/x.js' }); // identical importmap both times
    m.publishBuildId();
    return m.publishedBuildId();
  });
  const a = await idFor('sha-one');
  const b = await idFor('sha-two');
  assert.notEqual(a, b, 'an SSR-only deploy (same map, new fingerprint) changes the client-visible id');
});

test('platform commit envs are detected in precedence order', async () => {
  // RAILWAY_GIT_COMMIT_SHA wins when WEBJS_BUILD_ID is absent.
  await withEnv({ RAILWAY_GIT_COMMIT_SHA: 'railwaysha', GIT_COMMIT: 'gitsha' }, async () => {
    const m = await import(`${MOD}?deploy-railway`);
    assert.equal(m.deployFingerprint(), 'railwaysha');
  });
  // An explicit WEBJS_BUILD_ID overrides a platform var.
  await withEnv({ WEBJS_BUILD_ID: 'explicit', RAILWAY_GIT_COMMIT_SHA: 'railwaysha' }, async () => {
    const m = await import(`${MOD}?deploy-explicit`);
    assert.equal(m.deployFingerprint(), 'explicit');
  });
});

test('the fingerprint is sanitized to a header-safe token (no CR/LF, bounded)', async () => {
  await withEnv({ WEBJS_BUILD_ID: 'ab c\r\nX-Injected: 1' }, async () => {
    const m = await import(`${MOD}?deploy-inject`);
    const fp = m.deployFingerprint();
    assert.ok(!/[\r\n]/.test(fp), 'no CR or LF survives (header injection guard)');
    assert.ok(!/\s/.test(fp), 'whitespace is stripped');
    assert.equal(fp, 'abcX-Injected1', 'only word/dot/dash chars remain');
  });
  await withEnv({ WEBJS_BUILD_ID: 'x'.repeat(200) }, async () => {
    const m = await import(`${MOD}?deploy-long`);
    assert.equal(m.deployFingerprint().length, 64, 'capped at 64 chars');
  });
});

test('the empty-until-final guard holds: no publish before the importmap is final, even with a fingerprint', async () => {
  await withEnv({ WEBJS_BUILD_ID: 'deploy-xyz' }, async () => {
    const m = await import(`${MOD}?deploy-warmup`);
    // No setVendorEntries: the importmap hash is still '' (warmup window).
    m.publishBuildId();
    assert.equal(m.publishedBuildId(), '', 'an unknown-version window never advertises an id, so the router never hard-reloads against it');
  });
});
