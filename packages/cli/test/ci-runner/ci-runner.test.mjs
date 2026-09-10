/**
 * `runCi` (#1471), the `webjs ci` runner, driven entirely by a scripted fake
 * child: no real process, no real clock, no real timer. Each test states the
 * behaviour AND its counterfactual (the spawn that must NOT have happened, the
 * byte that must NOT have been written), so a regression fails by name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { sep } from 'node:path';
import {
  runCi,
  formatElapsed,
  formatProgress,
  stepSummaryMarkdown,
  formatSummary,
} from '../../lib/ci-runner.js';
import { normalizeSteps } from '../../lib/ci-config.js';

/** A fake ChildProcess: emits what the test tells it to, in the order it says. */
function fakeChild() {
  const c = new EventEmitter();
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.killed = null;
  c.kill = (sig) => { c.killed = sig || 'SIGTERM'; };
  return c;
}

/**
 * A spawn recorder. `calls[i]` is `{ cmd, opts, child }` in spawn order; the
 * test settles each child by hand with `finish()`.
 */
function recorder() {
  const calls = [];
  const spawn = (cmd, opts) => {
    const child = fakeChild();
    calls.push({ cmd, opts, child });
    return child;
  };
  return { calls, spawn, byCmd: (cmd) => calls.find((c) => c.cmd === cmd) };
}

/** Settle a child: optional output, then exit, then close (the real order). */
function finish(call, { code = 0, signal = null, out = '', err = '' } = {}) {
  if (out) call.child.stdout.emit('data', Buffer.from(out));
  if (err) call.child.stderr.emit('data', Buffer.from(err));
  call.child.emit('exit', code, signal);
  call.child.emit('close', code, signal);
}

const tick = () => new Promise((r) => setImmediate(r));
/** Let the runner reach its next spawn (several microtask hops deep). */
async function settle() { for (let i = 0; i < 5; i++) await tick(); }

/** A fake clock: every read advances one second, so a step always reads 1.00s. */
function clock() { let t = 0; return () => t++; }

/** Fake timers that never fire on their own; the test fires them. */
function timers() {
  const intervals = [];
  const timeouts = [];
  return {
    intervals,
    timeouts,
    api: {
      setInterval: (fn) => { intervals.push(fn); return { unref() {} }; },
      clearInterval: () => {},
      setTimeout: (fn) => { const h = { fn, cleared: false, unref() {} }; timeouts.push(h); return h; },
      clearTimeout: (h) => { if (h) h.cleared = true; },
    },
  };
}

function sink() {
  const chunks = [];
  return { chunks, write: (s) => { chunks.push(s); }, text: () => chunks.join('') };
}

const base = (extra = {}) => ({ now: clock(), timers: timers().api, env: { PATH: '/usr/bin' }, ...extra });

test('sequential steps inherit stdio, are not detached, and carry CI=true + local bin PATH + step env', async () => {
  const r = recorder();
  const out = sink();
  const { steps } = normalizeSteps(['echo a', { title: 'B', run: 'echo b', env: { WEBJS_E2E: '1' } }]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: out.write }));
  await settle();
  assert.equal(r.calls.length, 1, 'sequential: the second step is NOT spawned before the first finishes');
  finish(r.calls[0]);
  await settle();
  finish(r.calls[1]);
  const result = await run.done;

  assert.equal(result.ok, true);
  assert.deepEqual(result.steps.map((s) => [s.title, s.ok, s.code, s.output]), [['echo a', true, 0, null], ['B', true, 0, null]]);
  for (const c of r.calls) {
    assert.equal(c.opts.stdio, 'inherit');
    assert.equal(c.opts.detached, undefined, 'a sequential step is NOT detached (Ctrl-C must reach it natively)');
    assert.equal(c.opts.shell, true);
    assert.equal(c.opts.cwd, '/app');
    assert.equal(c.opts.env.CI, 'true');
    assert.ok(c.opts.env.PATH.startsWith(`/app${sep}node_modules${sep}.bin`), `PATH starts with the app's .bin: ${c.opts.env.PATH}`);
    assert.equal(c.opts.env.FORCE_COLOR, undefined, 'no FORCE_COLOR on an inherited step');
  }
  assert.equal(r.calls[1].opts.env.WEBJS_E2E, '1', 'the step env is merged in');
  assert.equal(r.calls[0].opts.env.WEBJS_E2E, undefined, 'and only for that step');
  const text = out.text();
  assert.match(text, /echo a\n[\s\S]*✅ echo a passed in 1\.00s/);
  assert.match(text, /\nB\necho b\n[\s\S]*✅ B passed in 1\.00s/);
  assert.doesNotMatch(text, /\r/, 'no progress line without a TTY');
});

