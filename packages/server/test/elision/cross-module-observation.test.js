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
 *
 * Only a module the browser can LOAD observes anything (#1686): one reachable
 * from a component or from an extra entry (`instrumentation-client`). A page
 * runs only on the server, so an observation in a page, or in a helper only a
 * page imports, forces nothing.
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

async function run({ files, components = [], edges = {}, entries }) {
  return analyzeElision(components, graphOf(edges), async (f) => files[f], '/app', { entries });
}

const COMPONENTS = [{ tag: 'x-badge', className: 'Badge', file: '/app/components/badge.js' }];
const WIDGET_FILE = '/app/components/widget.js';
const WITH_WIDGET = [...COMPONENTS, { tag: 'x-widget', className: 'Widget', file: WIDGET_FILE }];

test('baseline: a display-only component with no observer IS elided', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': BADGE },
    components: COMPONENTS,
    edges: { '/app/page.js': ['/app/components/badge.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'), 'display-only badge elides without an observer');
});

// Each observer is imported by a SHIPPING component (an interactive widget),
// so the browser loads it, and the page renders both. Edges put the observer
// in the analysed file set, exactly as the real module graph would.
const widgetImporting = (obs) => `
  import { WebComponent, html } from '@webjsdev/core';
  import '../lib/${obs}';
  class Widget extends WebComponent {
    render() { return html\`<button @click=\${() => {}}>go</button>\`; }
  }
  Widget.register('x-widget');
`;
const PAGE = `
  import { html } from '@webjsdev/core';
  import './components/badge.js';
  import './components/widget.js';
  export default () => html\`<x-widget></x-widget><x-badge></x-badge>\`;
`;
const observedBy = (obsFile, src) => run({
  files: {
    '/app/page.js': PAGE,
    '/app/components/badge.js': BADGE,
    [WIDGET_FILE]: widgetImporting(obsFile.split('/').pop()),
    [obsFile]: src,
  },
  components: WITH_WIDGET,
  edges: {
    '/app/page.js': ['/app/components/badge.js', WIDGET_FILE],
    [WIDGET_FILE]: [obsFile],
  },
});

test('whenDefined(tag) on an observed component forces it to ship', async () => {
  const observer = `
    customElements.whenDefined('x-badge').then(() => {});
    export const x = 1;
  `;
  const { elidableComponents } = await observedBy('/app/lib/obs.js', observer);
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'whenDefined observer must force the badge to ship');
});

test('a CSS tag:defined rule forces the observed component to ship', async () => {
  const styles = `
    import { html } from '@webjsdev/core';
    export const sheet = html\`<style>x-badge:defined { opacity: 1; }</style>\`;
  `;
  const { elidableComponents } = await observedBy('/app/lib/styles.js', styles);
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'a tag:defined CSS rule must force the badge to ship');
});

test('instanceof Class forces the observed component to ship', async () => {
  const observer = `
    import { Badge } from '../components/badge.js';
    export function isBadge(el) { return el instanceof Badge; }
  `;
  const { elidableComponents } = await observedBy('/app/lib/check.js', observer);
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'an instanceof check must force the badge to ship');
});

test('an observation of an UNKNOWN tag does not affect unrelated components', async () => {
  const observer = `
    customElements.whenDefined('not-a-component').then(() => {});
    export const x = 1;
  `;
  const { elidableComponents } = await observedBy('/app/lib/obs.js', observer);
  assert.ok(elidableComponents.has('/app/components/badge.js'),
    'an observation of an unknown tag must not change the badge verdict');
});

test('an observation in a PAGE, or in a helper only a page imports, forces nothing (#1686)', async () => {
  // A page runs only on the server, so nothing it observes needs the tag
  // registered in a browser. Before #1686 both forms forced the badge to ship.
  const observer = `
    customElements.whenDefined('x-badge').then(() => {});
    export const x = 1;
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    import './lib/obs.js';
    void customElements.whenDefined('x-badge');
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': BADGE, '/app/lib/obs.js': observer },
    components: COMPONENTS,
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/obs.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'),
    'a server-only observer must not force the badge to ship');
});

test('an observation in an extra entry (instrumentation-client) forces the component to ship', async () => {
  const ic = `
    customElements.whenDefined('x-badge').then(() => {});
  `;
  const files = { '/app/instrumentation-client.js': ic, '/app/components/badge.js': BADGE };
  const edges = { '/app/instrumentation-client.js': [] };
  const without = await run({ files, components: COMPONENTS, edges });
  assert.ok(without.elidableComponents.has('/app/components/badge.js'),
    'precondition: not passed as an entry, the module is not browser-reachable');
  const withEntry = await run({ files, components: COMPONENTS, edges, entries: ['/app/instrumentation-client.js'] });
  assert.ok(!withEntry.elidableComponents.has('/app/components/badge.js'),
    'an entry the browser loads observes the badge, so it ships');
});
