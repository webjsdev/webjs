/**
 * The vendor-resolve backoff ladder (#1644), pure and clock-injected: a failed
 * live resolve must not be retried on every request, only once per window,
 * doubling up to a cap, and a success or a rebuild clears it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRetryBackoff } from '../../src/dev/vendor-retry.js';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

test('allows the first attempt, then holds for the initial window after a failure', () => {
  const c = clock();
  const b = createRetryBackoff({ initialMs: 2000, maxMs: 60000, now: c.now });
  assert.equal(b.allow(), true, 'nothing has failed yet');
  b.failed();
  assert.equal(b.allow(), false, 'a failure opens a window');
  c.tick(1999);
  assert.equal(b.allow(), false, 'still inside the window');
  c.tick(1);
  assert.equal(b.allow(), true, 'the window has elapsed');
});

test('doubles the window on each failure and caps it', () => {
  const c = clock();
  const b = createRetryBackoff({ initialMs: 1000, maxMs: 5000, now: c.now });
  b.failed();
  assert.equal(b.windowMs(), 1000);
  b.failed();
  assert.equal(b.windowMs(), 2000);
  b.failed();
  assert.equal(b.windowMs(), 4000);
  b.failed();
  assert.equal(b.windowMs(), 5000, 'capped at maxMs');
  b.failed();
  assert.equal(b.windowMs(), 5000, 'stays capped');
});

test('a success or a reset clears the window and the next attempt is immediate', () => {
  const c = clock();
  const b = createRetryBackoff({ initialMs: 1000, now: c.now });
  b.failed();
  b.failed();
  assert.equal(b.allow(), false);
  b.succeeded();
  assert.equal(b.allow(), true, 'success clears');
  assert.equal(b.windowMs(), 0);
  b.failed();
  assert.equal(b.windowMs(), 1000, 'the ladder restarts from the initial window after a success');
  b.reset();
  assert.equal(b.allow(), true, 'a rebuild clears too');
  assert.equal(b.windowMs(), 0);
});

test('counterfactual: fifty requests inside one window yield one allowed attempt', () => {
  const c = clock();
  const b = createRetryBackoff({ initialMs: 2000, now: c.now });
  let attempts = 0;
  for (let i = 0; i < 50; i++) {
    if (b.allow()) { attempts++; b.failed(); }
    c.tick(10);
  }
  assert.equal(attempts, 1, 'without the gate every request would attempt (50)');
});

test('defaults: 2 s initial, 60 s cap', () => {
  const b = createRetryBackoff();
  b.failed();
  assert.equal(b.windowMs(), 2000);
  for (let i = 0; i < 10; i++) b.failed();
  assert.equal(b.windowMs(), 60000);
});

test('the handle is closure-based: a destructured reset or succeeded still works (#1645 review)', () => {
  const b = createRetryBackoff({ initialMs: 1000, now: () => 0 });
  const { reset, succeeded, failed, allow } = b;
  failed();
  assert.equal(allow(), false);
  reset();
  assert.equal(allow(), true, 'reset works without a receiver');
  failed();
  succeeded();
  assert.equal(b.windowMs(), 0, 'succeeded works without a receiver');
});
