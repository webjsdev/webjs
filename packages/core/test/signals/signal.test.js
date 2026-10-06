/**
 * Unit tests for the signal primitive (packages/core/src/signal.js).
 *
 * Covers: state read/write/peek, computed laziness + caching, dependency
 * tracking, dynamic dependency lists (a computed re-evaluation drops
 * stale deps), batching, watcher dispose, effect.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, isSignal, Signal } from '../../src/signal.js';

test('signal: get/set/peek and Object.is dedup', () => {
  const s = signal(0);
  assert.equal(s.get(), 0);
  s.set(1);
  assert.equal(s.get(), 1);
  assert.equal(s.peek(), 1);
  // Setting to same value should be a no-op.
  let notifies = 0;
  const w = new Signal.subtle.Watcher(() => notifies++);
  w.observe(() => s.get());
  s.set(1);
  assert.equal(notifies, 0, 'Object.is-equal set does not fire watcher');
  s.set(2);
  assert.equal(notifies, 1);
});

test('computed: lazy evaluation, caches across reads', () => {
  let evals = 0;
  const a = signal(2);
  const b = signal(3);
  const sum = computed(() => { evals++; return a.get() + b.get(); });
  assert.equal(evals, 0, 'no eval until first read');
  assert.equal(sum.get(), 5);
  assert.equal(evals, 1);
  assert.equal(sum.get(), 5);
  assert.equal(evals, 1, 'second read hits the cache');
  a.set(10);
  assert.equal(sum.get(), 13);
  assert.equal(evals, 2);
});

test('computed: drops stale deps on re-eval (dynamic dependency list)', () => {
  const cond = signal(true);
  const x = signal('x-val');
  const y = signal('y-val');
  let evals = 0;
  const c = computed(() => { evals++; return cond.get() ? x.get() : y.get(); });

  assert.equal(c.get(), 'x-val'); // deps: cond, x
  evals = 0;

  y.set('y-2'); // y is NOT a dep; should not invalidate
  assert.equal(c.get(), 'x-val');
  assert.equal(evals, 0, 'change to non-dep does not invalidate');

  cond.set(false); // deps change: now cond + y, x drops out
  assert.equal(c.get(), 'y-2');
  assert.equal(evals, 1);

  evals = 0;
  x.set('x-2'); // x is no longer a dep
  assert.equal(c.get(), 'y-2');
  assert.equal(evals, 0, 'former-dep change after re-eval does not invalidate');
});

test('Signal.subtle.Watcher: fires once per watch() call, dispose releases', () => {
  // Matches the TC39 fire-once-then-rewatch contract. observe(fn) is
  // a webjs convenience that runs fn with the watcher as the active
  // consumer, then re-arms. Subsequent set() fires notify once;
  // observe() (or watch()) must be called again to re-arm.
  const s = signal('a');
  let fires = 0;
  const w = new Signal.subtle.Watcher(() => fires++);
  w.observe(() => s.get());
  assert.equal(fires, 0);
  s.set('b');
  assert.equal(fires, 1);
  s.set('c');
  assert.equal(fires, 1, 'second change before re-arm does not refire');
  w.watch();
  s.set('d');
  assert.equal(fires, 2, 're-arm via watch() lets the next change fire');
  w.dispose();
  s.set('e');
  assert.equal(fires, 2, 'disposed watcher does not fire');
});

test('batch: coalesces multiple writes into one watcher notification', () => {
  const a = signal(1);
  const b = signal(2);
  let fires = 0;
  const w = new Signal.subtle.Watcher(() => fires++);
  w.observe(() => a.get() + b.get());
  batch(() => {
    a.set(10);
    b.set(20);
  });
  assert.equal(fires, 1, 'two writes inside batch -> one fire');
});

test('batch: nested batches drain at outermost close', () => {
  const a = signal(1);
  let fires = 0;
  const w = new Signal.subtle.Watcher(() => fires++);
  w.observe(() => a.get());
  batch(() => {
    a.set(2);
    batch(() => {
      a.set(3);
    });
    assert.equal(fires, 0, 'inner batch close does not flush');
  });
  assert.equal(fires, 1, 'flush at outermost close');
});

test('effect: runs once, re-runs on dep change (microtask), dispose stops it', async () => {
  const a = signal(0);
  const calls = [];
  const dispose = effect(() => { calls.push(a.get()); });
  assert.deepEqual(calls, [0], 'effect runs once eagerly');
  a.set(1);
  // Effect re-runs are deferred to a microtask (spec forbids reads
  // inside Watcher notify).
  await Promise.resolve();
  assert.deepEqual(calls, [0, 1]);
  a.set(2);
  await Promise.resolve();
  assert.deepEqual(calls, [0, 1, 2]);
  dispose();
  a.set(3);
  await Promise.resolve();
  assert.deepEqual(calls, [0, 1, 2], 'disposed effect does not run');
});

test('isSignal: discriminates signals from plain values', () => {
  assert.equal(isSignal(signal(0)), true);
  assert.equal(isSignal(computed(() => 1)), true);
  assert.equal(isSignal(0), false);
  assert.equal(isSignal({}), false);
  assert.equal(isSignal({ get() { return 1; } }), false);
  assert.equal(isSignal(null), false);
  assert.equal(isSignal(undefined), false);
});

test('Signal namespace: TC39-shaped surface', () => {
  assert.equal(typeof Signal.State, 'function');
  assert.equal(typeof Signal.Computed, 'function');
  assert.equal(typeof Signal.subtle.Watcher, 'function');
  const s = new Signal.State(7);
  assert.equal(s.get(), 7);
  s.set(8);
  assert.equal(s.get(), 8);
});

test('chain of computeds: invalidates downstream when leaf changes', () => {
  const a = signal(1);
  const b = computed(() => a.get() * 2);
  const c = computed(() => b.get() + 1);
  assert.equal(c.get(), 3);
  a.set(5);
  assert.equal(c.get(), 11);
  a.set(10);
  assert.equal(c.get(), 21);
});

// #1508: a consumer holds one producer slot per READ, so a signal read twice
// sits in two slots. The live edge used to be a plain set entry, which the
// first slot removal deleted outright: a run that went from two reads to one,
// or swapped the order of two reads, kept depending on the signal and stopped
// hearing about it. The edge is reference counted per slot now.
test('watcher: reading a signal twice, then once, keeps the subscription (#1508)', () => {
  const a = signal(0);
  const flag = signal(true);
  let fired = 0;
  const w = new Signal.subtle.Watcher(() => { fired++; });
  const run = () => w.observe(() => (flag.get() ? a.get() + a.get() : a.get()));
  run();                 // slots: flag, a, a
  flag.set(false);       // dirties the watcher
  run();                 // slots: flag, a (the second `a` slot is pruned)
  fired = 0;
  a.set(1);
  assert.equal(fired, 1, 'a change to a signal still read once must notify');
  w.dispose();
});

test('watcher: swapping the order of two reads keeps both subscriptions (#1508)', () => {
  const a = signal(0);
  const b = signal(0);
  const flip = signal(false);
  let fired = 0;
  const w = new Signal.subtle.Watcher(() => { fired++; });
  const run = () => w.observe(() => (flip.get() ? [b.get(), a.get()] : [a.get(), b.get()]));
  run();
  flip.set(true);
  run();                 // slot order a,b becomes b,a
  for (const s of [a, b]) {
    fired = 0;
    s.set(s.get() + 1);
    assert.equal(fired, 1, 'each signal still notifies after the reorder');
    run();
  }
  w.dispose();
});

test('watcher: dispose drops every slot of a doubly-read signal (#1508)', () => {
  const a = signal(0);
  let fired = 0;
  const w = new Signal.subtle.Watcher(() => { fired++; });
  w.observe(() => a.get() + a.get());
  assert.equal(Signal.subtle.hasSinks(a), true);
  w.dispose();
  assert.equal(Signal.subtle.hasSinks(a), false, 'no leaked edge after dispose');
  a.set(1);
  assert.equal(fired, 0);
});

test('computed: a double read that shrinks to one keeps the chain live (#1508)', () => {
  const a = signal(1);
  const twice = signal(true);
  const c = computed(() => (twice.get() ? a.get() + a.get() : a.get()));
  let fired = 0;
  const w = new Signal.subtle.Watcher(() => { fired++; });
  const run = () => w.observe(() => c.get());
  run();
  twice.set(false);
  run();
  fired = 0;
  a.set(5);
  assert.equal(fired, 1, 'the watcher hears the source through the computed');
  run();
  assert.equal(c.get(), 5);
  w.dispose();
});
