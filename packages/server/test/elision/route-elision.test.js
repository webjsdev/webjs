/**
 * Unit tests for inert page/layout route-module elision: a page or layout
 * that does no client work (even transitively) is dropped from the boot
 * script. Conservative: anything reaching the client router, a signal, an
 * event, a non-core npm import, a client global, or a shipping component
 * keeps shipping. This is the progressive-enhancement completion of
 * component elision (a fully-static route ships zero JS).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision } from '../../src/component-elision.js';

const DISPLAY_ONLY = `
import { WebComponent, html } from '@webjsdev/core';
class Badge extends WebComponent {
  render() { return html\`<span class="badge">verified</span>\`; }
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

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}

async function run({ files, components = [], routeModules, edges = {} }) {
  return analyzeElision(components, routeModules, graphOf(edges), async (f) => files[f], '/app');
}

test('a static page importing only core + a display-only component is inert', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { elidableComponents, inertRouteModules } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': DISPLAY_ONLY },
    components: [{ tag: 'x-badge', file: '/app/components/badge.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'), 'badge elided');
  assert.ok(inertRouteModules.has('/app/page.js'), 'static page is inert');
});

test('a page rendering an interactive component is NOT inert', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.ok(!inertRouteModules.has('/app/page.js'), 'page importing a shipping component ships');
});

test('a page importing the client router is NOT inert', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import '@webjsdev/core/client-router';
    export default () => html\`<p>hi</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'));
});

test('a page reaching the router via a namespace import is NOT inert', async () => {
  const page = `
    import * as core from '@webjsdev/core';
    export default () => { core.navigate('/x'); return core.html\`<p>hi</p>\`; };
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'));
});

test('a page importing a reactive primitive is NOT inert', async () => {
  const page = `
    import { html, signal } from '@webjsdev/core';
    const n = signal(0);
    export default () => html\`<p>\${n.get()}</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'));
});

test('a page using an npm package ONLY in its (server-only) body IS inert (SSR-only dep not shipped)', async () => {
  // The page function never runs on the client, so dayjs() is never called
  // there. A binding import used only in the body rides away when the inert
  // page is dropped, so dayjs is not sent to the client.
  const page = `
    import { html } from '@webjsdev/core';
    import dayjs from 'dayjs';
    export default () => html\`<p>\${dayjs().toString()}</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(inertRouteModules.has('/app/page.js'), 'SSR-only npm binding does not force shipping');
});

test('a page with a SIDE-EFFECT npm import is NOT inert (it runs on load)', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import 'analytics-lib';
    export default () => html\`<p>hi</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'), 'a side-effect npm import keeps the page shipping');
});

test('a page touching a client global is NOT inert', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    if (typeof window !== 'undefined') window.__x = 1;
    export default () => html\`<p>hi</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'));
});

test('a layout enabling the router ships; a static page under it stays inert', async () => {
  const layout = `
    import { html } from '@webjsdev/core';
    import '@webjsdev/core/client-router';
    export default ({ children }) => html\`<main>\${children}</main>\`;
  `;
  const page = `
    import { html } from '@webjsdev/core';
    export default () => html\`<h1>About</h1>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/layout.js': layout, '/app/about/page.js': page },
    routeModules: ['/app/layout.js', '/app/about/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/layout.js'), 'router layout ships');
  assert.ok(inertRouteModules.has('/app/about/page.js'), 'static page under it is still inert');
});

test('an inert importer of a server-only util stays inert (server stub never loads)', async () => {
  // The page calls a server query during SSR; on the client the .server
  // import is a stub, so it contributes nothing.
  const page = `
    import { html } from '@webjsdev/core';
    import { listPosts } from './posts.server.js';
    export default async () => html\`<p>\${(await listPosts()).length}</p>\`;
  `;
  const server = `import dayjs from 'dayjs';\nexport async function listPosts() { return []; }`;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page, '/app/posts.server.js': server },
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/posts.server.js'] },
  });
  // dayjs is reached only through the .server stub, which never loads on
  // the client, so the page is still inert.
  assert.ok(inertRouteModules.has('/app/page.js'), 'a .server dep does not force the page to ship');
});

test('a page with a top-level dynamic import() is NOT inert', async () => {
  // The dynamically loaded module is real client work the static graph does
  // not follow; dropping the page would silently lose it.
  const page = `
    import { html } from '@webjsdev/core';
    import('./track.js');
    export default () => html\`<p>hi</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'), 'page with dynamic import must ship');
});

test('a page doing module-scope fetch() / new WebSocket() is NOT inert', async () => {
  for (const stmt of ["fetch('/track');", 'new WebSocket("/ws");']) {
    const page = `
      import { html } from '@webjsdev/core';
      ${stmt}
      export default () => html\`<p>hi</p>\`;
    `;
    const { inertRouteModules } = await run({
      files: { '/app/page.js': page },
      routeModules: ['/app/page.js'],
    });
    assert.ok(!inertRouteModules.has('/app/page.js'), stmt);
  }
});

test('client work reached only through a helper module keeps the route shipping', async () => {
  // The page itself is clean; a helper it imports does a dynamic import().
  const page = `
    import { html } from '@webjsdev/core';
    import { boot } from './helper.js';
    export default () => { boot(); return html\`<p>hi</p>\`; };
  `;
  const helper = `export function boot() {} import('./deferred.js');`;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page, '/app/helper.js': helper },
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/helper.js'] },
  });
  assert.ok(!inertRouteModules.has('/app/page.js'), 'route reaching a dynamic import via a helper must ship');
});
