/**
 * Tests for `webjs doctor` (#266): the project-health checklist.
 *
 * The PURE check runner `runDoctorChecks(appDir, opts?)` is exercised directly
 * against tmp fixture appDirs (it reads files + optionally the network but never
 * exits / prints). The CLI integration is exercised by spawning the binary and
 * asserting the exit code (0 when no hard check fails, non-zero when one does),
 * mirroring typecheck.test.mjs.
 *
 * Network: the vendor-pin freshness check is BEST-EFFORT. We never let a real
 * network call into the test; the no-pin case is asserted directly, and the
 * outdated / network-failure cases are driven through the `opts.vendor`
 * injection seam (a stub `{ hasVendorPin, findOutdated }`), so the test is
 * deterministic and offline-safe.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');
const CLI_LIB_DIR = resolve(REPO, 'packages', 'cli', 'lib');

const { runDoctorChecks } = await import(
  resolve(CLI_LIB_DIR, 'doctor.js')
);

const cleanup = [];
after(() => { for (const d of cleanup) rmSync(d, { recursive: true, force: true }); });

/** A fresh tmp fixture dir under the OS tmpdir. */
function tmpDir() {
  const dir = mkdtempSync(join(tmpdir(), 'doctor-'));
  cleanup.push(dir);
  return dir;
}

/** Write a file, creating parent dirs. */
function write(dir, rel, content) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Find a check result by name. */
function byName(results, name) {
  const r = results.find((x) => x.name === name);
  assert.ok(r, `expected a '${name}' check in the results`);
  return r;
}

// A vendor stub that reports no pin file (the common unpinned-app case), so the
// pin check never touches the network unless a test overrides it.
const noPinVendor = { hasVendorPin: () => false, findOutdated: async () => [] };

/** Base opts that keep every check offline + green-leaning. */
function baseOpts(extra = {}) {
  return { cliDir: CLI_LIB_DIR, vendor: noPinVendor, ...extra };
}

// ---------------------------------------------------------------------------
// A well-configured app: every check should pass, none should fail.
// ---------------------------------------------------------------------------
test('a well-configured app produces no failures', async () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({
    name: 'good-app',
    dependencies: { '@webjsdev/core': 'latest', '@webjsdev/server': 'latest' },
  }));
  write(dir, 'tsconfig.json', JSON.stringify({
    compilerOptions: { erasableSyntaxOnly: true, strict: true },
  }));
  write(dir, '.env.example', 'DATABASE_URL=\nAUTH_SECRET=\n');
  write(dir, '.env', 'DATABASE_URL=file:./dev.db\nAUTH_SECRET=abc\n');
  // node_modules installs satisfying `latest`.
  write(dir, 'node_modules/@webjsdev/core/package.json', JSON.stringify({ version: '0.7.4' }));
  write(dir, 'node_modules/@webjsdev/server/package.json', JSON.stringify({ version: '0.8.0' }));

  const results = await runDoctorChecks(dir, baseOpts());
  const fails = results.filter((r) => r.status === 'fail');
  assert.equal(fails.length, 0, `no hard fails expected, got: ${JSON.stringify(fails)}`);
  assert.equal(byName(results, 'tsconfig-erasable').status, 'pass');
  assert.equal(byName(results, 'env-drift').status, 'pass');
  assert.equal(byName(results, 'vendor-pin').status, 'pass');
  assert.equal(byName(results, 'webjs-versions').status, 'pass');
});

// ---------------------------------------------------------------------------
// Node version: pass at/above required, fail below (the counterfactual).
// ---------------------------------------------------------------------------
test('node check passes when the injected version >= required', async () => {
  const dir = tmpDir();
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.4.0' }));
  assert.equal(byName(results, 'node-version').status, 'pass');
});

test('node check FAILS (hard) when an older version is injected', async () => {
  const dir = tmpDir();
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '20.11.0' }));
  const node = byName(results, 'node-version');
  assert.equal(node.status, 'fail', 'an old Node must be a hard fail');
  assert.match(node.fix, /Upgrade to Node/);
});

// ---------------------------------------------------------------------------
// tsconfig erasableSyntaxOnly.
// ---------------------------------------------------------------------------
test('tsconfig check FAILS when erasableSyntaxOnly is missing in an existing tsconfig', async () => {
  const dir = tmpDir();
  write(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }));
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'tsconfig-erasable').status, 'fail');
});

