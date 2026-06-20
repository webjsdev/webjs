/**
 * Unit tests for the elision advisory verdict (#646): analyzeElision returns
 * `shippedRouteModules`, a Map from each page/layout that SHIPS WHOLE to the
 * first client-effecting blocker that pins it (or its own signal). This is what
 * `webjs doctor` reads to name WHY a page/layout is not elided.
 *
 * A pure carrier (inert #179 / import-only #605) is silent here; only a module
 * that genuinely ships appears, with a named blocker.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision } from '../../src/component-elision.js';

const DISPLAY_ONLY = `
import { WebComponent, html } from '@webjsdev/core';
class Badge extends WebComponent {
  render() { return html\`<span>verified</span>\`; }
}
Badge.register('x-badge');
`;

const INTERACTIVE = `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>+</button>\`; }
}
Counter.register('x-counter');
`;

// A client-effecting NON-component: touches a browser global at module load.
const CLIENT_GLOBAL_UTIL = `
document.title = 'set at module load';
export const x = 1;
`;

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}
function run({ files, components = [], routeModules, edges = {} }) {
  return analyzeElision(components, routeModules, graphOf(edges), async (f) => files[f], '/app');
}

test('an inert page is NOT reported as shipping', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { inertRouteModules, shippedRouteModules } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': DISPLAY_ONLY },
    components: [{ tag: 'x-badge', file: '/app/components/badge.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js'] },
  });
  assert.ok(inertRouteModules.has('/app/page.js'), 'page is inert');
  assert.ok(!shippedRouteModules.has('/app/page.js'), 'an inert carrier is silent in the advisory');
});

test('an import-only page is NOT reported as shipping', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const { importOnlyRouteModules, shippedRouteModules } = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.ok(importOnlyRouteModules.has('/app/page.js'), 'page is import-only');
  assert.ok(!shippedRouteModules.has('/app/page.js'), 'an import-only carrier is silent in the advisory');
});

test('a page pinned by a client-effecting non-component names that blocker', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    import './lib/track.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const { shippedRouteModules } = await run({
    files: {
      '/app/page.js': page,
      '/app/components/counter.js': INTERACTIVE,
      '/app/lib/track.js': CLIENT_GLOBAL_UTIL,
    },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js', '/app/lib/track.js'] },
  });
  const v = shippedRouteModules.get('/app/page.js');
  assert.ok(v, 'the page ships whole and is reported');
  // The blocker is the NON-component util, NOT the interactive component (which
  // alone would make the page import-only).
  assert.equal(v.blocker, '/app/lib/track.js', 'names the client-effecting non-component, not the component');
  assert.match(v.reason, /browser global|side-effect import/);
});

test('a page that does its OWN client work reports a null blocker + its own reason', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import '@webjsdev/core/client-router';
    export default () => html\`<p>hi</p>\`;
  `;
  const { shippedRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': [] },
  });
  const v = shippedRouteModules.get('/app/page.js');
  assert.ok(v, 'the page ships whole');
  assert.equal(v.blocker, null, 'the module itself is the cause, so there is no separate blocker file');
  assert.match(v.reason, /client router/);
});

test('counterfactual: drop the client-effecting util and the page stops shipping', async () => {
  // Same as the pinned case but WITHOUT the util import: now the only client
  // work is the component, so the page is import-only, not shipping.
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const { shippedRouteModules, importOnlyRouteModules } = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.ok(!shippedRouteModules.has('/app/page.js'), 'without the util, the page no longer ships');
  assert.ok(importOnlyRouteModules.has('/app/page.js'), 'it is import-only instead');
});
