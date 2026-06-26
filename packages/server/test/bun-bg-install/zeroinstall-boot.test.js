// #704: the boot decision (zero-install pin vs transparent install). The headline
// glue, tested with an injected install + fs so it needs neither Bun nor a real
// install. Covers: installed-mode skip, the fast path (detached), the blocking
// path (needsInstall / hasLock), and fail-open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareBunZeroInstall } from '../../src/bun-zeroinstall-boot.js';

/** Build injected opts: a spy install + a controllable fs. */
function harness({ files = {}, nodeModules = false, installResult = true, installCreatesNodeModules = false }) {
  const calls = [];
  let nm = nodeModules;
  const _existsSync = (p) => (String(p).endsWith('node_modules') ? nm : (String(p) in files));
  const _readFileSync = (p) => { const k = Object.keys(files).find((f) => String(p).endsWith(f.replace(/^.*\//, ''))); if (k == null) { const e = new Error('ENOENT'); throw e; } return files[k]; };
  const _install = async (_dir, o) => { calls.push(o.mode); if (installCreatesNodeModules) nm = true; return installResult; };
  return { opts: { _install, _existsSync, _readFileSync }, calls: () => calls };
}

test('node_modules present: no install, pin hook OFF (installed mode)', async () => {
  const h = harness({ nodeModules: true });
  assert.equal(await prepareBunZeroInstall('/app', h.opts), false);
  assert.deepEqual(h.calls(), [], 'no install when already installed');
});

test('all latest-in-range, no lock: fast path serves with the pin + a DETACHED converge install', async () => {
  const h = harness({ files: { 'package.json': JSON.stringify({ dependencies: { dayjs: '^1.11.0', pg: '^8.0.0' } }) } });
  assert.equal(await prepareBunZeroInstall('/app', h.opts), true, 'pin hook ON (zero-install)');
  assert.deepEqual(h.calls(), ['detached'], 'a detached converge install, never blocking');
});

test('prerelease dep: BLOCKS on install, then installed mode (pin OFF)', async () => {
  const h = harness({
    files: { 'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '^1.0.0-rc.3' } }) },
    installCreatesNodeModules: true,
  });
  assert.equal(await prepareBunZeroInstall('/app', h.opts), false, 'pin OFF after the install materialized node_modules');
  assert.deepEqual(h.calls(), ['blocking'], 'a blocking install for the prerelease');
});

test('committed bun.lock: BLOCKS on install (reproducibility)', async () => {
  const h = harness({
    files: { 'package.json': JSON.stringify({ dependencies: { dayjs: '^1.11.0' } }), 'bun.lock': '{ "packages": {} }' },
    installCreatesNodeModules: true,
  });
  assert.equal(await prepareBunZeroInstall('/app', h.opts), false);
  assert.deepEqual(h.calls(), ['blocking'], 'a lock forces installed mode');
});

test('blocking install fails (offline / no bun): fail-open to the zero-install pin', async () => {
  const h = harness({
    files: { 'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '1.0.0-rc.3' } }) },
    installResult: false,
  });
  assert.equal(await prepareBunZeroInstall('/app', h.opts), true, 'pin ON when the install could not run');
  assert.deepEqual(h.calls(), ['blocking']);
});

test('no readable package.json: fail-open to the pin, no install', async () => {
  const h = harness({});
  assert.equal(await prepareBunZeroInstall('/app', h.opts), true);
  assert.deepEqual(h.calls(), [], 'cannot classify, so no install attempted');
});
