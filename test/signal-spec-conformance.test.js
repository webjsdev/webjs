/**
 * Spec conformance suite for the TC39 Signals proposal subset that
 * webjs implements. Mirrors the proposal's normative behaviors and
 * the signal-polyfill reference. If TC39 semantics drift, this
 * suite is what flags the divergence first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signal,
  computed,
  effect,
  batch,
  Signal,
} from '../packages/core/src/signal.js';

// ────────────────────────────────────────────────────────────────
// 1. Memoized notify: downstream computeds short-circuit when an
//    intermediate computed's output is unchanged.
// ────────────────────────────────────────────────────────────────

test('memoized notify: downstream computed does not re-eval when intermediate output unchanged', () => {
  const a = signal(1);
  let bEvals = 0;
  const b = computed(() => { bEvals++; return a.get() % 2 ? 'odd' : 'even'; });
  let cEvals = 0;
  const c = computed(() => { cEvals++; return b.get() + '!'; });
  // Make the chain live by watching c.
  const w = new Signal.subtle.Watcher(() => {});
  w.watch(c);
  assert.equal(c.get(), 'odd!');
  bEvals = cEvals = 0;
  a.set(3); // still odd
  // The watcher fires (transitive notify is by design); the
  // memoization win is downstream of b.
  c.get();
  assert.equal(bEvals, 1, 'b re-evaluates because a changed');
  assert.equal(cEvals, 0, 'c does not re-evaluate because b output unchanged');
  w.dispose();
});

// ────────────────────────────────────────────────────────────────
// 2. Frozen notification phase: reads and writes throw inside notify.
// ────────────────────────────────────────────────────────────────

test('signal read inside Watcher notify throws', () => {
  const a = signal(1);
  let caught;
  const w = new Signal.subtle.Watcher(() => {
    try { a.get(); } catch (e) { caught = e; }
  });
  w.watch(a);
  a.set(2);
  assert.ok(caught, 'expected throw');
  assert.match(caught.message, /notification phase/);
  w.dispose();
});

test('signal write inside Watcher notify throws', () => {
  const a = signal(1);
  const b = signal(0);
  let caught;
  const w = new Signal.subtle.Watcher(() => {
    try { b.set(99); } catch (e) { caught = e; }
  });
  w.watch(a);
  a.set(2);
  assert.ok(caught, 'expected throw');
  assert.match(caught.message, /notification phase/);
  w.dispose();
});

// ────────────────────────────────────────────────────────────────
// 3. equals option on State + Computed.
// ────────────────────────────────────────────────────────────────

test('Signal.State `equals` option suppresses no-op set', () => {
  let fires = 0;
  const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const s = new Signal.State({ x: 1 }, { equals: deepEq });
  const w = new Signal.subtle.Watcher(() => fires++);
  w.watch(s);
  s.set({ x: 1 }); // structurally equal, custom equals returns true
  assert.equal(fires, 0, 'custom equals suppressed notify');
  s.set({ x: 2 });
  assert.equal(fires, 1);
  w.dispose();
});

test('Signal.Computed `equals` option memoizes downstream', () => {
  const a = signal(1);
  // Equal if both are odd, both are even (so flipping within parity is a "no change").
  const parityEq = (oldV, newV) => (oldV % 2) === (newV % 2);
  const c = new Signal.Computed(() => a.get(), { equals: parityEq });
  let dEvals = 0;
  const d = computed(() => { dEvals++; return c.get() + 100; });
  const w = new Signal.subtle.Watcher(() => {});
  w.watch(d);
  assert.equal(d.get(), 101);
  dEvals = 0;
  a.set(3); // 1 -> 3, parity equal, c reports unchanged
  d.get();
  assert.equal(dEvals, 0, 'd does not re-eval because c (per custom equals) is unchanged');
  a.set(2); // 3 -> 2, parity differs
  d.get();
  assert.equal(dEvals, 1, 'd re-evals when c actually changed per custom equals');
  w.dispose();
});

// ────────────────────────────────────────────────────────────────
// 4. watched / unwatched lifecycle hooks.
// ────────────────────────────────────────────────────────────────

test('Signal.subtle.watched fires when first live consumer attaches', () => {
  let watchedCalls = 0, unwatchedCalls = 0;
  const s = new Signal.State(0, {
    [Signal.subtle.watched]:   () => watchedCalls++,
    [Signal.subtle.unwatched]: () => unwatchedCalls++,
  });
  assert.equal(watchedCalls, 0);
  assert.equal(unwatchedCalls, 0);

  const w = new Signal.subtle.Watcher(() => {});
  w.watch(s);
  assert.equal(watchedCalls, 1, 'watched fired on attach');

  w.unwatch(s);
  assert.equal(unwatchedCalls, 1, 'unwatched fired on detach');

  w.dispose();
});

test('Signal.subtle.watched does NOT fire when a SECOND consumer attaches', () => {
  let watchedCalls = 0;
  const s = new Signal.State(0, { [Signal.subtle.watched]: () => watchedCalls++ });
  const w1 = new Signal.subtle.Watcher(() => {});
  const w2 = new Signal.subtle.Watcher(() => {});
  w1.watch(s);
  w2.watch(s);
  assert.equal(watchedCalls, 1, 'watched fires only on 0->1, not 1->2');
  w1.dispose();
  w2.dispose();
});

// ────────────────────────────────────────────────────────────────
// 5. Introspection helpers.
// ────────────────────────────────────────────────────────────────

test('introspectSources returns recorded producers', () => {
  const a = signal(1);
  const b = signal(2);
  const c = computed(() => a.get() + b.get());
  c.get();
  const sources = Signal.subtle.introspectSources(c);
  assert.equal(sources.length, 2);
  assert.ok(sources.includes(a));
  assert.ok(sources.includes(b));
});

test('hasSinks and hasSources reflect graph state', () => {
  const a = signal(1);
  assert.equal(Signal.subtle.hasSinks(a), false);
  assert.equal(Signal.subtle.hasSources(new Signal.subtle.Watcher(() => {})), false);

  const w = new Signal.subtle.Watcher(() => {});
  w.watch(a);
  assert.equal(Signal.subtle.hasSinks(a), true);
  assert.equal(Signal.subtle.hasSources(w), true);
  w.dispose();
  assert.equal(Signal.subtle.hasSinks(a), false);
});

test('introspectSinks lists live consumers', () => {
  const a = signal(1);
  const w = new Signal.subtle.Watcher(() => {});
  w.watch(a);
  const sinks = Signal.subtle.introspectSinks(a);
  assert.equal(sinks.length, 1);
  assert.equal(sinks[0], w);
  w.dispose();
});

test('currentComputed returns the innermost active Computed', () => {
  let captured;
  const c = computed(() => {
    captured = Signal.subtle.currentComputed();
    return 0;
  });
  c.get();
  assert.equal(captured, c);
  assert.equal(Signal.subtle.currentComputed(), null, 'null at top level');
});

// ────────────────────────────────────────────────────────────────
// 6. Watcher spec API: watch / unwatch / getPending / watch() to re-arm.
// ────────────────────────────────────────────────────────────────

test('Watcher.watch(...signals) registers, notify fires once, re-arm via watch()', () => {
  const a = signal(0);
  let fires = 0;
  const w = new Signal.subtle.Watcher(() => fires++);
  w.watch(a);
  a.set(1);
  assert.equal(fires, 1);
  a.set(2);
  assert.equal(fires, 1, 'no refire until re-arm');
  w.watch(); // re-arm
  a.set(3);
  assert.equal(fires, 2);
  w.dispose();
});

test('Watcher.unwatch stops further notify for the named signal', () => {
  const a = signal(0);
  const b = signal(0);
  let fires = 0;
  const w = new Signal.subtle.Watcher(() => fires++);
  w.watch(a, b);
  w.unwatch(a);
  a.set(1);
  assert.equal(fires, 0);
  b.set(1);
  assert.equal(fires, 1);
  w.dispose();
});

test('Watcher.getPending returns dirty Computeds in the watched set', () => {
  const a = signal(1);
  const c = computed(() => a.get() * 2);
  const w = new Signal.subtle.Watcher(() => {});
  w.watch(c);
  assert.deepEqual(w.getPending(), []);
  a.set(2);
  // c is now dirty; getPending lists it
  assert.deepEqual(w.getPending(), [c]);
  // Reading c cleans it
  c.get();
  assert.deepEqual(w.getPending(), []);
  w.dispose();
});

// ────────────────────────────────────────────────────────────────
// 7. Glitch-freeness: diamond evaluates each node exactly once on
//    leaf change.
// ────────────────────────────────────────────────────────────────

test('diamond dependency evaluates D exactly once on A.set', () => {
  const a = signal(1);
  let bEvals = 0, cEvals = 0, dEvals = 0;
  const b = computed(() => { bEvals++; return a.get() + 1; });
  const c = computed(() => { cEvals++; return a.get() * 2; });
  const d = computed(() => { dEvals++; return b.get() + c.get(); });
  const w = new Signal.subtle.Watcher(() => {});
  w.watch(d);
  d.get();
  bEvals = cEvals = dEvals = 0;
  a.set(5);
  d.get();
  assert.equal(bEvals, 1);
  assert.equal(cEvals, 1);
  assert.equal(dEvals, 1);
  w.dispose();
});

// ────────────────────────────────────────────────────────────────
// 8. Error semantics.
// ────────────────────────────────────────────────────────────────

test('computed body throw caches the error; re-throws on next read until dep changes', () => {
  const a = signal('throw');
  const c = computed(() => {
    if (a.get() === 'throw') throw new Error('boom');
    return a.get();
  });
  let e1, e2;
  try { c.get(); } catch (e) { e1 = e.message; }
  try { c.get(); } catch (e) { e2 = e.message; }
  assert.equal(e1, 'boom');
  assert.equal(e2, 'boom');
  a.set('ok');
  assert.equal(c.get(), 'ok');
});

test('cycle in computed throws', () => {
  let c;
  c = computed(() => c.get() + 1);
  let caught;
  try { c.get(); } catch (e) { caught = e; }
  assert.ok(caught);
  assert.match(caught.message, /cycle/i);
});

// ────────────────────────────────────────────────────────────────
// 9. Batch defers Watcher notify.
// ────────────────────────────────────────────────────────────────

test('batch defers Watcher notify until outermost batch closes', () => {
  const a = signal(0);
  const b = signal(0);
  let fires = 0;
  const w = new Signal.subtle.Watcher(() => fires++);
  w.watch(a, b);
  batch(() => {
    a.set(1);
    b.set(1);
    assert.equal(fires, 0, 'no fire while batch open');
  });
  assert.equal(fires, 1, 'one fire after batch close');
  w.dispose();
});

// ────────────────────────────────────────────────────────────────
// 10. untrack suppresses dep recording.
// ────────────────────────────────────────────────────────────────

test('Signal.subtle.untrack suppresses dep tracking for reads inside it', () => {
  const a = signal(1);
  const b = signal(2);
  const c = computed(() => {
    // a is tracked, b is not.
    return a.get() + Signal.subtle.untrack(() => b.get());
  });
  assert.equal(c.get(), 3);
  let cEvals = 0;
  const cTrack = computed(() => { cEvals++; return c.get(); });
  cTrack.get();
  cEvals = 0;
  b.set(99); // b is not tracked by c, so c does not re-eval
  cTrack.get();
  assert.equal(cEvals, 0, 'b change does not re-eval c (untracked)');
  a.set(10); // a IS tracked
  cTrack.get();
  assert.equal(cEvals, 1, 'a change re-evals c');
});