test('a failing step fails the run; --fail-fast stops the dequeue, the default keeps going and lists every failure', async () => {
  const { steps } = normalizeSteps(['one', 'two', 'three']);

  const ff = recorder();
  const run1 = runCi(steps, '/app', base({ spawn: ff.spawn, write: () => {}, failFast: true }));
  await settle();
  finish(ff.calls[0], { code: 3 });
  const r1 = await run1.done;
  assert.equal(r1.ok, false);
  assert.deepEqual(ff.calls.map((c) => c.cmd), ['one'], 'counterfactual: nothing after the failure was spawned');
  assert.deepEqual(r1.steps.map((s) => [s.title, s.ok, s.code]), [['one', false, 3]]);

  const all = recorder();
  const out = sink();
  const run2 = runCi(steps, '/app', base({ spawn: all.spawn, write: out.write }));
  await settle();
  finish(all.calls[0], { code: 3 });
  await settle();
  finish(all.calls[1]);
  await settle();
  finish(all.calls[2], { code: 1 });
  const r2 = await run2.done;
  assert.equal(r2.ok, false);
  assert.deepEqual(all.calls.map((c) => c.cmd), ['one', 'two', 'three'], 'without --fail-fast every step runs');
  const summary = formatSummary(r2, 'Continuous Integration', false);
  assert.match(summary, /↳ one failed\n[\s\S]*↳ three failed\n/);
  assert.doesNotMatch(summary, /↳ two/);
  assert.match(summary, /❌ Continuous Integration failed in/);
});

test('a parallel group never exceeds its slots, captures each child, and replays each output whole', async () => {
  const r = recorder();
  const out = sink();
  const { steps } = normalizeSteps([{ title: 'Checks', parallel: 2, steps: ['a', 'b', 'c'] }]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: out.write }));
  await settle();
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b'], 'two slots: exactly two in flight, the third waits');
  for (const c of r.calls) {
    assert.deepEqual(c.opts.stdio, ['ignore', 'pipe', 'pipe'], 'captured: stdin ignored (no SIGTTIN), pipes for output');
    assert.equal(c.opts.detached, true, 'captured: its own process group so interrupt() reaps the tree');
    assert.equal(c.opts.env.CI, 'true');
    assert.equal(c.opts.env.FORCE_COLOR, undefined, 'no FORCE_COLOR when the parent is not a TTY');
  }
  // Interleave the two children's output; each step must still replay contiguously.
  r.calls[0].child.stdout.emit('data', Buffer.from('a1\n'));
  r.calls[1].child.stdout.emit('data', Buffer.from('b1\n'));
  r.calls[0].child.stderr.emit('data', Buffer.from('a2\n'));
  r.calls[1].child.stdout.emit('data', Buffer.from('b2\n'));
  assert.equal(out.text(), '', 'counterfactual: nothing is written while a captured step is still running');
  finish(r.calls[1], { code: 0 });
  await settle();
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b', 'c'], 'a freed slot dequeues the third step');
  finish(r.calls[0], { code: 2 });
  await settle();
  finish(r.calls[2], { out: 'c1\n' });
  const result = await run.done;

  const text = out.text();
  assert.match(text, /\nb\nb\nb1\nb2\n\n✅ b passed/, 'b replays heading, output, result as one block');
  assert.match(text, /\na\na\na1\na2\n\n❌ a failed/, 'a replays whole, after b (it finished later)');
  assert.ok(text.indexOf('✅ b passed') < text.indexOf('\na\na\n'), 'b was reported before a');
  assert.match(text, /\nc\nc\nc1\n\n✅ c passed/);
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => [s.title, s.ok, s.group]), [['b', true, 'Checks'], ['a', false, 'Checks'], ['c', true, 'Checks']]);
  assert.equal(result.steps[1].output, 'a1\na2\n', 'the captured output is on the result too (for --json)');
});

