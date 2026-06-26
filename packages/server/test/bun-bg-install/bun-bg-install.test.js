// Unit tests for the transparent Bun install (the auto-transparent-install
// design). Bun runtime auto-install is latest-only, so a non-latest / prerelease
// / reproducible dep can only be served after a real `bun install`. This module
// runs that install FOR the user (never manually). The module references no
// `Bun.*` global, so it is exercised on Node here with an injected spawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTransparentInstall, buildBunInstallArgs } from '../../src/bun-bg-install.js';

const scratch = (withLock) => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-bg-'));
  writeFileSync(join(dir, 'package.json'), '{}');
  if (withLock) writeFileSync(join(dir, 'bun.lock'), '{ "packages": {} }');
  return dir;
};

// A fake spawn returning a controllable child; records the argv it was called with.
const fakeSpawn = (onExitCode, calls) => (bin, args) => {
  calls.push({ bin, args });
  const child = new EventEmitter();
  child.unref = () => {};
  if (onExitCode !== 'never') queueMicrotask(() => child.emit('exit', onExitCode));
  return child;
};

test('buildBunInstallArgs: --frozen-lockfile iff a lock exists; never --lockfile-only', () => {
  assert.deepEqual(buildBunInstallArgs({ hasLock: true }), ['install', '--frozen-lockfile']);
  assert.deepEqual(buildBunInstallArgs({ hasLock: false }), ['install']);
  assert.deepEqual(
    buildBunInstallArgs({ hasLock: true, detached: true }),
    ['install', '--frozen-lockfile', '--network-concurrency', '4'],
  );
  for (const a of [
    buildBunInstallArgs({ hasLock: true }),
    buildBunInstallArgs({ hasLock: false, detached: true }),
  ]) assert.ok(!a.includes('--lockfile-only'), 'never uses --lockfile-only (proven useless)');
});

test('blocking: returns true on exit 0 when node_modules now exists', async () => {
  const dir = scratch(true);
  mkdirSync(join(dir, 'node_modules')); // simulate the install having produced it
  const calls = [];
  const ok = await startTransparentInstall(dir, { mode: 'blocking', log: () => {}, _spawn: fakeSpawn(0, calls) });
  assert.equal(ok, true);
  assert.deepEqual(calls[0].args, ['install', '--frozen-lockfile'], 'spawned bun install with frozen lock');
});

test('blocking: returns false on a non-zero exit (fail-open to zero-install)', async () => {
  const dir = scratch(false);
  const calls = [];
  const ok = await startTransparentInstall(dir, { mode: 'blocking', log: () => {}, _spawn: fakeSpawn(1, calls) });
  assert.equal(ok, false);
});

test('blocking: returns false (never throws) when spawn itself throws', async () => {
  const dir = scratch(false);
  const ok = await startTransparentInstall(dir, {
    mode: 'blocking', log: () => {},
    _spawn: () => { throw new Error('bun not found'); },
  });
  assert.equal(ok, false);
});

test('lock-marker: a fresh marker blocks a concurrent install (returns false)', async () => {
  const dir = scratch(true);
  mkdirSync(join(dir, '.webjs'), { recursive: true });
  writeFileSync(join(dir, '.webjs', '.bun-install.lock'), String(process.pid));
  const calls = [];
  const ok = await startTransparentInstall(dir, { mode: 'blocking', log: () => {}, _spawn: fakeSpawn(0, calls) });
  assert.equal(ok, false, 'a held, non-stale marker means an install is already running');
  assert.equal(calls.length, 0, 'did not spawn a second install');
});

test('lock-marker: a STALE marker is stolen and the install proceeds', async () => {
  const dir = scratch(true);
  mkdirSync(join(dir, '.webjs'), { recursive: true });
  const marker = join(dir, '.webjs', '.bun-install.lock');
  writeFileSync(marker, 'dead');
  const old = new Date(Date.now() - 60 * 60 * 1000); // 1h ago, well past the 10min threshold
  utimesSync(marker, old, old);
  mkdirSync(join(dir, 'node_modules'));
  const calls = [];
  const ok = await startTransparentInstall(dir, { mode: 'blocking', log: () => {}, _spawn: fakeSpawn(0, calls) });
  assert.equal(ok, true, 'stole the stale marker and ran the install');
  assert.equal(calls.length, 1);
});

test('detached: spawns, returns true immediately, releases the marker on exit', async () => {
  const dir = scratch(false);
  const calls = [];
  const ok = await startTransparentInstall(dir, { mode: 'detached', log: () => {}, _spawn: fakeSpawn(0, calls) });
  assert.equal(ok, true);
  assert.deepEqual(calls[0].args, ['install', '--network-concurrency', '4'], 'detached, no lock -> reduced concurrency, no frozen');
  // the child emits exit on the next microtask; the marker is then removed.
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(!existsSync(join(dir, '.webjs', '.bun-install.lock')), 'marker released after the detached install exits');
});
