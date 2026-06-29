/**
 * cache() must preserve rich types (Date, Map, Set, ...) with the SAME shape
 * on a warm hit as on a cold miss (#748). Before the fix, cache() used
 * JSON.stringify/parse, so a Date came back as the real Date on a cold miss
 * (fn ran) but as a STRING on a warm hit (JSON.parse), and Map/Set args
 * collided to the same key. These tests pin the fidelity and the key-safety.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cache } from '../../src/cache-fn.js';
import { setStore, memoryStore } from '../../src/cache.js';

setStore(memoryStore());

test('Date survives a warm hit with identical shape (counterfactual: JSON would return a string)', async () => {
  const when = new Date('2024-01-02T03:04:05.678Z');
  let calls = 0;
  const fn = cache(async () => { calls++; return { when }; }, { key: 'rich-date', ttl: 60 });

  const miss = await fn();   // cold: fn ran, real Date
  const hit = await fn();    // warm: served from cache

  assert.equal(calls, 1, 'second call is a cache hit');
  // The bug this guards: on the OLD JSON path hit.when would be a string, so
  // `instanceof Date` would be false and this assertion would fail.
  assert.ok(miss.when instanceof Date, 'cold miss returns a Date');
  assert.ok(hit.when instanceof Date, 'warm hit also returns a Date (not a string)');
  assert.equal(hit.when.getTime(), when.getTime(), 'warm hit Date has the same value');
  assert.equal(typeof hit.when, typeof miss.when, 'hit and miss return the same type');
});

test('Map and Set survive a warm hit', async () => {
  const value = {
    map: new Map([['a', 1], ['b', 2]]),
    set: new Set([10, 20, 30]),
  };
  let calls = 0;
  const fn = cache(async () => { calls++; return value; }, { key: 'rich-mapset', ttl: 60 });

  await fn();              // cold
  const hit = await fn();  // warm

  assert.equal(calls, 1);
  assert.ok(hit.map instanceof Map, 'Map round-trips as a Map (JSON would yield {})');
  assert.ok(hit.set instanceof Set, 'Set round-trips as a Set (JSON would yield [])');
  assert.equal(hit.map.get('a'), 1);
  assert.equal(hit.map.get('b'), 2);
  assert.deepEqual([...hit.set], [10, 20, 30]);
});

test('nested Date inside an array round-trips on a warm hit', async () => {
  const rows = [
    { id: 1, createdAt: new Date('2020-05-06T00:00:00.000Z') },
    { id: 2, createdAt: new Date('2021-07-08T00:00:00.000Z') },
  ];
  const fn = cache(async () => rows, { key: 'rich-rows', ttl: 60 });
  await fn();
  const hit = await fn();
  assert.ok(hit[0].createdAt instanceof Date);
  assert.ok(hit[1].createdAt instanceof Date);
  assert.equal(hit[1].createdAt.getTime(), rows[1].createdAt.getTime());
});

test('distinct Map args do NOT collide to the same cache key', async () => {
  // JSON.stringify(new Map(...)) is "{}", so EVERY Map arg keyed to the same
  // entry and the second call wrongly returned the first call's cached value.
  let calls = 0;
  const fn = cache(
    async (m) => { calls++; return m.get('id'); },
    { key: 'rich-mapargs', ttl: 60 },
  );

  const a = await fn(new Map([['id', 'alpha']]));
  const b = await fn(new Map([['id', 'beta']]));

  assert.equal(a, 'alpha');
  assert.equal(b, 'beta', 'a different Map arg must not return the first call cached value');
  assert.equal(calls, 2, 'the two distinct Map args produce two distinct cache entries');
});

test('distinct Set args do NOT collide to the same cache key', async () => {
  let calls = 0;
  const fn = cache(
    async (s) => { calls++; return [...s].join(','); },
    { key: 'rich-setargs', ttl: 60 },
  );
  const a = await fn(new Set([1, 2]));
  const b = await fn(new Set([3, 4]));
  assert.equal(a, '1,2');
  assert.equal(b, '3,4');
  assert.equal(calls, 2);
});

test('a plain primitive value still caches normally', async () => {
  let calls = 0;
  const fn = cache(async () => { calls++; return 42; }, { key: 'rich-plain', ttl: 60 });
  assert.equal(await fn(), 42);
  assert.equal(await fn(), 42);
  assert.equal(calls, 1);
});