test('a group nested inside a parallel group takes ONE slot and runs sequentially', async () => {
  const r = recorder();
  const { steps } = normalizeSteps([
    { title: 'Checks', parallel: 2, steps: ['a', { title: 'Tests', steps: ['b', 'c'] }, 'd'] },
  ]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: () => {} }));
  await settle();
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b'], 'slot 1 runs a, slot 2 starts the nested group with b');
  finish(r.byCmd('a'));
  await settle();
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b', 'd'], 'a finishing frees slot 1 for d, NOT for c (c belongs to slot 2)');
  finish(r.byCmd('b'));
  await settle();
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b', 'd', 'c'], 'c starts only when b, its group sibling, is done');
  finish(r.byCmd('d'));
  finish(r.byCmd('c'));
  const result = await run.done;
  assert.equal(result.ok, true);
  assert.deepEqual(result.steps.filter((s) => s.group === 'Tests').map((s) => s.title), ['b', 'c']);
});

test('captured: data arriving after exit but before close is kept', async () => {
  const r = recorder();
  const { steps } = normalizeSteps([{ title: 'G', parallel: 2, steps: ['x'] }]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: () => {} }));
  await settle();
  const c = r.calls[0];
  c.child.stdout.emit('data', Buffer.from('before\n'));
  c.child.emit('exit', 0, null);
  c.child.stdout.emit('data', Buffer.from('after\n'));
  c.child.emit('close', 0, null);
  const result = await run.done;
  assert.equal(result.steps[0].output, 'before\nafter\n');
  assert.equal(result.steps[0].truncated, false);
});

test('captured: a close that never comes is bounded by the grace timer and marked truncated', async () => {
  const r = recorder();
  const t = timers();
  const { steps } = normalizeSteps([{ title: 'G', parallel: 2, steps: ['leaky'] }]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: () => {}, timers: t.api }));
  await settle();
  const c = r.calls[0];
  c.child.stdout.emit('data', Buffer.from('partial\n'));
  c.child.emit('exit', 0, null);
  assert.equal(t.timeouts.length, 1, 'the grace timer is armed on exit');
  let resolved = false;
  run.done.then(() => { resolved = true; });
  await settle();
  assert.equal(resolved, false, 'counterfactual: without close (or the grace firing) the step is still pending');
  t.timeouts[0].fn();
  const result = await run.done;
  assert.equal(result.steps[0].ok, true, 'exit 0 still counts as a pass');
  assert.equal(result.steps[0].truncated, true);
  assert.equal(result.steps[0].output, 'partial\n');
});

test('interrupt() kills every running child, stops the dequeue, and reports the run interrupted', async () => {
  const r = recorder();
  const out = sink();
  const { steps } = normalizeSteps([{ title: 'G', parallel: 2, steps: ['a', 'b', 'c'] }, 'after']);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: out.write }));
  await settle();
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b']);
  run.interrupt();
  assert.equal(r.calls[0].child.killed, 'SIGTERM', 'a is killed (fake child has no pid, so the group kill falls back to kill())');
  assert.equal(r.calls[1].child.killed, 'SIGTERM');
  finish(r.calls[0], { code: null, signal: 'SIGTERM' });
  finish(r.calls[1], { code: null, signal: 'SIGTERM' });
  const result = await run.done;
  assert.deepEqual(r.calls.map((c) => c.cmd), ['a', 'b'], 'counterfactual: neither c nor the trailing step was spawned');
  assert.equal(result.interrupted, true);
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps.map((s) => [s.title, s.interrupted, s.ok]), [['a', true, false], ['b', true, false]]);
  assert.match(out.text(), /❌ a interrupted/);
});

