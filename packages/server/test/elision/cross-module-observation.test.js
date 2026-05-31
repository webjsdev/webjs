/**
 * #169: a display-only component that some OTHER module observes via its
 * registration must NOT be elided. Eliding it drops its
 * `customElements.define`, after which the observation silently fails
 * (`whenDefined` never resolves, a CSS `tag:defined` rule never matches, an
 * `instanceof` is always false). The analyser detects the three statically
 * visible observation forms and forces the observed component to ship.
 *
 * The bias stays conservative: detection only ever forces MORE components to
 * ship, never fewer. Each positive case is paired against the baseline (the
 * same display-only component with NO observer IS elided), which is the
 * counterfactual proving the observation is what flips the verdict.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision } from '../../src/component-elision.js';

// A purely display-only component: no event, no reactive prop, no lifecycle
// hook, no signal. Elidable on its own.
const BADGE = `
import { WebComponent, html } from '@webjsdev/core';
class Badge extends WebComponent {
  render() { return html\`<span class="badge">verified</span>\`; }
}
Badge.register('x-badge');
`;

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}

async function run({ files, components = [], routeModules = [], edges = {} }) {
  return analyzeElision(components, routeModules, graphOf(edges), async (f) => files[f], '/app');
}

const COMPONENTS = [{ tag: 'x-badge', className: 'Badge', file: '/app/components/badge.js' }];

test('baseline: a display-only component with no observer IS elided', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': BADGE },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'), 'display-only badge elides without an observer');
});

// Each observer is reachable from a page (so it ships) and the page also
// renders the badge. Edges put the observer in the analysed file set, exactly
// as the real module graph would.
const pageImporting = (obs) => `
  import { html } from '@webjsdev/core';
  import './components/badge.js';
  import './lib/${obs}';
  export default () => html\`<x-badge></x-badge>\`;
`;

test('whenDefined(tag) on an observed component forces it to ship', async () => {
  const observer = `
    customElements.whenDefined('x-badge').then(() => {});
    export const x = 1;
  `;
  const { elidableComponents } = await run({
    files: {
      '/app/page.js': pageImporting('obs.js'),
      '/app/components/badge.js': BADGE,
      '/app/lib/obs.js': observer,
    },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/obs.js'] },
  });
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'whenDefined observer must force the badge to ship');
});

test('a CSS tag:defined rule forces the observed component to ship', async () => {
  const styles = `
    import { html } from '@webjsdev/core';
    export const sheet = html\`<style>x-badge:defined { opacity: 1; }</style>\`;
  `;
  const { elidableComponents } = await run({
    files: {
      '/app/page.js': pageImporting('styles.js'),
      '/app/components/badge.js': BADGE,
      '/app/lib/styles.js': styles,
    },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/styles.js'] },
  });
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'a tag:defined CSS rule must force the badge to ship');
});

test('instanceof Class forces the observed component to ship', async () => {
  const observer = `
    import { Badge } from '../components/badge.js';
    export function isBadge(el) { return el instanceof Badge; }
  `;
  const { elidableComponents } = await run({
    files: {
      '/app/page.js': pageImporting('check.js'),
      '/app/components/badge.js': BADGE,
      '/app/lib/check.js': observer,
    },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/check.js'] },
  });
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'an instanceof check must force the badge to ship');
});

test('an observation of an UNKNOWN tag does not affect unrelated components', async () => {
  const observer = `
    customElements.whenDefined('not-a-component').then(() => {});
    export const x = 1;
  `;
  const { elidableComponents } = await run({
    files: {
      '/app/page.js': pageImporting('obs.js'),
      '/app/components/badge.js': BADGE,
      '/app/lib/obs.js': observer,
    },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/obs.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'),
    'an observation of an unknown tag must not change the badge verdict');
});
