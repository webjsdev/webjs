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

test('a page importing a non-core npm package is NOT inert (it may self-execute)', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import dayjs from 'dayjs';
    export default () => html\`<p>\${dayjs().toString()}</p>\`;
  `;
  const { inertRouteModules } = await run({
    files: { '/app/page.js': page },
    routeModules: ['/app/page.js'],
  });
  assert.ok(!inertRouteModules.has('/app/page.js'), 'a top-level npm import keeps the page shipping');
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
