/**
 * Unit tests for what the boot imports in a route module's place (#1686): a
 * page, layout or boundary never ships, so the boot imports its component
 * FRONTIER (`route-frontier.js`). Every component ships, as in Lit. A route
 * that renders no component ships zero JS, and client work written in a route
 * module itself (a router import, a signal, a browser global, a side-effect
 * import) never reaches the browser, because the module never loads there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { routeFrontiers } from '../../src/route-frontier.js';

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

/** The analysis the dev server runs: each route module's frontier. */
async function run({ components = [], routeModules, edges = {} }) {
  const graph = graphOf(edges);
  const frontiers = routeFrontiers(routeModules, graph, new Set(components.map((c) => c.file)), new Set(routeModules));
  return { frontiers };
}

test('a page with no component import boots nothing', async () => {
  const { frontiers } = await run({
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/lib/format.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), [], 'a page that renders no component ships zero JS');
});

test('a display-only component the page imports ships, as in Lit', async () => {
  const { frontiers } = await run({
    components: [{ tag: 'x-badge', file: '/app/components/badge.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), ['/app/components/badge.js']);
});

test('a page importing an interactive component boots exactly that component', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const { frontiers } = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), ['/app/components/counter.js']);
});

test('a page importing an interactive component but NOT rendering its tag still boots it (static, #605)', async () => {
  // The frontier is the STATIC import closure, not the rendered set, so a
  // component revealed only by a later client interaction still registers.
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    export default () => html\`<p>no tag rendered here</p>\`;
  `;
  const { frontiers } = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), ['/app/components/counter.js']);
});

test('a statically-imported lazy component stays in the frontier, even when not rendered (#605)', async () => {
  // EXCLUDING it would under-ship, since the class would never be defined when
  // its tag is revealed by a later client interaction. What the boot does with
  // it is the render's call (#1524): it registers a lazy frontier component
  // with the lazy loader instead of importing it (see lazy-static-import.test.js).
  const lazy = `
    import { WebComponent, html } from '@webjsdev/core';
    class Heavy extends WebComponent {
      static lazy = true;
      render() { return html\`<button @click=\${() => {}}>+</button>\`; }
    }
    Heavy.register('x-heavy');
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/heavy.js';
    export default () => html\`<p>revealed later, not rendered now</p>\`;
  `;
  const { frontiers } = await run({
    files: { '/app/page.js': page, '/app/components/heavy.js': lazy },
    components: [{ tag: 'x-heavy', file: '/app/components/heavy.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/heavy.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), ['/app/components/heavy.js'],
    'the statically-imported lazy component stays in the frontier so it still registers');
});

test('a .server dep of a page contributes nothing to its frontier', async () => {
  // The page calls a server query during SSR; on the client the .server
  // import is a stub, so nothing behind it ever loads.
  const page = `
    import { html } from '@webjsdev/core';
    import { listPosts } from './posts.server.js';
    export default async () => html\`<p>\${(await listPosts()).length}</p>\`;
  `;
  const server = `import './components/counter.js';\nexport async function listPosts() { return []; }`;
  const { frontiers } = await run({
    files: { '/app/page.js': page, '/app/posts.server.js': server, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/posts.server.js'], '/app/posts.server.js': ['/app/components/counter.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), [], 'nothing behind the server stub is booted');
});

// Each of these pinned the WHOLE page to the browser before #1686, and a page
// wrongly judged to ship had its server import refused. A route module never
// loads in the browser now, so none of this code runs there and none of it
// adds to the boot. `webjs status` and `webjs doctor` surface the patterns
// that look meant for the browser as hints (`routeModuleBrowserHints`).
const ROUTE_CLIENT_WORK = {
  'the client router': `import { html } from '@webjsdev/core';\nimport '@webjsdev/core/client-router';\nexport default () => html\`<p>hi</p>\`;`,
  'the router via a namespace import': `import * as core from '@webjsdev/core';\nexport default () => { core.navigate('/x'); return core.html\`<p>hi</p>\`; };`,
  'a reactive primitive': `import { html, signal } from '@webjsdev/core';\nconst n = signal(0);\nexport default () => html\`<p>\${n.get()}</p>\`;`,
  'a side-effect npm import': `import { html } from '@webjsdev/core';\nimport 'analytics-lib';\nexport default () => html\`<p>hi</p>\`;`,
  'an npm binding used in the body': `import { html } from '@webjsdev/core';\nimport dayjs from 'dayjs';\nexport default () => html\`<p>\${dayjs().toString()}</p>\`;`,
  'a client global': `import { html } from '@webjsdev/core';\nif (typeof window !== 'undefined') window.__x = 1;\nexport default () => html\`<p>hi</p>\`;`,
  'a top-level dynamic import()': `import { html } from '@webjsdev/core';\nimport('./track.js');\nexport default () => html\`<p>hi</p>\`;`,
  'a module-scope fetch()': `import { html } from '@webjsdev/core';\nfetch('/track');\nexport default () => html\`<p>hi</p>\`;`,
  'a module-scope new WebSocket()': `import { html } from '@webjsdev/core';\nnew WebSocket('/ws');\nexport default () => html\`<p>hi</p>\`;`,
};

for (const [what, page] of Object.entries(ROUTE_CLIENT_WORK)) {
  test(`a page with ${what} boots only its components (#1686)`, async () => {
    const { frontiers } = await run({
      files: { '/app/page.js': page + `\nimport './components/counter.js';`, '/app/components/counter.js': INTERACTIVE },
      components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
      routeModules: ['/app/page.js'],
      edges: { '/app/page.js': ['/app/components/counter.js'] },
    });
    assert.deepEqual(frontiers.get('/app/page.js'), ['/app/components/counter.js']);
  });
}

test('a layout importing the client router and a static page under it both boot nothing of their own', async () => {
  const layout = `
    import { html } from '@webjsdev/core';
    import '@webjsdev/core/client-router';
    export default ({ children }) => html\`<main>\${children}</main>\`;
  `;
  const page = `
    import { html } from '@webjsdev/core';
    export default () => html\`<h1>About</h1>\`;
  `;
  const { frontiers } = await run({
    files: { '/app/layout.js': layout, '/app/about/page.js': page },
    routeModules: ['/app/layout.js', '/app/about/page.js'],
  });
  assert.deepEqual(frontiers.get('/app/layout.js'), []);
  assert.deepEqual(frontiers.get('/app/about/page.js'), []);
});

test('a page importing a component AND a self-executing helper boots only the component', async () => {
  // The helper's side effect ran in the browser before #1686, because the page
  // shipped whole. Now it runs on the server only (a hint, not a refusal), and
  // the boot carries the component alone.
  const page = `
    import { html } from '@webjsdev/core';
    import './components/counter.js';
    import './analytics.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const { frontiers } = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE, '/app/analytics.js': 'window.analyticsBoot();' },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js', '/app/analytics.js'] },
  });
  assert.deepEqual(frontiers.get('/app/page.js'), ['/app/components/counter.js']);
});