test('tsconfig check FAILS when erasableSyntaxOnly is false', async () => {
  const dir = tmpDir();
  write(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { erasableSyntaxOnly: false } }));
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'tsconfig-erasable').status, 'fail');
});

test('tsconfig check WARNS (not fails) when no tsconfig is present', async () => {
  const dir = tmpDir();
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'tsconfig-erasable').status, 'warn');
});

test('tsconfig check tolerates JSONC (comments + trailing commas)', async () => {
  const dir = tmpDir();
  write(dir, 'tsconfig.json',
    '{\n  // editor intelligence\n  "compilerOptions": {\n    "erasableSyntaxOnly": true, /* required */\n  },\n}\n');
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'tsconfig-erasable').status, 'pass');
});

// ---------------------------------------------------------------------------
// .env drift.
// ---------------------------------------------------------------------------
test('env check WARNS listing a key in .env.example missing from .env', async () => {
  const dir = tmpDir();
  write(dir, '.env.example', 'DATABASE_URL=\nAUTH_SECRET=\nWEBJS_PUBLIC_API_URL=\n');
  write(dir, '.env', 'DATABASE_URL=file:./dev.db\n');
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  const env = byName(results, 'env-drift');
  assert.equal(env.status, 'warn');
  assert.match(env.message, /AUTH_SECRET/);
  assert.match(env.message, /WEBJS_PUBLIC_API_URL/);
});

test('env check PASSES when all example keys are present', async () => {
  const dir = tmpDir();
  write(dir, '.env.example', 'DATABASE_URL=\n# a comment\nAUTH_SECRET=\n');
  write(dir, '.env', 'AUTH_SECRET=x\nDATABASE_URL=y\n');
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'env-drift').status, 'pass');
});

test('env check WARNS when .env.example exists but .env is absent', async () => {
  const dir = tmpDir();
  write(dir, '.env.example', 'DATABASE_URL=\n');
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  const env = byName(results, 'env-drift');
  assert.equal(env.status, 'warn');
  assert.match(env.fix, /cp \.env\.example \.env/);
});

test('env check PASSES (skips) when there is no .env.example', async () => {
  const dir = tmpDir();
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'env-drift').status, 'pass');
});

// ---------------------------------------------------------------------------
// @webjsdev version coherence.
// ---------------------------------------------------------------------------
test('version check WARNS on a missing @webjsdev install', async () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({
    dependencies: { '@webjsdev/core': '^0.7.0' },
  }));
  // No node_modules/@webjsdev/core installed.
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  const v = byName(results, 'webjs-versions');
  assert.equal(v.status, 'warn');
  assert.match(v.message, /not installed/);
  assert.match(v.fix, /npm install/);
});

test('version check WARNS on a range drift (installed does not satisfy)', async () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({
    dependencies: { '@webjsdev/core': '^0.7.0' },
  }));
  // Installed 0.8.0 does NOT satisfy ^0.7.0 (caret pins the minor for 0.x).
  write(dir, 'node_modules/@webjsdev/core/package.json', JSON.stringify({ version: '0.8.0' }));
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  const v = byName(results, 'webjs-versions');
  assert.equal(v.status, 'warn');
  assert.match(v.message, /drift/);
});

test('version check PASSES when installed satisfies the declared range', async () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({
    dependencies: { '@webjsdev/core': '^0.7.0' },
    devDependencies: { '@webjsdev/cli': 'latest' },
  }));
  write(dir, 'node_modules/@webjsdev/core/package.json', JSON.stringify({ version: '0.7.4' }));
  write(dir, 'node_modules/@webjsdev/cli/package.json', JSON.stringify({ version: '0.10.1' }));
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'webjs-versions').status, 'pass');
});

// ---------------------------------------------------------------------------
// vendor pin freshness (best-effort + network-tolerant).
// ---------------------------------------------------------------------------
test('vendor-pin PASSES (skips) when there is no pin file', async () => {
  const dir = tmpDir();
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0' }));
  assert.equal(byName(results, 'vendor-pin').status, 'pass');
});

test('vendor-pin WARNS (never fails) when the freshness check throws (network)', async () => {
  const dir = tmpDir();
  const throwingVendor = {
    hasVendorPin: () => true,
    findOutdated: async () => { throw new Error('ENOTFOUND registry.npmjs.org'); },
  };
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', vendor: throwingVendor }));
  const pin = byName(results, 'vendor-pin');
  assert.equal(pin.status, 'warn', 'a network failure must be a warn, never a fail');
  assert.match(pin.message, /network|registry/i);
  // And critically, it did not throw out of runDoctorChecks.
});

