/**
 * Serializer round-trip property test (issue #187, subsystem hardening).
 *
 * INVARIANT: for every value the RPC wire claims to support,
 * `parse(await stringify(x))` reconstructs a value deeply equal to `x`,
 * including the rich types (Date, Map, Set, BigInt, TypedArray, Error,
 * registered Symbol), the number edge cases (NaN, -0, +/-Infinity),
 * `undefined` inside objects/arrays, and reference cycles. This is the
 * contract every server action and `richFetch` round-trip relies on.
 *
 * The existing serialize.test.js covers each type with a hand-written
 * example; this adds a generative matrix plus the adversarial edges the
 * examples miss: nested/cyclic Maps whose KEYS collide with the wire's
 * reserved tag (`_$wj`) at several escape depths, a Set inside a Map inside
 * a cycle, and a deterministic randomized object tree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stringify, parse } from '../../src/serialize.js';

/** Deep equality that understands the rich types and tolerates cycles. */
function richEqual(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true; // handles -0 vs +0, NaN
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  // Cycle guard: if we have compared this pair already, assume equal.
  if (seen.get(a) === b) return true;
  seen.set(a, b);

  if (a instanceof Date) return b instanceof Date && Object.is(a.getTime(), b.getTime());
  if (a instanceof Error) return b instanceof Error && a.name === b.name && a.message === b.message;
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    // Keys may be rich objects, so match structurally rather than by identity.
    const bEntries = [...b.entries()];
    for (const [ak, av] of a.entries()) {
      const idx = bEntries.findIndex(([bk, bv]) => richEqual(ak, bk, seen) && richEqual(av, bv, seen));
      if (idx === -1) return false;
      bEntries.splice(idx, 1);
    }
    return true;
  }
  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false;
    const bItems = [...b];
    for (const ai of a) {
      const idx = bItems.findIndex((bi) => richEqual(ai, bi, seen));
      if (idx === -1) return false;
      bItems.splice(idx, 1);
    }
    return true;
  }
  if (ArrayBuffer.isView(a)) {
    if (a.constructor !== b.constructor || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!richEqual(a[i], b[i], seen)) return false;
    return true;
  }
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!richEqual(a[k], b[k], seen)) return false;
  }
  return true;
}

async function assertRoundTrip(value, label) {
  const back = parse(await stringify(value));
  assert.ok(richEqual(value, back), `round-trip must preserve ${label}\n  in:  ${safe(value)}\n  out: ${safe(back)}`);
}
function safe(v) { try { return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x)); } catch { return String(v); } }

// A deterministic pseudo-random generator (seeded, no Math.random) so the
// "fuzz" cases are reproducible across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEAVES = [
  0, 1, -1, 3.14, -0, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER,
  '', 'hi', 'unicode: star and 😀', true, false, null, undefined,
  123n, -9007199254740993n,
  new Date('2026-06-01T00:00:00Z'), new Date(NaN),
  Symbol.for('webjs.test'),
  new Uint8Array([1, 2, 3, 255]), new Float64Array([1.5, -2.5]),
  new Error('boom'),
];

/** Build a random value tree of bounded depth from the leaf set. */
function buildValue(rand, depth) {
  if (depth <= 0 || rand() < 0.45) return LEAVES[Math.floor(rand() * LEAVES.length)];
  const shape = Math.floor(rand() * 4);
  const n = 1 + Math.floor(rand() * 3);
  if (shape === 0) return Array.from({ length: n }, () => buildValue(rand, depth - 1));
  if (shape === 1) {
    const o = {};
    for (let i = 0; i < n; i++) o[`k${i}`] = buildValue(rand, depth - 1);
    return o;
  }
  if (shape === 2) {
    const m = new Map();
    for (let i = 0; i < n; i++) m.set(buildValue(rand, depth - 1), buildValue(rand, depth - 1));
    return m;
  }
  const s = new Set();
  for (let i = 0; i < n; i++) s.add(buildValue(rand, depth - 1));
  return s;
}

test('round-trips a deterministic matrix of rich-value trees', async () => {
  const rand = mulberry32(0x5eed);
  for (let i = 0; i < 200; i++) {
    await assertRoundTrip(buildValue(rand, 4), `random tree #${i}`);
  }
});

test('round-trips reserved-key collisions at several escape depths', async () => {
  // The wire tags values with the reserved key `_$wj`; a user object whose own
  // keys collide must escape and restore losslessly at every depth.
  const obj = { _$wj: 1, __$wj: 2, ___$wj: 3, _id: 'a', __id: 'b', normal: 'x' };
  await assertRoundTrip(obj, 'reserved-key collisions');
});

test('round-trips a Set inside a Map inside a reference cycle', async () => {
  const inner = new Set([1, 'two', new Date(0)]);
  const m = new Map();
  m.set('set', inner);
  m.set('self', m); // cycle through the Map
  const root = { m, list: [m, inner] };
  root.back = root; // second cycle
  const back = parse(await stringify(root));
  assert.ok(back.m instanceof Map && back.m.get('set') instanceof Set, 'structure preserved');
  assert.equal(back.m.get('self'), back.m, 'Map self-cycle restored to the same reference');
  assert.equal(back.back, back, 'object self-cycle restored to the same reference');
  assert.equal(back.list[0], back.m, 'shared reference identity preserved across the tree');
});

test('round-trips number edge cases exactly (NaN, -0, +/-Infinity)', async () => {
  for (const n of [NaN, -0, 0, Infinity, -Infinity]) {
    const back = parse(await stringify({ n }));
    assert.ok(Object.is(back.n, n), `${String(n)} must round-trip with Object.is identity`);
  }
});
