import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeThenable } from '../../src/thenable-params.js';

test('sync access is unchanged after wrapping', () => {
  const p = makeThenable({ id: '7', slug: 'hello' });
  assert.equal(p.id, '7');
  assert.equal(p.slug, 'hello');
});

test('the object is await-able and resolves to a plain copy', async () => {
  const p = makeThenable({ id: '7' });
  const awaited = await p;
  assert.deepEqual(awaited, { id: '7' });
  // The awaited value is a PLAIN object (no lingering thenable), so awaiting it
  // again is a no-op resolve, not an infinite re-await.
  assert.equal(typeof (/** @type any */ (awaited).then), 'undefined');
});

test('destructuring the awaited value works (the Next 15/16 pattern)', async () => {
  const params = makeThenable({ id: '42' });
  const { id } = await params;
  assert.equal(id, '42');
});

test('COUNTERFACTUAL: then is non-enumerable, so spread/keys/JSON never see it', () => {
  const p = makeThenable({ id: '7', slug: 'x' });

  // Spread copies only the data keys, and the copy is NOT thenable (so it can
  // never poison a downstream Promise.resolve).
  const spread = { ...p };
  assert.deepEqual(spread, { id: '7', slug: 'x' });
  assert.equal(typeof (/** @type any */ (spread).then), 'undefined');

  // Object.keys / for...in / JSON.stringify are all unaffected.
  assert.deepEqual(Object.keys(p), ['id', 'slug']);
  assert.equal(JSON.stringify(p), '{"id":"7","slug":"x"}');
  const seen = [];
  for (const k in p) seen.push(k);
  assert.deepEqual(seen, ['id', 'slug']);

  // The property IS present but non-enumerable (proves the counterfactual: if a
  // future edit made `then` enumerable, the assertions above would fail).
  const desc = Object.getOwnPropertyDescriptor(p, 'then');
  assert.equal(desc?.enumerable, false);
  assert.equal(typeof desc?.value, 'function');
});

test('a real "then" data key is not clobbered', () => {
  const p = makeThenable({ then: 'tuesday', id: '1' });
  assert.equal(p.then, 'tuesday');
});

test('non-object inputs pass through untouched', () => {
  assert.equal(makeThenable(null), null);
  assert.equal(makeThenable(undefined), undefined);
});

test('Promise.resolve of a spread copy does not hang (poisoning guard)', async () => {
  const p = makeThenable({ id: '1' });
  // If `then` were enumerable, { ...p } would be thenable and this would try to
  // resolve it recursively. It must resolve to the plain object immediately.
  const resolved = await Promise.resolve({ ...p });
  assert.deepEqual(resolved, { id: '1' });
});
