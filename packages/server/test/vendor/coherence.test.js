/**
 * Importmap coherence-check tests (issue #450).
 *
 * The check is defense-in-depth that catches an INCOHERENT client dependency
 * graph in a PRODUCED importmap, regardless of how the incoherence arose (a
 * hand-edited pin file, a partial vendor pin, or the #446 resolution skew). It
 * is a validation over the produced importmap, NOT a re-resolution and NOT
 * bundling, so these tests are fully offline (no jspm.io touch) and need no
 * network gate.
 *
 * Coverage:
 *   - a #446-style skew (a pinned package needing a newer version of another
 *     pinned package) -> conflict naming both, the range, and the pinned version
 *   - a coherent graph -> no conflict
 *   - VERDICT PARITY: the live importmap (jspm URLs) and the vendored importmap
 *     (`.webjs/vendor/importmap.json`-shaped local URLs) yield the SAME verdict
 *     for the same dep set
 *   - graceful degrade: metadata unavailable -> "could not verify" (unverified),
 *     never a crash and never a false conflict
 *   - the semver-range matcher across the shapes that appear in real manifests
 *   - version extraction across CDN + local-pin URL forms
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkImportmapCoherence,
  extractPinnedVersions,
  satisfiesSemverRange,
  getPackageManifest,
} from '../../src/vendor.js';

// The motivating #446 dep set, expressed two ways: as a LIVE importmap (jspm.io
// URLs) and as a VENDORED importmap (local `/__webjs/vendor/` paths). Both pin
// the SAME versions, so a coherent (or incoherent) verdict must be identical.
const LIVE = {
  '@codemirror/view': 'https://ga.jspm.io/npm:@codemirror/view@6.39.16/dist/index.js',
  '@codemirror/lint': 'https://ga.jspm.io/npm:@codemirror/lint@6.9.6/dist/index.js',
};
const VENDORED = {
  '@codemirror/view': '/__webjs/vendor/@codemirror--view@6.39.16.js',
  '@codemirror/lint': '/__webjs/vendor/@codemirror--lint@6.9.6.js',
};

// `@codemirror/lint` needs a NEWER `@codemirror/view` than is pinned -> skew.
const SKEW_MANIFESTS = {
  '@codemirror/lint': { dependencies: { '@codemirror/view': '^6.42.0' } },
  '@codemirror/view': { dependencies: {} },
};
// Same graph but lint accepts the pinned view -> coherent.
const COHERENT_MANIFESTS = {
  '@codemirror/lint': { dependencies: { '@codemirror/view': '^6.0.0' } },
  '@codemirror/view': { dependencies: {} },
};

const manifestReader = (table) => (pkg) => table[pkg] || null;

test('#446-style skew: a pinned package needing a newer pinned package warns', async () => {
  const report = await checkImportmapCoherence(LIVE, {
    getManifest: manifestReader(SKEW_MANIFESTS),
  });
  assert.equal(report.conflicts.length, 1);
  const c = report.conflicts[0];
  // The warning names BOTH packages, the required range, AND the pinned version.
  assert.equal(c.pkg, '@codemirror/lint');
  assert.equal(c.version, '6.9.6');
  assert.equal(c.dependsOn, '@codemirror/view');
  assert.equal(c.kind, 'dependency');
  assert.equal(c.requiredRange, '^6.42.0');
  assert.equal(c.pinnedVersion, '6.39.16');
});

test('coherent graph: no conflict', async () => {
  const report = await checkImportmapCoherence(LIVE, {
    getManifest: manifestReader(COHERENT_MANIFESTS),
  });
  assert.deepEqual(report.conflicts, []);
  assert.equal(report.checked, 2);
});

test('VERDICT PARITY: live and vendored importmaps agree for the same dep set', async () => {
  // Incoherent dep set: both inputs must report the SAME conflict.
  const live = await checkImportmapCoherence(LIVE, { getManifest: manifestReader(SKEW_MANIFESTS) });
  const vendored = await checkImportmapCoherence(VENDORED, { getManifest: manifestReader(SKEW_MANIFESTS) });
  assert.deepEqual(
    live.conflicts,
    vendored.conflicts,
    'a graph that is incoherent live must be incoherent vendored (and vice versa)',
  );

  // Coherent dep set: both inputs must report the SAME (empty) verdict.
  const liveOk = await checkImportmapCoherence(LIVE, { getManifest: manifestReader(COHERENT_MANIFESTS) });
  const vendoredOk = await checkImportmapCoherence(VENDORED, { getManifest: manifestReader(COHERENT_MANIFESTS) });
  assert.deepEqual(liveOk.conflicts, vendoredOk.conflicts);
  assert.equal(liveOk.conflicts.length, 0);
  assert.equal(vendoredOk.conflicts.length, 0);
});

test('graceful degrade: metadata unavailable -> could-not-verify, not a crash or false conflict', async () => {
  const report = await checkImportmapCoherence(LIVE, {
    // Every manifest lookup fails (package not installed / unreadable).
    getManifest: () => null,
  });
  assert.equal(report.conflicts.length, 0, 'no conflict can be derived without metadata');
  assert.equal(report.unverified.length, 2, 'both packages recorded as unverified');
  assert.match(report.unverified[0].reason, /could not read dependency metadata/);
});

test('graceful degrade: a getManifest that THROWS is swallowed per package', async () => {
  const report = await checkImportmapCoherence(LIVE, {
    getManifest: () => { throw new Error('disk on fire'); },
  });
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.unverified.length, 2);
});

test('peerDependencies are checked too, and flagged as a peer conflict', async () => {
  const report = await checkImportmapCoherence(LIVE, {
    getManifest: manifestReader({
      '@codemirror/lint': { peerDependencies: { '@codemirror/view': '^6.42.0' } },
      '@codemirror/view': {},
    }),
  });
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].kind, 'peerDependency');
});

test('a dependency on a package NOT in the importmap is ignored', async () => {
  // lint depends on `crelt` which is not pinned in this importmap (bundled into
  // the CDN megabundle or unused on the client). That is not the importmap's
  // coherence problem, so no conflict.
  const report = await checkImportmapCoherence(LIVE, {
    getManifest: manifestReader({
      '@codemirror/lint': { dependencies: { crelt: '^1.0.0', '@codemirror/view': '^6.0.0' } },
      '@codemirror/view': {},
    }),
  });
  assert.deepEqual(report.conflicts, []);
});

test('an unparseable range shape never warns (could-not-evaluate is silent)', async () => {
  const report = await checkImportmapCoherence(LIVE, {
    getManifest: manifestReader({
      '@codemirror/lint': { dependencies: { '@codemirror/view': 'git+https://example.com/x.git' } },
      '@codemirror/view': {},
    }),
  });
  assert.deepEqual(report.conflicts, [], 'a range we cannot evaluate must not be reported as a conflict');
});

// --- satisfiesSemverRange ---------------------------------------------------

test('satisfiesSemverRange: caret', () => {
  assert.equal(satisfiesSemverRange('6.39.16', '^6.42.0'), false);
  assert.equal(satisfiesSemverRange('6.42.0', '^6.42.0'), true);
  assert.equal(satisfiesSemverRange('6.50.0', '^6.42.0'), true);
  assert.equal(satisfiesSemverRange('7.0.0', '^6.42.0'), false);
  // 0.x caret pins the minor.
  assert.equal(satisfiesSemverRange('0.7.5', '^0.7.0'), true);
  assert.equal(satisfiesSemverRange('0.8.0', '^0.7.0'), false);
});

test('satisfiesSemverRange: tilde', () => {
  assert.equal(satisfiesSemverRange('6.42.5', '~6.42.0'), true);
  assert.equal(satisfiesSemverRange('6.43.0', '~6.42.0'), false);
  assert.equal(satisfiesSemverRange('6.5.0', '~6'), true);
  assert.equal(satisfiesSemverRange('7.0.0', '~6'), false);
});

test('satisfiesSemverRange: comparators, wildcards, exact, alternation', () => {
  assert.equal(satisfiesSemverRange('6.42.0', '>=6.42.0'), true);
  assert.equal(satisfiesSemverRange('6.41.0', '>=6.42.0'), false);
  assert.equal(satisfiesSemverRange('6.0.0', '>=6.0.0 <7.0.0'), true);
  assert.equal(satisfiesSemverRange('7.0.0', '>=6.0.0 <7.0.0'), false);
  assert.equal(satisfiesSemverRange('6.39.16', '6.x'), true);
  assert.equal(satisfiesSemverRange('7.0.0', '6.x'), false);
  assert.equal(satisfiesSemverRange('6.39.16', '6.39.16'), true);
  assert.equal(satisfiesSemverRange('6.39.17', '6.39.16'), false);
  assert.equal(satisfiesSemverRange('6.39.16', '*'), true);
  assert.equal(satisfiesSemverRange('6.39.16', ''), true);
  assert.equal(satisfiesSemverRange('5.0.0', '^6.0.0 || ^5.0.0'), true);
  assert.equal(satisfiesSemverRange('4.0.0', '^6.0.0 || ^5.0.0'), false);
  // A leading `v` on an exact pin evaluates rather than degrading to unverified.
  assert.equal(satisfiesSemverRange('6.42.0', 'v6.42.0'), true);
  assert.equal(satisfiesSemverRange('6.42.1', 'v6.42.0'), false);
});

test('satisfiesSemverRange: a pinned prerelease is judged on its release line', () => {
  // KNOWN LIMITATION (documented): the `-beta` tag is dropped, so a prerelease
  // pin is treated as its stable tuple. The worst case is a MISSED warning,
  // never a spurious one. npm semver would return false for the first case.
  assert.equal(satisfiesSemverRange('6.42.0-beta.1', '^6.42.0'), true);
  assert.equal(satisfiesSemverRange('7.0.0-rc.1', '^6.42.0'), false);
});

test('satisfiesSemverRange: unparseable shapes return null (could not verify)', () => {
  assert.equal(satisfiesSemverRange('6.39.16', 'git+https://x'), null);
  assert.equal(satisfiesSemverRange('6.39.16', '1.2.3 - 1.4.0'), null);
  assert.equal(satisfiesSemverRange('not-a-version', '^6.0.0'), null);
});

// --- extractPinnedVersions --------------------------------------------------

test('extractPinnedVersions: parses CDN and local-pin URL forms', () => {
  const map = extractPinnedVersions({
    dayjs: 'https://ga.jspm.io/npm:dayjs@1.11.13/dayjs.min.js',
    clsx: 'https://cdn.jsdelivr.net/npm/clsx@2.1.1/dist/clsx.js',
    '@codemirror/view': '/__webjs/vendor/@codemirror--view@6.39.16.js',
    'dayjs/plugin/utc': '/__webjs/vendor/dayjs@1.11.13__plugin__utc.js',
  });
  assert.equal(map.get('dayjs'), '1.11.13');
  assert.equal(map.get('clsx'), '2.1.1');
  assert.equal(map.get('@codemirror/view'), '6.39.16');
});

test('extractPinnedVersions: a short name does not false-match inside another URL', () => {
  // `ms` must not match inside `npm:terms@1.0.0/...`.
  const map = extractPinnedVersions({
    terms: 'https://ga.jspm.io/npm:terms@1.0.0/index.js',
    ms: 'https://ga.jspm.io/npm:ms@2.1.3/index.js',
  });
  assert.equal(map.get('terms'), '1.0.0');
  assert.equal(map.get('ms'), '2.1.3');
});

// --- getPackageManifest -----------------------------------------------------

test('getPackageManifest: reads an installed package, hoist-aware', () => {
  // picocolors is installed in this repo (hoisted to the workspace root). The
  // coherence check reads dep ranges through this, so it must resolve a hoisted
  // package, not only one under the appDir's own node_modules.
  const m = getPackageManifest('picocolors', process.cwd());
  assert.ok(m, 'expected a manifest object');
  assert.equal(typeof m.dependencies, 'object');
  assert.equal(typeof m.peerDependencies, 'object');
});

test('getPackageManifest: returns null for an unresolvable package (degrade signal)', () => {
  assert.equal(getPackageManifest('this-package-truly-does-not-exist-xyz-123', process.cwd()), null);
});