test('vendor-pin WARNS listing outdated packages', async () => {
  const dir = tmpDir();
  const outdatedVendor = {
    hasVendorPin: () => true,
    findOutdated: async () => [{ pkg: 'dayjs', current: '1.11.0', latest: '1.11.13' }],
  };
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', vendor: outdatedVendor }));
  const pin = byName(results, 'vendor-pin');
  assert.equal(pin.status, 'warn');
  assert.match(pin.message, /dayjs/);
  assert.match(pin.fix, /vendor update/);
});

// ---------------------------------------------------------------------------
// importmap coherence (#450): warn-only, runs over BOTH importmaps with verdict
// parity, degrades gracefully on missing metadata. Driven through the
// `opts.coherence` injection seam so every branch runs offline.
// ---------------------------------------------------------------------------

// The #446 dep set, expressed as a LIVE importmap (jspm URLs) and a VENDORED
// importmap (local pin paths). Both pin the same versions.
const CM_LIVE = {
  '@codemirror/view': 'https://ga.jspm.io/npm:@codemirror/view@6.39.16/dist/index.js',
  '@codemirror/lint': 'https://ga.jspm.io/npm:@codemirror/lint@6.9.6/dist/index.js',
};
const CM_VENDORED = {
  '@codemirror/view': '/__webjs/vendor/@codemirror--view@6.39.16.js',
  '@codemirror/lint': '/__webjs/vendor/@codemirror--lint@6.9.6.js',
};
// lint needs a NEWER view than is pinned -> skew; same graph with ^6.0.0 -> coherent.
const CM_SKEW_MANIFEST = (pkg) =>
  pkg === '@codemirror/lint' ? { dependencies: { '@codemirror/view': '^6.42.0' } } : { dependencies: {} };
const CM_COHERENT_MANIFEST = (pkg) =>
  pkg === '@codemirror/lint' ? { dependencies: { '@codemirror/view': '^6.0.0' } } : { dependencies: {} };

// Build a coherence injection that drives the REAL check over the given
// importmaps + manifest reader (no network, no node_modules read).
async function coherenceInjection({ live, vendored, getManifest }) {
  const mod = await import('@webjsdev/server');
  return {
    check: mod.checkImportmapCoherence,
    getManifest,
    liveImports: async () => live || null,
    vendoredImports: async () => vendored || null,
  };
}

test('coherence WARNS on a #446-style skew, naming both packages + range + pinned version', async () => {
  const dir = tmpDir();
  const coherence = await coherenceInjection({
    live: CM_LIVE, vendored: CM_VENDORED, getManifest: CM_SKEW_MANIFEST,
  });
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  const c = byName(results, 'importmap-coherence');
  assert.equal(c.status, 'warn', 'a skew is a warn, never a hard fail');
  assert.match(c.message, /@codemirror\/lint/);
  assert.match(c.message, /@codemirror\/view/);
  assert.match(c.message, /\^6\.42\.0/);   // required range
  assert.match(c.message, /6\.39\.16/);    // pinned version
});

test('coherence PASSES on a coherent graph', async () => {
  const dir = tmpDir();
  const coherence = await coherenceInjection({
    live: CM_LIVE, vendored: CM_VENDORED, getManifest: CM_COHERENT_MANIFEST,
  });
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  assert.equal(byName(results, 'importmap-coherence').status, 'pass');
});

test('coherence PARITY: live-only and vendored-only inputs reach the SAME verdict', async () => {
  const dir = tmpDir();
  // Skew, live importmap only.
  const liveOnly = await runDoctorChecks(dir, baseOpts({
    nodeVersion: '24.0.0',
    coherence: await coherenceInjection({ live: CM_LIVE, vendored: null, getManifest: CM_SKEW_MANIFEST }),
  }));
  // Skew, vendored importmap only.
  const vendoredOnly = await runDoctorChecks(dir, baseOpts({
    nodeVersion: '24.0.0',
    coherence: await coherenceInjection({ live: null, vendored: CM_VENDORED, getManifest: CM_SKEW_MANIFEST }),
  }));
  const a = byName(liveOnly, 'importmap-coherence');
  const b = byName(vendoredOnly, 'importmap-coherence');
  assert.equal(a.status, b.status, 'the verdict must not depend on which importmap carried the dep set');
  assert.equal(a.status, 'warn');
  assert.equal(a.message, b.message, 'same dep set -> identical warning text');
});

