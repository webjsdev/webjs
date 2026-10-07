/**
 * Unit tests for the `webjs dev` reload supervisor (#1521).
 *
 * The bug: `webjs dev` on Node ran under `node --watch`, whose recursive
 * watcher crashed on an EACCES for a `sed -i` temp file another user created,
 * and the server child's own watcher took it down the same way. Nothing
 * restarted either, so the preview stayed dead. These tests cover the parts
 * that replace it: the restart state machine (driven by fake children and
 * fake timers, so no process is spawned), the watcher wiring that must turn
 * every watcher error into a callback instead of a throw, and the helpers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createSupervisor,
  watchRestartPaths,
  shouldIgnoreRestartPath,
  isWatchError,
  readRegenerateOutputs,
  CRASH_BACKOFF_MS,
} from '../../lib/dev-reload.js';
import { needsDirWalker } from '../../lib/watch-recursive.js';
import { PORT_IN_USE_EXIT_CODE } from '../../lib/port.js';

/** A controllable clock + timer queue. */
function fakeTimers() {
  let t = 0;
  let seq = 0;
  /** @type {Map<number, { at: number, fn: () => void }>} */
  const q = new Map();
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const id = ++seq; q.set(id, { at: t + ms, fn }); return id; },
    clearTimeout: (id) => { q.delete(id); },
    /** Advance the clock, firing due timers in order. */
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [id, e] of q) if (e.at <= end && (!next || e.at < next[1].at)) next = [id, e];
        if (!next) break;
        q.delete(next[0]);
        t = next[1].at;
        next[1].fn();
      }
      t = end;
    },
    pending: () => q.size,
  };
}

/** A fake child: records the signals it gets, exits when told to. */
function fakeChild() {
  const c = new EventEmitter();
  c.signals = [];
  c.kill = (sig) => { c.signals.push(sig); return true; };
  c.exit = (code, signal = null) => c.emit('exit', code, signal);
  return c;
}

function harness({ restartOnChange = true } = {}) {
  const timers = fakeTimers();
  const children = [];
  const logs = [];
  const finals = [];
  const sup = createSupervisor({
    restartOnChange,
    onFinal: (code) => finals.push(code),
    timers,
    now: timers.now,
    log: (l) => logs.push(l),
    spawnChild: () => { const c = fakeChild(); children.push(c); return c; },
  });
  return { sup, timers, children, logs, finals };
}

test('a change restarts the child: SIGTERM, then a new child the moment the old one exits', () => {
  const { sup, timers, children } = harness();
  sup.start();
  assert.equal(children.length, 1);
  sup.change('app/page.ts');
  timers.advance(49);
  assert.deepEqual(children[0].signals, [], 'still debouncing');
  timers.advance(1);
  assert.deepEqual(children[0].signals, ['SIGTERM']);
  assert.equal(children.length, 1, 'no replacement while the old child holds the port');
  children[0].exit(0, null);
  assert.equal(children.length, 2, 'replacement spawned on exit, not on a poll');
});

test('a burst of changes inside the debounce window restarts once', () => {
  const { sup, timers, children } = harness();
  sup.start();
  for (let i = 0; i < 5; i++) { sup.change(`app/f${i}.ts`); timers.advance(20); }
  timers.advance(50);
  assert.deepEqual(children[0].signals, ['SIGTERM']);
  children[0].exit(0);
  assert.equal(children.length, 2);
});

test('a change during a restart does not signal the old child twice', () => {
  const { sup, timers, children } = harness();
  sup.start();
  sup.change('app/a.ts');
  timers.advance(50);
  sup.change('app/b.ts');
  timers.advance(50);
  assert.deepEqual(children[0].signals, ['SIGTERM']);
});

test('a child that ignores SIGTERM is SIGKILLed after the kill timeout', () => {
  const { sup, timers, children } = harness();
  sup.start();
  sup.change('app/a.ts');
  timers.advance(50);
  timers.advance(2000);
  assert.deepEqual(children[0].signals, ['SIGTERM', 'SIGKILL']);
  children[0].exit(null, 'SIGKILL');
  assert.equal(children.length, 2);
});

