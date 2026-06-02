/**
 * Vendor pin-prune differential property test (issue #211, subsystem
 * hardening).
 *
 * INVARIANT (#197): a pinned app serves the SAME importmap as an unpinned
 * app, because a committed pin is pruned to the specifiers still reachable
 * from non-elided modules. So `prunePinToReachable(pin, integrity, reachable)`
 * keeps exactly the pin entries whose specifier (or whose base package, for a
 * subpath) is reachable, and drops the rest along with their integrity
 * hashes, which is precisely the set an unpinned live resolve would emit.
 * The existing prune-pin.test.js checks fixed cases; this asserts the
 * differential property across randomized pin/reachable combinations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prunePinToReachable } from '../../src/vendor.js';

/** Base package of a bare specifier (handles `@scope/pkg/sub`). */
function basePackage(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.slice(0, 2).join('/');
  }
  return spec.split('/')[0];
}

/** The set an unpinned resolve would keep: specifiers whose base is reachable. */
function expectedKept(specs, reachable) {
  const reachableBases = new Set([...reachable].map(basePackage));
  return specs.filter((s) => reachable.has(s) || reachableBases.has(basePackage(s)));
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = [
  'dayjs', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime',
  'axios', 'lodash', 'lodash/merge', '@scope/pkg', '@scope/pkg/sub',
  'picocolors', 'nanoid',
];

test('pruned pin equals the reachable-filtered set across random combinations', () => {
  const rand = mulberry32(0x1234);
  for (let i = 0; i < 300; i++) {
    const specs = POOL.filter(() => rand() < 0.5);
    if (specs.length === 0) continue;
    const imports = {};
    const integrity = {};
    for (const s of specs) {
      const url = `https://cdn/${s}.js`;
      imports[s] = url;
      integrity[url] = `sha384-${s}`;
    }
    const reachable = new Set(specs.filter(() => rand() < 0.5));

    const pruned = prunePinToReachable(imports, integrity, reachable);
    const kept = expectedKept(specs, reachable);

    assert.deepEqual(
      Object.keys(pruned.imports).sort(), kept.slice().sort(),
      `kept specifiers must equal the reachable-filtered set (specs=${specs}, reachable=${[...reachable]})`,
    );
    // Integrity is pruned in lockstep: every kept URL keeps its hash, dropped ones lose it.
    for (const s of kept) {
      assert.equal(pruned.integrity[imports[s]], `sha384-${s}`, `kept ${s} keeps its integrity`);
    }
    for (const s of specs) {
      if (!kept.includes(s)) {
        assert.ok(!(imports[s] in pruned.integrity), `dropped ${s} must not keep its integrity hash`);
      }
    }
  }
});

test('an unreachable pinned specifier (only an elided importer) is dropped', () => {
  const imports = { dayjs: 'u-dayjs', picocolors: 'u-pico' };
  const integrity = { 'u-dayjs': 'h-dayjs', 'u-pico': 'h-pico' };
  // Only picocolors is reachable; dayjs's only importer was an elided component.
  const pruned = prunePinToReachable(imports, integrity, new Set(['picocolors']));
  assert.deepEqual(pruned.imports, { picocolors: 'u-pico' }, 'unreachable dayjs is dropped');
  assert.deepEqual(pruned.integrity, { 'u-pico': 'h-pico' }, 'dropped dayjs integrity is pruned too');
});

test('a base pin entry is kept when a subpath is reachable, and vice versa', () => {
  const imports = { dayjs: 'u-base', 'dayjs/plugin/utc': 'u-sub' };
  const integrity = { 'u-base': 'h-base', 'u-sub': 'h-sub' };
  // Subpath reachable keeps the base.
  let pruned = prunePinToReachable(imports, integrity, new Set(['dayjs/plugin/utc']));
  assert.ok('dayjs' in pruned.imports && 'dayjs/plugin/utc' in pruned.imports, 'base kept when subpath reachable');
  // Base reachable keeps the subpath.
  pruned = prunePinToReachable(imports, integrity, new Set(['dayjs']));
  assert.ok('dayjs' in pruned.imports && 'dayjs/plugin/utc' in pruned.imports, 'subpath kept when base reachable');
});

test('an empty reachable set prunes everything; an all-reachable set is identity', () => {
  const imports = { a: 'ua', b: 'ub' };
  const integrity = { ua: 'ha', ub: 'hb' };
  assert.deepEqual(prunePinToReachable(imports, integrity, new Set()).imports, {}, 'empty reachable prunes all');
  assert.deepEqual(prunePinToReachable(imports, integrity, new Set(['a', 'b'])).imports, imports, 'all reachable is identity');
});
