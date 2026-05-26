import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryStore, getStore, setStore } from '../../src/cache.js';

test('memoryStore get returns null for missing key', async () => {
  const store = memoryStore();
  assert.equal(await store.get('nope'), null);
});

test('memoryStore set then get round-trips a value', async () => {
  const store = memoryStore();
  await store.set('k', 'v');
  assert.equal(await store.get('k'), 'v');
});

test('memoryStore delete removes a key', async () => {
  const store = memoryStore();
  await store.set('k', 'v');
  await store.delete('k');
  assert.equal(await store.get('k'), null);
});

test('memoryStore increment creates key starting at 1', async () => {
  const store = memoryStore();
  const n = await store.increment('counter');
  assert.equal(n, 1);
  assert.equal(await store.get('counter'), '1');
});

test('memoryStore increment increases existing key', async () => {
  const store = memoryStore();
  await store.increment('c');
  await store.increment('c');
  const n = await store.increment('c');
  assert.equal(n, 3);
});

test('memoryStore TTL expiry returns null after expiry', async () => {
  const store = memoryStore();
  await store.set('tmp', 'val', 1); // 1ms TTL
  // Wait for expiry
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(await store.get('tmp'), null);
});

test('memoryStore increment resets expired key', async () => {
  const store = memoryStore();
  await store.increment('c', 1); // 1ms TTL
  await new Promise((r) => setTimeout(r, 10));
  const n = await store.increment('c');
  assert.equal(n, 1);
});

test('memoryStore LRU eviction removes oldest entry', async () => {
  const store = memoryStore({ maxSize: 3 });
  await store.set('a', '1');
  await store.set('b', '2');
  await store.set('c', '3');
  // Adding a 4th should evict 'a' (oldest)
  await store.set('d', '4');
  assert.equal(await store.get('a'), null);
  assert.equal(await store.get('b'), '2');
  assert.equal(await store.get('d'), '4');
});

test('memoryStore get refreshes LRU order', async () => {
  const store = memoryStore({ maxSize: 3 });
  await store.set('a', '1');
  await store.set('b', '2');
  await store.set('c', '3');
  // Touch 'a' so it becomes most recently used
  await store.get('a');
  // Adding 'd' should now evict 'b' (oldest after refresh)
  await store.set('d', '4');
  assert.equal(await store.get('a'), '1');
  assert.equal(await store.get('b'), null);
});

test('getStore returns a memoryStore by default', async () => {
  // Reset to default by setting null-ish: we test via API
  const store = getStore();
  await store.set('test-key', 'hello');
  assert.equal(await store.get('test-key'), 'hello');
});

test('setStore swaps the default store', async () => {
  const custom = memoryStore();
  await custom.set('custom', 'yes');
  setStore(custom);
  assert.equal(await getStore().get('custom'), 'yes');
  // Restore default
  setStore(memoryStore());
});

test('memoryStore: NaN ttl falls back to no expiration (was: silent eternal entry)', async () => {
  const s = memoryStore();
  await s.set('k', 'v', NaN);
  await new Promise((r) => setTimeout(r, 10));
  // NaN is non-finite, so we fall back to "no TTL" (entry persists).
  // This matches the documented "no TTL when ttlMs is undefined" path
  // rather than the prior surprise where NaN slipped past truthiness.
  assert.equal(await s.get('k'), 'v');
});

test('memoryStore: Infinity ttl falls back to no expiration', async () => {
  const s = memoryStore();
  await s.set('k', 'v', Infinity);
  assert.equal(await s.get('k'), 'v');
});

test('memoryStore: zero ttl falls back to no expiration', async () => {
  const s = memoryStore();
  await s.set('k', 'v', 0);
  assert.equal(await s.get('k'), 'v');
});

test('memoryStore: negative ttl is treated as no TTL (not "expire in the past")', async () => {
  const s = memoryStore();
  await s.set('k', 'v', -1000);
  assert.equal(await s.get('k'), 'v');
});

test('memoryStore: increment bumps LRU position (hot key survives eviction)', async () => {
  const s = memoryStore({ maxSize: 3 });
  await s.increment('hot', 60000);
  await s.set('b', '2', 60000);
  await s.set('c', '3', 60000);
  for (let i = 0; i < 5; i++) await s.increment('hot', 60000);
  await s.set('d', '4', 60000);
  // With the LRU-bump fix, 'hot' is most-recent and 'b' is oldest → 'b' evicts.
  // Pre-fix: 'hot' was at the original position 1 and got evicted instead.
  assert.equal(await s.get('hot'), '6');
  assert.equal(await s.get('b'), null);
  assert.equal(await s.get('c'), '3');
  assert.equal(await s.get('d'), '4');
});
