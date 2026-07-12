/**
 * Shared assertion helper for browser tests (#777). web-test-runner serves
 * these tests to a real browser, where `node:assert` is not available, so every
 * browser `.test.js` previously hand-rolled its own `const assert = {...}`. That
 * block was duplicated across ~50 files (and drifted: some had a Map-aware
 * `deepEqual`, some a plain JSON one). This is the single source of truth they
 * all import, a superset of every method the inline blocks defined, matching
 * their semantics exactly: strict `!==` for `equal` / `strictEqual`, a
 * JSON-stringify `deepEqual` (with Map + NaN normalization and sorted object
 * keys, the richer of the two inline variants), and sync `doesNotThrow` /
 * async `throws` (the only inline forms). Plain object, tree-shaking-irrelevant
 * (browser test code), so a test uses only the methods it needs.
 */
export const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  isOk: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  notOk: (v, msg) => { if (v) throw new Error(msg || `Expected falsy, got ${v}`); },
  isTrue: (v, msg) => { if (v !== true) throw new Error(msg || `Expected true, got ${v}`); },
  isFalse: (v, msg) => { if (v !== false) throw new Error(msg || `Expected false, got ${v}`); },
  isNaN: (v, msg) => { if (!Number.isNaN(v)) throw new Error(msg || `Expected NaN, got ${v}`); },
  isUndefined: (v, msg) => { if (v !== undefined) throw new Error(msg || `Expected undefined, got ${JSON.stringify(v)}`); },
  isArray: (v, msg) => { if (!Array.isArray(v)) throw new Error(msg || `Expected array, got ${typeof v}`); },
  equal: (a, b, msg) => {
    if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
  strictEqual: (a, b, msg) => {
    if (a !== b) throw new Error(msg || `Expected strict equal ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
  notEqual: (a, b, msg) => {
    if (a === b) throw new Error(msg || `Expected not equal to ${JSON.stringify(b)}`);
  },
  notStrictEqual: (a, b, msg) => {
    if (a === b) throw new Error(msg || `Expected different references`);
  },
  match: (s, re, msg) => { if (!re.test(s)) throw new Error(msg || `Expected ${s} to match ${re}`); },
  deepEqual: (a, b, msg) => {
    const norm = (v) => {
      if (v instanceof Map) return ['__map__', [...v.entries()].map(([k, vv]) => [k, norm(vv)])];
      if (Array.isArray(v)) return v.map(norm);
      if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
        return out;
      }
      if (Number.isNaN(v)) return '__NaN__';
      return v;
    };
    const aS = JSON.stringify(norm(a));
    const bS = JSON.stringify(norm(b));
    if (aS !== bS) throw new Error(msg || `deepEqual failed:\n  got    : ${aS}\n  expect : ${bS}`);
  },
  doesNotThrow: (fn, msg) => {
    try { fn(); } catch (e) { throw new Error(msg || `Unexpected throw: ${e.message}`); }
  },
  throws: async (fn, msg) => {
    let threw = false;
    try { await fn(); } catch { threw = true; }
    if (!threw) throw new Error(msg || 'Expected function to throw');
  },
};

export default assert;