test('a crashed child comes back on its own after the backoff (#1521)', () => {
  const { sup, timers, children, logs } = harness();
  sup.start();
  timers.advance(100);
  children[0].exit(1);
  assert.equal(children.length, 1, 'not restarted in a tight loop');
  assert.match(logs.at(-1), /exited \(code 1\); restarting in 500ms/);
  timers.advance(CRASH_BACKOFF_MS[0]);
  assert.equal(children.length, 2);
});

test('a child that could not bind its port is final: no restart, the supervisor reports its code (#1527)', () => {
  const { sup, timers, children, logs, finals } = harness();
  sup.start();
  children[0].exit(PORT_IN_USE_EXIT_CODE);
  assert.deepEqual(finals, [PORT_IN_USE_EXIT_CODE]);
  assert.ok(!logs.some((l) => /restarting in/.test(l)), 'no restart is announced');
  timers.advance(CRASH_BACKOFF_MS.at(-1) * 2);
  sup.change('app/page.ts');
  timers.advance(50);
  assert.equal(children.length, 1, 'neither the backoff nor a file change starts another child');
});

test('the same exit code from a signal-killed child is still a crash, not final', () => {
  const { sup, timers, children, finals } = harness();
  sup.start();
  children[0].exit(null, 'SIGKILL');
  assert.deepEqual(finals, []);
  timers.advance(CRASH_BACKOFF_MS[0]);
  assert.equal(children.length, 2);
});

test('a crashed child comes back at once on the next file change', () => {
  const { sup, timers, children } = harness();
  sup.start();
  children[0].exit(1);
  sup.change('app/page.ts');
  timers.advance(50);
  assert.equal(children.length, 2, 'started by the change, before the backoff');
  timers.advance(CRASH_BACKOFF_MS[0]);
  assert.equal(children.length, 2, 'the backoff timer was cancelled, so no second child');
});

test('consecutive crashes back off further, and a stable run resets it', () => {
  const { sup, timers, children } = harness();
  sup.start();
  children[0].exit(1);
  timers.advance(CRASH_BACKOFF_MS[0]);
  children[1].exit(1);
  timers.advance(CRASH_BACKOFF_MS[1] - 1);
  assert.equal(children.length, 2, 'second crash waits the second step');
  timers.advance(1);
  assert.equal(children.length, 3);
  timers.advance(10_000); // stays up past STABLE_MS
  children[2].exit(1);
  timers.advance(CRASH_BACKOFF_MS[0]);
  assert.equal(children.length, 4, 'back to the first step');
});

test('Bun (restartOnChange false): a change never restarts a live child, but starts a dead one', () => {
  const { sup, timers, children } = harness({ restartOnChange: false });
  sup.start();
  sup.change('app/page.ts');
  timers.advance(50);
  assert.deepEqual(children[0].signals, [], 'bun --hot reloads in place');
  children[0].exit(1);
  sup.change('app/page.ts');
  timers.advance(50);
  assert.equal(children.length, 2);
});

test('stop() terminates the child, resolves on its exit, and nothing restarts after', async () => {
  const { sup, timers, children } = harness();
  sup.start();
  const stopped = sup.stop();
  assert.deepEqual(children[0].signals, ['SIGTERM']);
  children[0].exit(0);
  await stopped;
  sup.change('app/page.ts');
  timers.advance(60_000);
  assert.equal(children.length, 1);
  assert.equal(timers.pending(), 0);
});

test('stop() while waiting out a crash backoff cancels the restart', async () => {
  const { sup, timers, children } = harness();
  sup.start();
  children[0].exit(1);
  await sup.stop();
  timers.advance(60_000);
  assert.equal(children.length, 1);
});

/** A fake `fs.watch`: records watchers so a test can fire events and errors. */
function fakeWatch() {
  const made = [];
  const fn = (path, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    const w = new EventEmitter();
    w.path = path; w.opts = opts; w.cb = cb; w.closed = false;
    w.close = () => { w.closed = true; };
    made.push(w);
    return w;
  };
  return { fn, made };
}

