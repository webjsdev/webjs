/**
 * The shipped-module assembly shared by the SSR boot and the 103 Early Hints
 * (#1644): one function, memoized per route object and build epoch, with the
 * lazy frontier diverted to the lazy loader on BOTH consumers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shippedBootModules, hintedBootModules, assembleBootModules } from '../../src/ssr/shipped-modules.js';
import { bumpBuildEpoch } from '../../src/build-epoch.js';

const appDir = '/srv/app';
const page = `${appDir}/app/page.ts`;
const layout = `${appDir}/app/layout.ts`;
const hot = `${appDir}/components/hot-button.ts`;
const lazy = `${appDir}/components/lazy-panel.ts`;
const route = () => ({ file: page, layouts: [layout] });

test('drops inert modules and splices an import-only module into its component frontier', () => {
  const r = route();
  const out = shippedBootModules(r, {
    appDir,
    inert: new Set([layout]),
    importOnly: new Map([[page, [hot, hot]]]),
    lazyFiles: undefined,
    instrumentationClient: undefined,
  });
  assert.deepEqual(out.moduleUrls, ['/components/hot-button.ts'], 'layout dropped, page replaced by its frontier, deduped');
  assert.deepEqual(out.frontierLazy, {});
});

test('a lazy frontier component lands in frontierLazy, not moduleUrls, and is not hinted', () => {
  const r = route();
  const deps = {
    appDir,
    inert: new Set([layout]),
    importOnly: new Map([[page, [hot, lazy]]]),
    lazyFiles: new Map([[lazy, ['lazy-panel']]]),
    instrumentationClient: undefined,
  };
  const out = shippedBootModules(r, deps);
  assert.deepEqual(out.moduleUrls, ['/components/hot-button.ts']);
  assert.deepEqual(out.frontierLazy, { 'lazy-panel': '/components/lazy-panel.ts' });
  // The hint list is derived from the SAME assembly (asset hashing is a no-op
  // when disabled, as in dev, so the urls come back bare).
  assert.deepEqual(hintedBootModules(r, deps, ''), ['/components/hot-button.ts'], 'the lazy module is never early-hinted');
  assert.deepEqual(hintedBootModules(r, deps, '/m'), ['/m/components/hot-button.ts'], 'a base path prefixes the hint');
});

test('instrumentation-client is imported first, once', () => {
  const r = route();
  const ic = `${appDir}/instrumentation-client.ts`;
  const out = shippedBootModules(r, { appDir, inert: undefined, importOnly: undefined, lazyFiles: undefined, instrumentationClient: ic });
  assert.deepEqual(out.moduleUrls, ['/instrumentation-client.ts', '/app/page.ts', '/app/layout.ts']);
});

test('memoized per route object within a build; a bump or a different route recomputes', () => {
  const r = route();
  const deps = { appDir, inert: undefined, importOnly: undefined, lazyFiles: undefined, instrumentationClient: undefined };
  const a = shippedBootModules(r, deps);
  assert.equal(shippedBootModules(r, deps), a, 'same object within a build');
  assert.equal(hintedBootModules(r, deps, ''), hintedBootModules(r, deps, ''), 'the hint list is memoized too');
  bumpBuildEpoch();
  const b = shippedBootModules(r, deps);
  assert.notEqual(b, a, 'a new build recomputes');
  assert.deepEqual(b, a, 'with the same inputs, the same answer');
  assert.notEqual(shippedBootModules(route(), deps), b, 'a different route object is a different entry');
});

test('assembleBootModules is the un-memoized loop the boundary render shares (#1645 review)', () => {
  const ic = `${appDir}/instrumentation-client.ts`;
  const boundary = `${appDir}/app/error.ts`;
  const deps = { appDir, inert: new Set([layout]), importOnly: new Map([[page, [hot]]]), lazyFiles: new Map([[lazy, ['lazy-panel']]]), instrumentationClient: ic };
  const a = assembleBootModules([boundary, layout], deps);
  assert.deepEqual(a.moduleUrls, ['/instrumentation-client.ts', '/app/error.ts'], 'a boundary is pushed as is, the inert layout dropped, instrumentation first');
  assert.notEqual(assembleBootModules([boundary, layout], deps), a, 'never memoized: a boundary list is built per render');
  // The memoized form is the same loop over the route's own file list.
  const r = route();
  assert.deepEqual(shippedBootModules(r, deps), assembleBootModules([r.file, ...r.layouts], deps));
});