test('coherence PASSES (skips) when there is no vendor importmap at all', async () => {
  const dir = tmpDir();
  const coherence = await coherenceInjection({ live: {}, vendored: null, getManifest: () => null });
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  const c = byName(results, 'importmap-coherence');
  assert.equal(c.status, 'pass');
  assert.match(c.message, /no npm packages on the client|No vendor importmap/i);
});

test('coherence degrades to could-not-verify when metadata is unavailable (no crash, no false warn)', async () => {
  const dir = tmpDir();
  // Importmap present, but every manifest lookup returns null (not installed).
  const coherence = await coherenceInjection({ live: CM_LIVE, vendored: null, getManifest: () => null });
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  const c = byName(results, 'importmap-coherence');
  assert.equal(c.status, 'warn');
  assert.match(c.message, /[Cc]ould not verify/);
  assert.doesNotMatch(c.message, /Incoherent/, 'missing metadata must not be reported as a conflict');
});

test('coherence never throws out of runDoctorChecks even if the check itself throws', async () => {
  const dir = tmpDir();
  const coherence = {
    check: async () => { throw new Error('boom'); },
    getManifest: () => null,
    liveImports: async () => CM_LIVE,
    vendoredImports: async () => null,
  };
  // Must resolve, not reject.
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  const c = byName(results, 'importmap-coherence');
  assert.equal(c.status, 'warn', 'a thrown check degrades to a warn');
});

test('@webjsdev/server re-exports checkImportmapCoherence for the un-stubbed doctor path', async () => {
  const mod = await import('@webjsdev/server');
  assert.equal(typeof mod.checkImportmapCoherence, 'function');
  assert.equal(typeof mod.resolveVendorImports, 'function');
  assert.equal(typeof mod.readPinFile, 'function');
  assert.equal(typeof mod.scanBareImports, 'function');
});

test('the coherence check runs on the real import path (no coherence stub) without throwing', async () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'x' }));
  // No pin file, no client imports: the real path resolves an empty live map
  // and a null vendored map, so the check passes (nothing to verify). Run
  // WITHOUT opts.coherence to exercise the real @webjsdev/server wiring.
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', vendor: undefined, coherence: undefined }));
  const c = results.find((r) => r.name === 'importmap-coherence');
  assert.ok(c, 'an importmap-coherence result is present');
  assert.equal(c.status, 'pass', `empty app must pass, got: ${c.status} ${c.message}`);
});

test('coherence WARNS on a REAL cross-package edge: importmap + on-disk manifest, real getManifest', async () => {
  // End-to-end over a REAL importmap and a REAL on-disk manifest, not a
  // synthetic getManifest. The other coherence tests inject the manifest
  // reader; this one exercises the production path: extractPinnedVersions parses
  // the pinned versions out of a real importmap, and the REAL getPackageManifest
  // (@webjsdev/server) reads the declared range from node_modules on disk. The
  // motivating #446 shape: @codemirror/lint declares view ^6.42.0 while the
  // importmap pins @codemirror/view@6.39.16.
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'x' }));
  // Real on-disk manifests the hoist-aware getPackageManifest will read. An
  // empty index.js per package gives require.resolve a real entry to resolve,
  // the way an installed package would have.
  write(dir, 'node_modules/@codemirror/lint/package.json', JSON.stringify({
    name: '@codemirror/lint',
    version: '6.9.6',
    main: 'index.js',
    dependencies: { '@codemirror/view': '^6.42.0' },
  }));
  write(dir, 'node_modules/@codemirror/lint/index.js', '');
  write(dir, 'node_modules/@codemirror/view/package.json', JSON.stringify({
    name: '@codemirror/view',
    version: '6.39.16',
    main: 'index.js',
  }));
  write(dir, 'node_modules/@codemirror/view/index.js', '');
  // A real importmap pinning the skewed versions. Inject ONLY the importmap
  // sources; getManifest stays the REAL @webjsdev/server reader against `dir`.
  const mod = await import('@webjsdev/server');
  const importmap = {
    '@codemirror/view': 'https://ga.jspm.io/npm:@codemirror/view@6.39.16/dist/index.js',
    '@codemirror/lint': 'https://ga.jspm.io/npm:@codemirror/lint@6.9.6/dist/index.js',
  };
  const coherence = {
    check: mod.checkImportmapCoherence,
    getManifest: (pkg) => mod.getPackageManifest(pkg, dir),
    liveImports: async () => importmap,
    vendoredImports: async () => null,
  };
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  const c = byName(results, 'importmap-coherence');
  assert.equal(c.status, 'warn', 'a real skew over a real manifest read must warn');
  assert.match(c.message, /@codemirror\/lint/);    // both packages named
  assert.match(c.message, /@codemirror\/view/);
  assert.match(c.message, /\^6\.42\.0/);            // the required range
  assert.match(c.message, /6\.39\.16/);             // the pinned version
});

