/**
 * Cache property test (issue #187, subsystem hardening).
 *
 * INVARIANT: the `cache(fn, { key, ttl })` helper recomputes iff there is no
 * fresh, valid cached value: a hit within TTL returns the memoized result
 * without re-running `fn`; after TTL or `invalidate()` it recomputes; a
 * corrupted (non-JSON) stored entry recomputes rather than throwing. The
 * existing cache-fn.test.js checks the happy path; this pins the
 * recompute-on-miss and corruption-tolerance invariants.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { cache } from '../../src/cache-fn.js';
import { setStore, getStore, memoryStore } from '../../src/cache.js';

beforeEach(() => setStore(memoryStore()));

test('a fresh hit returns the memoized value without re-running fn', async () => {
  let calls = 0;
  const f = cache(async (x) => { calls++; return { doubled: x * 2 }; }, { key: 'k', ttl: 60 });
  assert.deepEqual(await f(21), { doubled: 42 });
  assert.deepEqual(await f(21), { doubled: 42 });
  assert.equal(calls, 1, 'a fresh hit must not re-run fn');
});

test('distinct args memoize independently', async () => {
  let calls = 0;
  const f = cache(async (x) => { calls++; return x; }, { key: 'args', ttl: 60 });
  await f(1); await f(2); await f(1); await f(2);
  assert.equal(calls, 2, 'each distinct arg computes once');
});

test('recomputes after TTL expiry', async () => {
  let calls = 0;
  const f = cache(async () => { calls++; return calls; }, { key: 'ttl', ttl: 0.02 }); // 20ms
  assert.equal(await f(), 1);
  assert.equal(await f(), 1, 'within TTL, cached');
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(await f(), 2, 'after TTL, recomputed');
});

test('invalidate() forces a recompute', async () => {
  let calls = 0;
  const f = cache(async () => { calls++; return calls; }, { key: 'inv', ttl: 60 });
  assert.equal(await f(), 1);
  await f.invalidate();
  assert.equal(await f(), 2, 'invalidate evicts the entry');
});

test('a corrupted stored entry recomputes instead of throwing', async () => {
  let calls = 0;
  const f = cache(async () => { calls++; return { ok: true }; }, { key: 'corrupt', ttl: 60 });
  assert.deepEqual(await f(), { ok: true }); // calls = 1, stores valid JSON
  // Corrupt the stored value out from under the cache. The key carries the
  // value-format version segment (cache:<format>:<prefix>), so this targets
  // the same key the cache reads.
  await getStore().set('cache:r1:corrupt', '{not valid json', 60000);
  assert.deepEqual(await f(), { ok: true }, 'a non-JSON entry must trigger recompute, not throw');
  assert.equal(calls, 2, 'the corrupted read recomputed');
});
