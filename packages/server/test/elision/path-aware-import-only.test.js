/**
 * Path-aware import-only classification (#963): a client-effecting
 * NON-component module (the module-scope-signal-in-its-own-file idiom of
 * invariant 5) that is reachable ONLY through a shipping component does not
 * block a page's import-only elision, because the emitted component carries
 * it. A component-free path to the same module still ships the page whole.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision } from '../../src/component-elision.js';

const SIGNAL_BUS = `
import { signal } from '@webjsdev/core';
export const labelState = signal({ labels: [], opacity: 0 });
`;

const INTERACTIVE_USING_BUS = `
import { WebComponent, html } from '@webjsdev/core';
import { labelState } from '../lib/bus.js';
class Overlay extends WebComponent {
  render() { return html\`<button @click=\${() => labelState.set({})}>x</button>\`; }
}
Overlay.register('x-overlay');
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

test('a signal module reached only THROUGH a shipping component is import-only (#963)', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/overlay.js';
    export default () => html\`<x-overlay></x-overlay>\`;
  `;
  const { importOnlyRouteModules, shippedRouteModules } = await run({
    files: {
      '/app/page.js': page,
      '/app/components/overlay.js': INTERACTIVE_USING_BUS,
      '/app/lib/bus.js': SIGNAL_BUS,
    },
    components: [{ tag: 'x-overlay', file: '/app/components/overlay.js' }],
    routeModules: ['/app/page.js'],
    edges: {
      '/app/page.js': ['/app/components/overlay.js'],
      '/app/components/overlay.js': ['/app/lib/bus.js'],
    },
  });
  assert.ok(!shippedRouteModules.has('/app/page.js'), 'page must not ship whole');
  assert.deepEqual(
    importOnlyRouteModules.get('/app/page.js'),
    ['/app/components/overlay.js'],
    'page is import-only, emitting the component that carries the bus',
  );
});

test('counterfactual: the SAME signal module imported DIRECTLY by the page ships whole', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/overlay.js';
    import { labelState } from './lib/bus.js';
    export default () => html\`<x-overlay></x-overlay>\`;
  `;
  const { importOnlyRouteModules, shippedRouteModules } = await run({
    files: {
      '/app/page.js': page,
      '/app/components/overlay.js': INTERACTIVE_USING_BUS,
      '/app/lib/bus.js': SIGNAL_BUS,
    },
    components: [{ tag: 'x-overlay', file: '/app/components/overlay.js' }],
    routeModules: ['/app/page.js'],
    edges: {
      '/app/page.js': ['/app/components/overlay.js', '/app/lib/bus.js'],
      '/app/components/overlay.js': ['/app/lib/bus.js'],
    },
  });
  assert.ok(!importOnlyRouteModules.has('/app/page.js'), 'not import-only');
  assert.equal(
    shippedRouteModules.get('/app/page.js')?.blocker,
    '/app/lib/bus.js',
    'the direct component-free path to the bus is the blocker',
  );
});

test('a component-free path through a plain helper to the signal module also ships whole', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/overlay.js';
    import { fmt } from './lib/helper.js';
    export default () => html\`<x-overlay>\${fmt(1)}</x-overlay>\`;
  `;
  const helper = `
    import { labelState } from './bus.js';
    export const fmt = (n) => String(n) + labelState.get().opacity;
  `;
  const { importOnlyRouteModules, shippedRouteModules } = await run({
    files: {
      '/app/page.js': page,
      '/app/components/overlay.js': INTERACTIVE_USING_BUS,
      '/app/lib/helper.js': helper,
      '/app/lib/bus.js': SIGNAL_BUS,
    },
    components: [{ tag: 'x-overlay', file: '/app/components/overlay.js' }],
    routeModules: ['/app/page.js'],
    edges: {
      '/app/page.js': ['/app/components/overlay.js', '/app/lib/helper.js'],
      '/app/lib/helper.js': ['/app/lib/bus.js'],
      '/app/components/overlay.js': ['/app/lib/bus.js'],
    },
  });
  assert.ok(!importOnlyRouteModules.has('/app/page.js'), 'not import-only');
  assert.ok(shippedRouteModules.has('/app/page.js'), 'page ships whole');
});

test('a component nested BEHIND another shipping component is not re-emitted (carried by its importer)', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/outer.js';
    export default () => html\`<x-outer></x-outer>\`;
  `;
  const outer = `
    import { WebComponent, html } from '@webjsdev/core';
    import './counter.js';
    class Outer extends WebComponent {
      render() { return html\`<button @click=\${() => {}}><x-counter></x-counter></button>\`; }
    }
    Outer.register('x-outer');
  `;
  const { importOnlyRouteModules } = await run({
    files: {
      '/app/page.js': page,
      '/app/components/outer.js': outer,
      '/app/components/counter.js': INTERACTIVE,
    },
    components: [
      { tag: 'x-outer', file: '/app/components/outer.js' },
      { tag: 'x-counter', file: '/app/components/counter.js' },
    ],
    routeModules: ['/app/page.js'],
    edges: {
      '/app/page.js': ['/app/components/outer.js'],
      '/app/components/outer.js': ['/app/components/counter.js'],
    },
  });
  assert.deepEqual(
    importOnlyRouteModules.get('/app/page.js'),
    ['/app/components/outer.js'],
    'only the frontier component is emitted; the nested one loads via its import',
  );
});
