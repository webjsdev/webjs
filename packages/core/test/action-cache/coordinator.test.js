/**
 * Client tag-cache coordinator (#488): the per-tag generation model. A mutation
 * bumps a tag's generation; a key revalidates only when one of ITS tags was
 * invalidated since IT last fetched, so multiple keys sharing a tag each
 * revalidate independently (no global over-consume).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { markStale, registerKeyTags, consumeStale, parseTagHeader, fetchMark, __resetActionCache } from '../../src/action-cache-client.js';

beforeEach(() => __resetActionCache());

test('a mutation in flight during a read is caught on the NEXT read (no stale window)', () => {
  registerKeyTags('[1]', ['user:1']);            // an earlier fetch, since=clock(0)
  // A read R samples the clock BEFORE its fetch...
  const since = fetchMark();                      // 0
  // ...a mutation commits WHILE R is in flight...
  markStale(['user:1']);                          // clock -> 1
  // ...and R lands, registering with the BEFORE-fetch sample.
  registerKeyTags('[1]', ['user:1'], since);      // since=0, not the current clock
  // The next read must still bypass, because the tag advanced past R's sample.
  assert.equal(consumeStale('[1]'), true, 'the mid-flight mutation is not absorbed');
});

test('a fetched key bypasses after its tag is invalidated, once', () => {
  registerKeyTags('[1]', ['user:1']);
  assert.equal(consumeStale('[1]'), false, 'fresh: no bypass');
  markStale(['user:1']);
  assert.equal(consumeStale('[1]'), true, 'invalidated: bypass');
  // After the revalidating fetch re-registers, it is fresh again.
  registerKeyTags('[1]', ['user:1']);
  assert.equal(consumeStale('[1]'), false, 'revalidated: no bypass');
});

test('two keys sharing a tag BOTH revalidate (no global over-consume)', () => {
  registerKeyTags('[1]', ['posts']);
  registerKeyTags('[]', ['posts']);
  markStale(['posts']);
  assert.equal(consumeStale('[1]'), true, 'first key bypasses');
  // The second key must STILL bypass (the old design cleared the tag globally).
  assert.equal(consumeStale('[]'), true, 'second key also bypasses');
});

test('an unrecorded key (seeded / never fetched) does not bypass', () => {
  // No registerKeyTags -> the browser cache has no entry, so a normal fetch is
  // already fresh; bypass would be pointless.
  assert.equal(consumeStale('[5]'), false);
  markStale(['greeting']);
  assert.equal(consumeStale('[5]'), false, 'still no recorded tags -> no bypass');
});

test('a key only bypasses for ITS tags', () => {
  registerKeyTags('[1]', ['user:1']);
  markStale(['user:2']);
  assert.equal(consumeStale('[1]'), false, 'a different tag does not affect this key');
});

test('parseTagHeader trims and drops empties', () => {
  assert.deepEqual(parseTagHeader('a, b ,,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseTagHeader(''), []);
  assert.deepEqual(parseTagHeader(null), []);
});