test('watchRestartPaths: a watcher error is reported to onError, never thrown (#1521)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-restart-watch-'));
  try {
    mkdirSync(join(root, 'app'));
    const { fn, made } = fakeWatch();
    const errors = [];
    const changes = [];
    const close = watchRestartPaths(root, {
      dirs: ['app', 'lib'], files: ['middleware.ts'],
      ignore: shouldIgnoreRestartPath,
      onChange: (p) => changes.push(p), onError: (e) => errors.push(e), watchFn: fn,
    });
    const appW = made.find((w) => w.path === join(root, 'app'));
    // Natively recursive, or (Linux under Node, #1529) one watcher per dir.
    assert.ok(appW && !!appW.opts.recursive === !needsDirWalker(), 'existing dir watched recursively');
    assert.ok(!made.some((w) => w.path === join(root, 'lib')), 'a missing dir is not watched yet');
    // The exact failure from the bug: Node's recursive watcher emits 'error'.
    const err = Object.assign(new Error('EACCES: permission denied, watch'), { code: 'EACCES', syscall: 'watch', path: join(root, 'app/sedX') });
    assert.doesNotThrow(() => appW.emit('error', err));
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(errors, [err]);
    appW.cb('rename', 'page.ts');
    assert.deepEqual(changes, [join('app', 'page.ts')], 'events keep flowing after the error');
    close();
    assert.ok(made.every((w) => w.closed));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('watchRestartPaths: root files, ignored paths, and a dir created later', () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-restart-watch-'));
  try {
    const { fn, made } = fakeWatch();
    const changes = [];
    watchRestartPaths(root, {
      dirs: ['app', 'lib'], files: ['middleware.ts'],
      ignore: shouldIgnoreRestartPath,
      onChange: (p) => changes.push(p), onError: () => {}, watchFn: fn,
    });
    const rootW = made.find((w) => w.path === root);
    assert.ok(rootW && !rootW.opts.recursive, 'the root is watched non-recursively');
    rootW.cb('change', 'middleware.ts');
    rootW.cb('change', 'package-lock.json');
    assert.deepEqual(changes, ['middleware.ts'], 'only the planned root files count');
    mkdirSync(join(root, 'lib'));
    rootW.cb('rename', 'lib');
    const libW = made.find((w) => w.path === join(root, 'lib'));
    assert.ok(libW, 'a planned dir created after start is watched');
    libW.cb('change', join('node_modules', 'x.js'));
    libW.cb('change', 'util.ts');
    assert.deepEqual(changes.slice(1), ['lib', join('lib', 'util.ts')]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isWatchError matches only errors from a watch syscall', () => {
  assert.equal(isWatchError(Object.assign(new Error('x'), { syscall: 'watch', code: 'EACCES' })), true);
  assert.equal(isWatchError(Object.assign(new Error('x'), { syscall: 'open', code: 'EACCES' })), false);
  assert.equal(isWatchError(new TypeError('boom')), false);
  assert.equal(isWatchError(null), false);
});

test('shouldIgnoreRestartPath skips build noise, keeps source', () => {
  assert.equal(shouldIgnoreRestartPath('app/node_modules/x.js'), true);
  assert.equal(shouldIgnoreRestartPath('lib/.webjs/routes.d.ts'), true);
  assert.equal(shouldIgnoreRestartPath('app/page.ts'), false);
  assert.equal(shouldIgnoreRestartPath('lib/db/schema.server.ts'), false);
});

test('readRegenerateOutputs reads webjs.dev.regenerate outputs, normalized', () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-regen-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      webjs: { dev: { regenerate: [{ output: './app/gen.css', command: 'x' }, { output: 'public/tailwind.css', command: 'y' }] } },
    }));
    assert.deepEqual([...readRegenerateOutputs(root)].sort(), ['app/gen.css', 'public/tailwind.css']);
    assert.deepEqual([...readRegenerateOutputs(join(root, 'missing'))], []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
