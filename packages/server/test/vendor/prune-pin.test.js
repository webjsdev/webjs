// Unit tests for prunePinToReachable (#197): a committed pin is pruned to the
// vendor specifiers still reachable from non-elided modules, so a pinned app
// serves the same import map an unpinned app would.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prunePinToReachable } from '../../src/vendor.js';

test('drops a pinned package that is no longer reachable (elided-only dep)', () => {
  const imports = {
    dayjs: 'https://ga.jspm.io/npm:dayjs@1.11.21/dayjs.min.js',
    picocolors: 'https://ga.jspm.io/npm:picocolors@1.0.0/picocolors.js',
  };
  const integrity = {
    'https://ga.jspm.io/npm:dayjs@1.11.21/dayjs.min.js': 'sha384-dayjs',
    'https://ga.jspm.io/npm:picocolors@1.0.0/picocolors.js': 'sha384-pico',
  };
  // Only picocolors is still imported by non-elided code; dayjs's only
  // importer was elided, so the scan does not surface it.
  const reachable = new Set(['picocolors']);
  const out = prunePinToReachable(imports, integrity, reachable);
  assert.deepEqual(Object.keys(out.imports), ['picocolors'], 'dayjs pruned');
  assert.deepEqual(Object.keys(out.integrity),
    ['https://ga.jspm.io/npm:picocolors@1.0.0/picocolors.js'],
    'dropped URL also pruned from integrity');
});

test('keeps a base pin entry when only a subpath is imported, and vice versa', () => {
  const imports = {
    dayjs: 'https://cdn/dayjs.js',
    '@scope/pkg': 'https://cdn/scope-pkg.js',
  };
  // Code imports a subpath of dayjs and the base of @scope/pkg.
  const reachable = new Set(['dayjs/plugin/utc', '@scope/pkg']);
  const out = prunePinToReachable(imports, {}, reachable);
  assert.deepEqual(Object.keys(out.imports).sort(), ['@scope/pkg', 'dayjs'],
    'base entry kept when a subpath is reachable; scoped base kept');
});

test('keeps a pinned subpath entry when its base package is reachable', () => {
  const imports = { 'dayjs/plugin/utc': 'https://cdn/dayjs-utc.js' };
  const reachable = new Set(['dayjs']); // code imports the base
  const out = prunePinToReachable(imports, {}, reachable);
  assert.deepEqual(Object.keys(out.imports), ['dayjs/plugin/utc']);
});

test('empty reachable set prunes everything', () => {
  const out = prunePinToReachable({ dayjs: 'https://cdn/d.js' }, {}, new Set());
  assert.deepEqual(out.imports, {});
});

test('all-reachable is a no-op (unpinned-equivalent apps unchanged)', () => {
  const imports = { a: 'https://cdn/a.js', b: 'https://cdn/b.js' };
  const out = prunePinToReachable(imports, {}, new Set(['a', 'b']));
  assert.deepEqual(out.imports, imports);
});
