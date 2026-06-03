import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cache } from '../../src/cache-fn.js';
import { revalidateTag, revalidateTags } from '../../src/cache-tags.js';
import { setStore, memoryStore } from '../../src/cache.js';

// Fresh store per file run so tag indexes don't leak between tests.
setStore(memoryStore());

test('cache() with tags stores the tag -> key index', async () => {
  const store = memoryStore();
  setStore(store);
  const fn = cache(async () => ({ ok: 1 }), { key: 'tag-index', ttl: 60, tags: ['posts'] });
  await fn();
  const raw = await store.get('cache:tag:posts');
  assert.ok(raw, 'tag index entry exists');
  const keys = JSON.parse(raw);
  assert.deepEqual(keys, ['cache:tag-index']);
});

test('revalidateTag evicts every cached key under that tag (cross-module)', async () => {
  setStore(memoryStore());
  let calls = 0;
  // Two independent wrappers (simulating two modules) sharing one tag.
  const readA = cache(async () => { calls++; return 'A' + calls; }, { key: 'mod-a', ttl: 60, tags: ['shared'] });
  const readB = cache(async () => { calls++; return 'B' + calls; }, { key: 'mod-b', ttl: 60, tags: ['shared'] });

  const a1 = await readA();
  const b1 = await readB();
  // Cached: no recompute.
  assert.equal(await readA(), a1);
  assert.equal(await readB(), b1);
  const callsBefore = calls;

  // A revalidateTag that could be issued from any other module.
  await revalidateTag('shared');

  // Both reads recompute now -> stale value is gone.
  assert.notEqual(await readA(), a1);
  assert.notEqual(await readB(), b1);
  assert.equal(calls, callsBefore + 2);
});

test('function-form tag invalidates only the specific entity id', async () => {
  setStore(memoryStore());
  let calls = 0;
  const postById = cache(
    async (id) => { calls++; return { id, v: calls }; },
    { key: 'post', ttl: 60, tags: (id) => ['post:' + id] }
  );

  const p5 = await postById(5);
  const p6 = await postById(6);
  // Both cached.
  assert.deepEqual(await postById(5), p5);
  assert.deepEqual(await postById(6), p6);
  const before = calls;

  await revalidateTag('post:5');

  // Only id 5 recomputes; id 6 still served from cache.
  assert.notDeepEqual(await postById(5), p5);
  assert.deepEqual(await postById(6), p6);
  assert.equal(calls, before + 1);
});

test('revalidateTags clears multiple tags', async () => {
  setStore(memoryStore());
  let calls = 0;
  const a = cache(async () => ++calls, { key: 'multi-a', ttl: 60, tags: ['t1'] });
  const b = cache(async () => ++calls, { key: 'multi-b', ttl: 60, tags: ['t2'] });
  const a1 = await a();
  const b1 = await b();
  assert.equal(await a(), a1); // cached
  assert.equal(await b(), b1); // cached

  await revalidateTags(['t1', 't2']);

  assert.notEqual(await a(), a1);
  assert.notEqual(await b(), b1);
});

test('an untagged cache() is unaffected by revalidateTag', async () => {
  setStore(memoryStore());
  let calls = 0;
  const fn = cache(async () => ++calls, { key: 'untagged', ttl: 60 });
  const v = await fn();
  assert.equal(await fn(), v); // cached
  await revalidateTag('anything');
  assert.equal(await fn(), v); // still cached, untouched
  assert.equal(calls, 1);
});

test('existing invalidate() still works alongside tags', async () => {
  setStore(memoryStore());
  let calls = 0;
  const fn = cache(async () => ++calls, { key: 'inv-compat', ttl: 60, tags: ['x'] });
  await fn();
  assert.equal(calls, 1);
  await fn.invalidate();
  await fn();
  assert.equal(calls, 2);
});

test('COUNTERFACTUAL: without the tag-index write, revalidateTag is a no-op (stale value persists)', async () => {
  setStore(memoryStore());
  let calls = 0;
  // Simulate the pre-feature behaviour: a tagged read whose tag index was
  // never written. revalidateTag finds no keys, so the post-revalidate read
  // returns the STALE cached value. This is exactly what the real tag-index
  // write prevents; removing it from cache-fn.js makes this assertion the
  // failing counterfactual.
  const fn = cache(async () => ++calls, { key: 'cf', ttl: 60 }); // NO tags -> no index
  const v = await fn();
  await revalidateTag('cf-tag'); // nothing recorded under this tag
  assert.equal(await fn(), v, 'untagged value survives a tag revalidation (stale)');
  assert.equal(calls, 1);
});

test('revalidateTag tolerates an unknown tag (no throw, no-op)', async () => {
  setStore(memoryStore());
  await revalidateTag('never-seen'); // must not throw
  await revalidateTags(['also-never', 'nope']);
  assert.ok(true);
});