test('coherence PASSES on a REAL coherent edge: importmap + on-disk manifest, real getManifest', async () => {
  // Counterfactual to the test above on the SAME real path: align the declared
  // range so the pinned view satisfies it, and the real reader must report pass.
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'x' }));
  write(dir, 'node_modules/@codemirror/lint/package.json', JSON.stringify({
    name: '@codemirror/lint',
    version: '6.9.6',
    main: 'index.js',
    dependencies: { '@codemirror/view': '^6.0.0' },
  }));
  write(dir, 'node_modules/@codemirror/lint/index.js', '');
  write(dir, 'node_modules/@codemirror/view/package.json', JSON.stringify({
    name: '@codemirror/view',
    version: '6.39.16',
    main: 'index.js',
  }));
  write(dir, 'node_modules/@codemirror/view/index.js', '');
  const mod = await import('@webjsdev/server');
  const importmap = {
    '@codemirror/view': 'https://ga.jspm.io/npm:@codemirror/view@6.39.16/dist/index.js',
    '@codemirror/lint': 'https://ga.jspm.io/npm:@codemirror/lint@6.9.6/dist/index.js',
  };
  const coherence = {
    check: mod.checkImportmapCoherence,
    getManifest: (pkg) => mod.getPackageManifest(pkg, dir),
    liveImports: async () => importmap,
    vendoredImports: async () => null,
  };
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', coherence }));
  const c = byName(results, 'importmap-coherence');
  assert.equal(c.status, 'pass', `a coherent real edge must pass, got: ${c.status} ${c.message}`);
});

// ---------------------------------------------------------------------------
// CLI integration: exit code behavior.
// ---------------------------------------------------------------------------
function runCli(cwd) {
  return spawnSync(process.execPath, [CLI, 'doctor'], { cwd, encoding: 'utf8' });
}

test('CLI exits 0 when no hard check fails', () => {
  // Run in the OS tmpdir: a fresh app with a good tsconfig and no @webjsdev
  // deps. The running Node is the repo's own (24+), so node-version passes; the
  // only warns are env / versions, which do NOT fail the exit.
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'x' }));
  write(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { erasableSyntaxOnly: true } }));
  const r = runCli(dir);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /\[pass\] node-version/);
});

test('CLI exits non-zero when a hard check fails (bad tsconfig)', () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'x' }));
  // erasableSyntaxOnly missing in an EXISTING tsconfig -> hard fail.
  write(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }));
  const r = runCli(dir);
  assert.notEqual(r.status, 0, 'a hard fail must produce a non-zero exit');
  assert.match(r.stdout + r.stderr, /\[fail\] tsconfig-erasable/);
});

// Regression: the doctor pin check imports hasVendorPin from @webjsdev/server on
// the REAL (un-stubbed) path. If it is not re-exported, the check silently
// reports "no pin file" for a pinned app and the freshness check is inert. The
// other vendor tests inject opts.vendor, so they never caught this.
test('@webjsdev/server re-exports hasVendorPin so the un-stubbed pin check works', async () => {
  const mod = await import('@webjsdev/server');
  assert.equal(typeof mod.hasVendorPin, 'function', 'hasVendorPin must be exported');
  assert.equal(typeof mod.findOutdated, 'function', 'findOutdated must be exported');
});

test('the pin check detects a pin on the real import path (no vendor stub)', async () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'x' }));
  // A pin file with no imports: hasVendorPin sees it, findOutdated has nothing
  // to check (no network call), so the check recognizes the pin and does NOT
  // report "no pin file". Run WITHOUT opts.vendor to exercise the real import.
  mkdirSync(join(dir, '.webjs', 'vendor'), { recursive: true });
  writeFileSync(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({ imports: {} }));
  const results = await runDoctorChecks(dir, baseOpts({ nodeVersion: '24.0.0', vendor: undefined }));
  const pin = results.find((r) => r.name === 'vendor-pin');
  assert.ok(pin, 'a vendor-pin result is present');
  assert.ok(
    !/No vendor pin file/.test(pin.message),
    `the real pin check must detect the pin, got: ${pin.status} ${pin.message}`,
  );
});
