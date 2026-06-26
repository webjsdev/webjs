/**
 * Cross-runtime proof of the Bun transparent auto-install (the auto-transparent-
 * install design). Bun's runtime auto-install is latest-only, so a non-latest /
 * prerelease / reproducible dep cannot be served zero-install; webjs runs
 * `bun install` FOR the user (never manually), then serves in installed mode.
 *
 * This asserts the runtime-neutral decision pieces under whichever runtime runs
 * it (the boot path that consumes them is the same on Node and Bun):
 *
 *   node test/bun/transparent-install.mjs
 *   bun  test/bun/transparent-install.mjs
 *
 * Offline by design (no real `bun install`; the end-to-end install is proven in
 * the Bun e2e). Run from the repo root.
 */
import assert from 'node:assert/strict';
import { classifyBunDeps } from '../../packages/server/src/bun-pin-rewrite.js';
import { buildBunInstallArgs, startTransparentInstall } from '../../packages/server/src/bun-bg-install.js';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

// 1. The boot decision: a lock + prerelease installs proactively; all-caret +
//    no lock takes the zero-install fast path. (This is exactly what dev.js'
//    boot branch keys on: proactive when needsInstall is non-empty OR hasLock.)
const SCAFFOLD = JSON.stringify({
  dependencies: { '@webjsdev/core': '^0.1.0', pg: '^8.0.0' },
  devDependencies: { 'drizzle-kit': '1.0.0-rc.3' },
});
const LOCK = '{ "packages": { "drizzle-kit": ["drizzle-kit@1.0.0-rc.3"] } }';
const scaffold = classifyBunDeps(SCAFFOLD, LOCK);
const proactive = (c) => c.needsInstall.length > 0 || c.hasLock;
assert.equal(proactive(scaffold), true, 'a scaffold (drizzle prerelease + committed lock) installs proactively');
assert.ok(scaffold.needsInstall.includes('drizzle-kit'), 'the prerelease is the trigger');

const fast = classifyBunDeps(JSON.stringify({ dependencies: { zod: '^3.0.0' } }), null);
assert.equal(proactive(fast), false, 'all-caret + no lock serves zero-install (no blocking install)');

// 2. buildBunInstallArgs: frozen iff lock; reduced concurrency when detached;
//    never --lockfile-only (proven useless for moving to installed mode).
assert.deepEqual(buildBunInstallArgs({ hasLock: true }), ['install', '--frozen-lockfile']);
assert.deepEqual(buildBunInstallArgs({ hasLock: false }), ['install']);
assert.deepEqual(buildBunInstallArgs({ hasLock: false, detached: true }), ['install', '--network-concurrency', '4']);
assert.ok(!buildBunInstallArgs({ hasLock: true, detached: true }).includes('--lockfile-only'), 'never --lockfile-only');

// 3. startTransparentInstall with an injected spawn (no real bun): blocking
//    returns true on exit 0 when node_modules now exists; the lock-marker
//    serializes a concurrent run; fail-open never throws.
const calls = [];
const fakeSpawn = (code) => (bin, args) => {
  calls.push(args);
  const child = new EventEmitter();
  child.unref = () => {};
  queueMicrotask(() => child.emit('exit', code));
  return child;
};
const dir = mkdtempSync(join(tmpdir(), 'webjs-ti-'));
writeFileSync(join(dir, 'package.json'), '{}');
writeFileSync(join(dir, 'bun.lock'), '{ "packages": {} }');
mkdirSync(join(dir, 'node_modules')); // simulate the install's product
const ran = await startTransparentInstall(dir, { mode: 'blocking', log: () => {}, _spawn: fakeSpawn(0) });
assert.equal(ran, true, 'blocking install reports success when node_modules exists after exit 0');
assert.deepEqual(calls[0], ['install', '--frozen-lockfile'], 'spawned bun install --frozen-lockfile (a lock is present)');

// a held, non-stale marker blocks a concurrent install
mkdirSync(join(dir, '.webjs'), { recursive: true });
writeFileSync(join(dir, '.webjs', '.bun-install.lock'), 'held');
const blocked = await startTransparentInstall(dir, { mode: 'blocking', log: () => {}, _spawn: fakeSpawn(0) });
assert.equal(blocked, false, 'a held marker means an install is already in progress');

// fail-open: a throwing spawn never throws out
const dir2 = mkdtempSync(join(tmpdir(), 'webjs-ti2-'));
writeFileSync(join(dir2, 'package.json'), '{}');
const failed = await startTransparentInstall(dir2, { mode: 'blocking', log: () => {}, _spawn: () => { throw new Error('no bun'); } });
assert.equal(failed, false, 'fail-open returns false instead of throwing');
assert.ok(!existsSync(join(dir2, 'node_modules')), 'no node_modules was produced');

console.log('[transparent-install] OK on ' + (typeof Bun !== 'undefined' ? 'bun' : 'node'));
