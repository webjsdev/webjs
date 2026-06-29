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
  // The tag index is now a native SET on the memory store (#752); read it via
  // the SET primitive. The recorded cache key carries the value-format segment.
  const keys = await store.setMembers('cache:tag:posts');
  assert.deepEqual(keys, ['cache:r1:tag-index'], 'tag index holds the cache key as a set member');
});

test('revalidateTag evicts every cached key under that tag (cross-module)', async () => {
  // COUNTERFACTUAL ANCHOR. This is the test that proves tag eviction is real:
  // it depends on cache-fn.js recording the tag -> key index via addKeyToTags.
  // Delete that addKeyToTags call and revalidateTag finds no keys, so both
  // reads below serve the STALE cached value and the notEqual assertions fail.
  // (The function-form and revalidateTags tests below fail the same way.)
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

test('an untagged arg-specific read is unaffected by revalidateTag', async () => {
  // The honest framing of what the old mislabeled "COUNTERFACTUAL" test
  // actually checked: an UNTAGGED cache() records no index, so a
  // revalidateTag finds no key for it and the cached value persists. The
  // real counterfactual (proving tag eviction IS wired) is the cross-module
  // test above, which DOES tag and breaks if the index write is removed.
  setStore(memoryStore());
  let calls = 0;
  const fn = cache(async (id) => { calls++; return id; }, { key: 'untagged-arg', ttl: 60 });
  const v = await fn(7);
  assert.equal(await fn(7), v); // cached arg-specific entry
  await revalidateTag('untagged-arg'); // no index entry exists for it
  assert.equal(await fn(7), v); // still cached
  assert.equal(calls, 1);
});

test('revalidateTag tolerates an unknown tag (no throw, no-op)', async () => {
  setStore(memoryStore());
  await revalidateTag('never-seen'); // must not throw
  await revalidateTags(['also-never', 'nope']);
  assert.ok(true);
});

test('a throwing tags() function leaves the value cached and does not reject', async () => {
  // Best-effort guarantee: the value is stored BEFORE the tag index is
  // touched, so a tags function that throws (here reading .id off a null
  // arg) must not break the cached call. The call returns normally and the
  // second call is a cache HIT (no recompute); the entry is just untagged.
  setStore(memoryStore());
  let calls = 0;
  const origWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  try {
    const postById = cache(
      async (post) => { calls++; return { v: calls }; },
      { key: 'throwing-tags', ttl: 60, tags: (post) => ['post:' + post.id] } // throws on null post
    );
    const r1 = await postById(null); // tags(null) throws inside the wrapper
    assert.deepEqual(r1, { v: 1 }); // value still returned
    const r2 = await postById(null); // cache hit, no recompute
    assert.deepEqual(r2, { v: 1 });
    assert.equal(calls, 1, 'second call served from cache (taggability failure did not poison the store)');
    assert.equal(warned, true, 'a warning was emitted about the failed tag indexing');
  } finally {
    console.warn = origWarn;
  }
});