test('on a TTY the progress line renders only while the pool runs, is cleared before a replay, and colours captured children', async () => {
  const r = recorder();
  const out = sink();
  const t = timers();
  const { steps } = normalizeSteps(['first', { title: 'Checks', parallel: 2, steps: ['a', 'b'] }]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: out.write, isTTY: true, timers: t.api }));
  await settle();
  assert.equal(t.intervals.length, 0, 'counterfactual: no progress timer during an inherited step');
  assert.equal(r.calls[0].opts.env.FORCE_COLOR, undefined, 'an inherited step never gets FORCE_COLOR');
  finish(r.calls[0]);
  await settle();
  assert.equal(t.intervals.length, 1, 'the pool arms the progress timer');
  assert.equal(r.calls[1].opts.env.FORCE_COLOR, '1', 'a captured child on a TTY keeps its colours');
  t.intervals[0]();
  const drawn = out.text();
  assert.match(drawn, /\r\x1b\[K.*Checks \(\d+s\) - a \| b\.\.\./);
  finish(r.calls[1], { out: 'A\n' });
  await settle();
  const text = out.text();
  const clearIdx = text.lastIndexOf('\r\x1b[K', text.indexOf('A\n'));
  assert.ok(clearIdx !== -1 && clearIdx < text.indexOf('A\n'), 'the progress line is cleared before the replay');
  finish(r.calls[2]);
  await run.done;
});

test('GitHub Actions mode folds each step into a log group and annotates a failure', async () => {
  const r = recorder();
  const out = sink();
  const { steps } = normalizeSteps(['ok', { title: 'G', parallel: 2, steps: ['bad'] }]);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: out.write, actions: true }));
  await settle();
  finish(r.calls[0]);
  await settle();
  finish(r.calls[1], { code: 7, out: 'boom\n' });
  await run.done;
  const text = out.text();
  assert.match(text, /::group::ok\n[\s\S]*✅ ok passed[\s\S]*::endgroup::\n/);
  assert.doesNotMatch(text, /::error title=ok/);
  assert.match(text, /::group::bad\n[\s\S]*boom\n[\s\S]*❌ bad failed[\s\S]*::endgroup::\n::error title=bad::bad failed \(exit 7\)\n/);
});

test('captureAll captures sequential steps too (the --json path), and a spawn error is a failed step', async () => {
  const r = recorder();
  const out = sink();
  const { steps } = normalizeSteps(['one']);
  const run = runCi(steps, '/app', base({ spawn: r.spawn, write: out.write, captureAll: true }));
  await settle();
  assert.deepEqual(r.calls[0].opts.stdio, ['ignore', 'pipe', 'pipe']);
  r.calls[0].child.emit('error', new Error('spawn ENOENT'));
  const result = await run.done;
  assert.equal(result.ok, false);
  assert.equal(result.steps[0].code, 1);
  assert.match(result.steps[0].output, /spawn ENOENT/);
  assert.match(out.text(), /spawn ENOENT[\s\S]*❌ one failed/);
});

test('formatters: Rails elapsed shape, the progress line, and a pipe-safe step summary', () => {
  assert.equal(formatElapsed(2.113), '2.11s');
  assert.equal(formatElapsed(62.5), '1m2.50s');
  assert.equal(formatElapsed(0), '0.00s');
  assert.equal(formatProgress('Checks', 75.9, ['a', 'b'], false), 'Checks (1m15s) - a | b...');
  const md = stepSummaryMarkdown({
    ok: false,
    seconds: 3,
    interrupted: false,
    steps: [
      { title: 'a | b', run: 'echo "x|y"', ok: true, code: 0, signal: null, interrupted: false, seconds: 1 },
      { title: 'c', run: 'false', ok: false, code: 1, signal: null, interrupted: false, seconds: 2 },
    ],
  });
  assert.match(md, /^### ❌ Local CI failed in 3\.00s/);
  assert.match(md, /\| a \\\| b \| `echo "x\\\|y"` \| ✅ passed \| 1\.00s \|/);
  assert.match(md, /\| c \| `false` \| ❌ failed \(exit 1\) \| 2\.00s \|/);
});

test('an empty step list is not a pass', async () => {
  const run = runCi([], '/app', base({ spawn: () => { throw new Error('never'); }, write: () => {} }));
  const result = await run.done;
  assert.equal(result.ok, false);
  assert.deepEqual(result.steps, []);
});
