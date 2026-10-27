/**
 * The build epoch (#1644) is the one invalidation primitive every
 * request-independent SSR memo keys on, so this test enumerates the bump
 * sites: every setter whose value feeds a per-build computation must move the
 * epoch. A setter missing from this list would serve a stale memo for the
 * process lifetime, which is exactly the failure a single counter is meant to
 * make impossible, so the list here IS the contract.
 *
 * Each module is fresh-imported with a cache-busting query (the
 * importmap.test.js trick) so the setters start from a clean state and the
 * epoch module they share is the one under test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEpoch, bumpBuildEpoch } from '../../src/build-epoch.js';
import { setBasePath, setCoreInstall, setImportAliasEntries, setVendorEntries } from '../../src/importmap.js';
import { setAssetRoots, setElisionFingerprint, clearAssetHashCache } from '../../src/asset-hash.js';
import { setMetadataIconRoutes } from '../../src/ssr/head.js';

const CORE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../core');

/** Run `fn` and assert the epoch moved by at least one. */
async function bumps(label, fn) {
  const before = buildEpoch();
  await fn();
  assert.ok(buildEpoch() > before, `${label} must bump the build epoch (was ${before}, now ${buildEpoch()})`);
}

test('build epoch: starts above zero and bumpBuildEpoch is monotonic', () => {
  assert.ok(buildEpoch() >= 1, 'a memo initialised with epoch 0 must read as stale');
  const a = bumpBuildEpoch();
  const b = bumpBuildEpoch();
  assert.equal(b, a + 1);
  assert.equal(buildEpoch(), b);
});

test('build epoch: every importmap setter bumps it, before its await', async () => {
  // The bump has to land synchronously, before the setter's `await digestHex`,
  // so a render racing the setter cannot refill a memo with pre-change state.
  // Observing the epoch right after the call (no await) proves that ordering.
  let before = buildEpoch();
  const p1 = setVendorEntries({ x: '/x.js' });
  assert.ok(buildEpoch() > before, 'setVendorEntries bumps synchronously');
  await p1;
  before = buildEpoch();
  const p2 = setImportAliasEntries({ '#lib/': '/lib/' });
  assert.ok(buildEpoch() > before, 'setImportAliasEntries bumps synchronously');
  await p2;
  before = buildEpoch();
  const p3 = setBasePath('/mount');
  assert.ok(buildEpoch() > before, 'setBasePath bumps synchronously');
  await p3;
  await setBasePath('');
  before = buildEpoch();
  const p4 = setCoreInstall(CORE_DIR, false);
  assert.ok(buildEpoch() > before, 'setCoreInstall bumps synchronously');
  await p4;
});

test('build epoch: the asset-hash roots, fingerprint, and cache clear bump it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-epoch-'));
  const appDir = join(root, 'app-root');
  const coreDir = join(root, 'core-root');
  mkdirSync(appDir, { recursive: true });
  mkdirSync(coreDir, { recursive: true });
  try {
    await bumps('setAssetRoots', () => setAssetRoots({ appDir, coreDir, enabled: true }));
    await bumps('clearAssetHashCache', () => clearAssetHashCache());
    await bumps('setElisionFingerprint (changed)', () => setElisionFingerprint('fp-' + Date.now()));
    // An UNCHANGED fingerprint moves no hash, so it must NOT bump: the memos
    // over those hashes are still valid and a bump would discard them for
    // nothing on every rebuild whose verdict did not move.
    setElisionFingerprint('same-fp');
    const before = buildEpoch();
    setElisionFingerprint('same-fp');
    assert.equal(buildEpoch(), before, 'an unchanged fingerprint does not bump');
  } finally {
    setAssetRoots({ appDir: '', coreDir: '', enabled: false });
    setElisionFingerprint('');
    rmSync(root, { recursive: true, force: true });
  }
});

test('build epoch: setMetadataIconRoutes bumps it', async () => {
  await bumps('setMetadataIconRoutes', () => setMetadataIconRoutes([{ stem: 'icon', urlPath: '/icon', contentType: 'image/svg+xml' }]));
  await bumps('setMetadataIconRoutes (clear)', () => setMetadataIconRoutes(null));
});
