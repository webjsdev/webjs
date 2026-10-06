/**
 * The dev live-reload watcher (#1521). `watchTree` replaced a recursive
 * `fs.promises.watch` on the app root, which on Node 24 (Linux) turned a
 * per-file EACCES (a `sed -i` temp file another user created with mode 0600)
 * into an uncaughtException that shut the dev server down, and which walked
 * all of `node_modules` on every boot. These tests run against the real
 * filesystem.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { watchTree, isWatchError } from '../../src/dev/watch-tree.js';
import { shouldIgnoreWatchPath } from '../../src/dev.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll until `pred()` holds or the deadline passes. */
async function until(pred, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await sleep(20); }
  return pred();
}

function app() {
  const root = mkdtempSync(join(tmpdir(), 'webjs-watch-tree-'));
  mkdirSync(join(root, 'app'));
  mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
  return root;
}

test('reports edits in a top-level dir and at the root, relative to the root', async () => {
  const root = app();
  const events = [];
  const close = watchTree(root, { ignore: shouldIgnoreWatchPath, onEvent: (p) => events.push(p), onError: () => {} });
  try {
    await sleep(50);
    writeFileSync(join(root, 'app/page.ts'), 'x');
    writeFileSync(join(root, 'middleware.ts'), 'x');
    assert.ok(await until(() => events.includes(join('app', 'page.ts')) && events.includes('middleware.ts')), `got ${JSON.stringify(events)}`);
  } finally {
    close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('never reports node_modules, and follows a top-level dir created after start', async () => {
  const root = app();
  const events = [];
  const close = watchTree(root, { ignore: shouldIgnoreWatchPath, onEvent: (p) => events.push(p), onError: () => {} });
  try {
    await sleep(50);
    writeFileSync(join(root, 'node_modules/pkg/index.js'), 'x');
    mkdirSync(join(root, 'lib'));
    assert.ok(await until(() => events.includes('lib')), 'the new dir is reported');
    await sleep(50);
    writeFileSync(join(root, 'lib/util.ts'), 'x');
    assert.ok(await until(() => events.includes(join('lib', 'util.ts'))), `got ${JSON.stringify(events)}`);
    assert.ok(!events.some((p) => p.includes('node_modules')), 'node_modules is not watched');
  } finally {
    close();
    rmSync(root, { recursive: true, force: true });
  }
});

// Root can read a mode-000 dir, so this case only means something as a normal
// user, which is how the bug happens (the dev server's user cannot read a file
// another user made).
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

test('an unwatchable path goes to onError and the rest keeps working (#1521)', { skip: asRoot || process.platform === 'win32' }, async () => {
  const root = app();
  // A locked dir at start (Node 26 throws from the watch call) and a file the
  // watcher cannot read created after start, exactly what `sed -i` run by
  // another user leaves behind (Node 24's JS recursive watcher emits 'error'
  // for it, which crashed the dev server). Without the 'error' listener the
  // second one is an uncaughtException that fails this test on Node 24.
  mkdirSync(join(root, 'locked'));
  chmodSync(join(root, 'locked'), 0o000);
  const events = [];
  const errors = [];
  let close = () => {};
  try {
    assert.doesNotThrow(() => {
      close = watchTree(root, { ignore: shouldIgnoreWatchPath, onEvent: (p) => events.push(p), onError: (e) => errors.push(e) });
    });
    await sleep(50);
    writeFileSync(join(root, 'app/sedyLKmba'), 'x', { mode: 0o000 });
    await sleep(200);
    writeFileSync(join(root, 'app/page.ts'), 'x');
    assert.ok(await until(() => events.includes(join('app', 'page.ts'))), 'other files still deliver events');
    assert.ok(errors.every(isWatchError), 'anything reported is a watch error');
  } finally {
    close();
    chmodSync(join(root, 'locked'), 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

test('isWatchError matches only errors from a watch syscall', () => {
  assert.equal(isWatchError(Object.assign(new Error('x'), { syscall: 'watch', code: 'EACCES' })), true);
  assert.equal(isWatchError(Object.assign(new Error('x'), { syscall: 'open', code: 'EACCES' })), false);
  assert.equal(isWatchError(new Error('x')), false);
  assert.equal(isWatchError(undefined), false);
});
