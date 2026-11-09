/**
 * The shipped-module assembly shared by the SSR boot and the 103 Early Hints
 * (#1644): one function, memoized per route object and build epoch, with the
 * lazy frontier diverted to the lazy loader on BOTH consumers. Route modules
 * never ship (#1686): only their component frontiers do.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shippedBootModules, hintedBootModules, assembleBootModules, earlyHintLinks } from '../../src/ssr/shipped-modules.js';
import { bumpBuildEpoch } from '../../src/build-epoch.js';

const appDir = '/srv/app';
const page = `${appDir}/app/page.ts`;
const layout = `${appDir}/app/layout.ts`;
const hot = `${appDir}/components/hot-button.ts`;
const lazy = `${appDir}/components/lazy-panel.ts`;
const route = () => ({ file: page, layouts: [layout] });

test('each route module is replaced by its component frontier, never shipped itself (#1686)', () => {
  const r = route();
  const out = shippedBootModules(r, {
    appDir,
    frontiers: new Map([[layout, []], [page, [hot, hot]]]),
    lazyFiles: undefined,
    instrumentationClient: undefined,
  });
  assert.deepEqual(out.moduleUrls, ['/components/hot-button.ts'], 'no route module, the page frontier deduped');
  assert.deepEqual(out.frontierLazy, {});
});

test('a route module with no frontier entry emits nothing, never itself', () => {
  // The pre-warm window: no frontier has been computed yet.
  const out = shippedBootModules(route(), { appDir, frontiers: undefined, lazyFiles: undefined, instrumentationClient: undefined });
  assert.deepEqual(out.moduleUrls, []);
});

test('a lazy frontier component lands in frontierLazy, not moduleUrls, and is not hinted', () => {
  const r = route();
  const deps = {
    appDir,
    frontiers: new Map([[page, [hot, lazy]]]),
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
  const out = shippedBootModules(r, { appDir, frontiers: new Map([[page, [hot]]]), lazyFiles: undefined, instrumentationClient: ic });
  assert.deepEqual(out.moduleUrls, ['/instrumentation-client.ts', '/components/hot-button.ts']);
});

test('the boot imports in nesting order: outer layout frontier first, then loading, then the page', () => {
  // A context provider rendered by a layout must be defined before a consumer
  // the page renders, or the consumer's one-shot context-request on upgrade
  // goes unanswered (found by an agent building an app). Nesting order gives
  // every ancestor's elements first. A loading template renders before the
  // page streams in, so its components register too.
  const nested = `${appDir}/app/recipes/layout.ts`;
  const loading = `${appDir}/app/recipes/loading.ts`;
  const pageFile = `${appDir}/app/recipes/[id]/page.ts`;
  const c = (n) => `${appDir}/components/${n}.ts`;
  const r = { file: pageFile, layouts: [layout, nested], loadings: [loading] };
  const frontiers = new Map([
    [layout, [c('provider')]], [nested, [c('tabs')]], [loading, [c('spinner')]], [pageFile, [c('consumer')]],
  ]);
  const out = shippedBootModules(r, { appDir, frontiers, lazyFiles: undefined, instrumentationClient: undefined });
  assert.deepEqual(out.moduleUrls,
    ['/components/provider.ts', '/components/tabs.ts', '/components/spinner.ts', '/components/consumer.ts']);
});

test('memoized per route object within a build; a bump or a different route recomputes', () => {
  const r = route();
  const deps = { appDir, frontiers: new Map([[page, [hot]]]), lazyFiles: undefined, instrumentationClient: undefined };
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
  const retry = `${appDir}/components/retry-button.ts`;
  const deps = {
    appDir,
    frontiers: new Map([[layout, [hot]], [boundary, [retry]], [page, [lazy]]]),
    lazyFiles: undefined,
    instrumentationClient: ic,
  };
  const a = assembleBootModules([layout, boundary], deps);
  assert.deepEqual(a.moduleUrls, ['/instrumentation-client.ts', '/components/hot-button.ts', '/components/retry-button.ts'],
    'the layout and boundary frontiers, never the boundary module, instrumentation first');
  assert.notEqual(assembleBootModules([layout, boundary], deps), a, 'never memoized: a boundary list is built per render');
  // The memoized form is the same loop over the route's own file list.
  const r = route();
  assert.deepEqual(shippedBootModules(r, deps), assembleBootModules([...r.layouts, r.file], deps));
});

// A 103 hint that starts module loading (a modulepreload) runs before the
// page's import map is parsed, and Firefox then refuses the map, so no bare
// import resolves and no script runs (the Firefox Early Hints bug).
const startsModuleLoading = (link) => /;\s*rel=["']?modulepreload/i.test(link);

test('the 103 Early Hints are CORS script preloads, never modulepreload', () => {
  const links = earlyHintLinks(['/components/hot-button.ts?v=abc', '/app/page.ts']);
  assert.deepEqual(links, [
    '</components/hot-button.ts?v=abc>; rel=preload; as=script; crossorigin=anonymous',
    '</app/page.ts>; rel=preload; as=script; crossorigin=anonymous',
  ]);
  assert.equal(links.filter(startsModuleLoading).length, 0);
  // The counterfactual: the form the listener used to send is what the
  // predicate catches.
  assert.ok(startsModuleLoading('</components/hot-button.ts>; rel=modulepreload'));
  assert.deepEqual(earlyHintLinks([]), [], 'nothing to hint, nothing sent');
});
