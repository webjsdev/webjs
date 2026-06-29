/**
 * The tag index must not lose a concurrent append (#752). The old path was a
 * read-modify-write of a JSON array: two `addKeyToTags` calls to the same tag
 * (across Redis instances, or interleaved in one process at the read/write
 * await gap) could each read the same stale array and overwrite each other, so
 * a later `revalidateTag` missed a key and served stale data. With the store's
 * atomic SET primitives (`setAdd` / `setMembers`) the add is a single atomic
 * insert and no entry is lost. A custom store WITHOUT the primitives keeps the
 * documented non-atomic JSON fallback.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addKeyToTags, revalidateTag } from '../../src/cache-tags.js';
import { setStore, memoryStore } from '../../src/cache.js';

const tagKey = (t) => `cache:tag:${t}`;

/** A minimal store with ONLY get/set/delete: forces the JSON-array fallback. */
function jsonOnlyStore() {
  const map = new Map();
  return {
    map,
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async set(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
    async increment() { return 1; },
  };
}

test('atomic store: concurrent addKeyToTags to one tag loses nothing', async () => {
  const store = memoryStore();
  setStore(store);
  const N = 50;
  await Promise.all(
    Array.from({ length: N }, (_, i) => addKeyToTags(['hot'], `key-${i}`, 60_000))
  );
  const members = await store.setMembers(tagKey('hot'));
  assert.equal(members.length, N, 'every concurrent key is present');
  assert.deepEqual(
    [...members].sort(),
    Array.from({ length: N }, (_, i) => `key-${i}`).sort(),
    'no concurrent append was lost'
  );
});

test('counterfactual: the JSON-array fallback DOES lose a concurrent append', async () => {
  // Proves the bug the atomic path fixes: a store without setAdd uses the
  // read-modify-write JSON path, which loses entries when two adds interleave.
  const store = jsonOnlyStore();
  setStore(store);
  await Promise.all([
    addKeyToTags(['t'], 'a', 60_000),
    addKeyToTags(['t'], 'b', 60_000),
  ]);
  const raw = store.map.get(tagKey('t'));
  const keys = JSON.parse(raw);
  assert.equal(keys.length, 1, 'the RMW lost one of the two concurrent appends');
  // Exactly one survived (last write wins), demonstrating the lost update.
  assert.ok(keys[0] === 'a' || keys[0] === 'b');
});

test('atomic store: revalidateTag after concurrent writes evicts ALL tagged keys', async () => {
  const store = memoryStore();
  setStore(store);
  // Seed real cache entries + tag them concurrently.
  const N = 20;
  await Promise.all(Array.from({ length: N }, async (_, i) => {
    await store.set(`val-${i}`, `v${i}`, 60_000);
    await addKeyToTags(['grp'], `val-${i}`, 60_000);
  }));
  // All present before eviction.
  for (let i = 0; i < N; i++) assert.equal(await store.get(`val-${i}`), `v${i}`);

  await revalidateTag('grp');

  // Every tagged key evicted, and the index entry cleared.
  for (let i = 0; i < N; i++) assert.equal(await store.get(`val-${i}`), null, `val-${i} evicted`);
  assert.deepEqual(await store.setMembers(tagKey('grp')), [], 'tag index cleared');
});

test('atomic store: setAdd dedups and refreshes TTL', async () => {
  const store = memoryStore();
  setStore(store);
  await addKeyToTags(['t'], 'k', 60_000);
  await addKeyToTags(['t'], 'k', 60_000); // duplicate
  assert.deepEqual(await store.setMembers(tagKey('t')), ['k'], 'no duplicate member');
});

test('custom store without atomic primitives still functions (sequential)', async () => {
  const store = jsonOnlyStore();
  setStore(store);
  await addKeyToTags(['t'], 'a', 60_000);
  await addKeyToTags(['t'], 'b', 60_000);
  await store.set('a', '1');
  await store.set('b', '2');
  await revalidateTag('t');
  assert.equal(await store.get('a'), null, 'a evicted via the fallback path');
  assert.equal(await store.get('b'), null, 'b evicted via the fallback path');
  assert.equal(store.map.has(tagKey('t')), false, 'fallback tag index cleared');
});

test('atomic store: an expired tag index returns no members', async () => {
  const store = memoryStore();
  setStore(store);
  await addKeyToTags(['t'], 'k', 1); // 1ms TTL
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(await store.setMembers(tagKey('t')), [], 'expired set prunes to empty');
});
