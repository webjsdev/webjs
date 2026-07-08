/**
 * Cross-runtime proof that the awaitable `params` / `searchParams` wrapper
 * (#848) behaves IDENTICALLY on Node and Bun. webjs runs on both (#508), and
 * the wrapper rides the SSR request/context path (runtime-sensitive), so the
 * non-enumerable `then` and the sync/await dual-read must hold on each runtime:
 *
 *   node test/bun/routing-params.mjs
 *   bun  test/bun/routing-params.mjs
 *
 * Uses defineProperty + await + spread, all of which are runtime primitives the
 * two engines could in principle diverge on (enumerability of a defined prop,
 * thenable-resolution of a spread copy). Run from the repo root.
 */
import assert from 'node:assert/strict';
import { makeThenable } from '../../packages/server/src/thenable-params.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

// Sync read is unchanged.
const params = makeThenable({ id: '7', slug: 'hello' });
assert.equal(params.id, '7');
assert.equal(params.slug, 'hello');

// Await yields a plain copy; destructuring works (the Next 15/16 pattern).
const awaited = await params;
assert.deepEqual(awaited, { id: '7', slug: 'hello' });
const { id } = await params;
assert.equal(id, '7');

// The `then` is non-enumerable on BOTH runtimes: spread / keys / JSON never see
// it, and the spread copy is not itself thenable (poisoning guard).
const spread = { ...params };
assert.deepEqual(spread, { id: '7', slug: 'hello' });
assert.equal(typeof spread.then, 'undefined');
assert.deepEqual(Object.keys(params), ['id', 'slug']);
assert.equal(JSON.stringify(params), '{"id":"7","slug":"hello"}');
assert.equal(Object.getOwnPropertyDescriptor(params, 'then')?.enumerable, false);

// Awaiting the spread copy must resolve immediately (would hang if `then` leaked).
const resolved = await Promise.resolve({ ...params });
assert.deepEqual(resolved, { id: '7', slug: 'hello' });

console.log(`OK  awaitable params/searchParams behave identically on ${runtime}`);
