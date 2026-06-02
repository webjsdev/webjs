/**
 * #179: the elision analyser must not read tags / observation calls written
 * inside comments (or strings) as real signals. A doc comment mentioning
 * `<some-tag>` or `whenDefined('some-tag')` used to force that component to
 * ship (the build-stamp regression found while adding the #169 probe). The
 * scanners now mask comments first (`maskComments`), keeping string and
 * template content so real signals still register.
 *
 * Each case is paired with its counterfactual: the SAME signal written as real
 * code DOES flip the verdict, proving the comment-masking is what changed it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision, extractRenderedTags } from '../../src/component-elision.js';

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

test('extractRenderedTags ignores tags in comments, keeps tags in templates', () => {
  const src = `
    // this comment renders <ghost-tag> but it is just prose
    /* and a block one with <block-ghost> too */
    class X { render() { return html\`<real-tag></real-tag>\`; } }
  `;
  const tags = extractRenderedTags(src);
  assert.ok(tags.has('real-tag'), 'a tag inside an html template is found');
  assert.ok(!tags.has('ghost-tag'), 'a tag inside a line comment is ignored');
  assert.ok(!tags.has('block-ghost'), 'a tag inside a block comment is ignored');
});

test('a commented whenDefined does NOT force the observed component to ship', async () => {
  // The observer only MENTIONS whenDefined('x-badge') in a comment.
  const observer = `
    // historical note: we used to call whenDefined('x-badge') here
    export const x = 1;
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    import './lib/obs.js';
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': BADGE, '/app/lib/obs.js': observer },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/obs.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'),
    'a whenDefined that is only in a comment does not force the badge to ship');
});

test('counterfactual: a REAL whenDefined does force it to ship', async () => {
  const observer = `
    customElements.whenDefined('x-badge').then(() => {});
    export const x = 1;
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    import './lib/obs.js';
    export default () => html\`<x-badge></x-badge>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': BADGE, '/app/lib/obs.js': observer },
    components: COMPONENTS,
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/lib/obs.js'] },
  });
  assert.ok(!elidableComponents.has('/app/components/badge.js'),
    'a real whenDefined forces the badge to ship (proves the comment case is what flips it)');
});

test('a commented @event or browser global does NOT force a component to ship', async () => {
  // Display-only render, but its comments mention @click and document. Neither
  // is real client work, so the component stays elidable.
  const commented = `
    import { WebComponent, html } from '@webjsdev/core';
    class Note extends WebComponent {
      // interactive sibling uses @click=\${handler} and reads document.title
      render() { return html\`<span class="note">read only</span>\`; }
    }
    Note.register('x-note');
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/note.js';
    export default () => html\`<x-note></x-note>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/note.js': commented },
    components: [{ tag: 'x-note', className: 'Note', file: '/app/components/note.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/note.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/note.js'),
    'a @click / document mentioned only in a comment does not force ship');
});

test('counterfactual: a REAL @click in the template forces ship', async () => {
  const interactive = `
    import { WebComponent, html } from '@webjsdev/core';
    class Note extends WebComponent {
      render() { return html\`<button @click=\${() => {}}>x</button>\`; }
    }
    Note.register('x-note');
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/note.js';
    export default () => html\`<x-note></x-note>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/note.js': interactive },
    components: [{ tag: 'x-note', className: 'Note', file: '/app/components/note.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/note.js'] },
  });
  assert.ok(!elidableComponents.has('/app/components/note.js'),
    'a real @click forces ship (proves the comment case is what flips it)');
});

test('a commented child tag does NOT force ship via the render rule', async () => {
  // An interactive (shipping) component whose render does NOT emit x-badge, but
  // whose comment mentions <x-badge>. The render rule must not be fooled.
  const widget = `
    import { WebComponent, html } from '@webjsdev/core';
    class Widget extends WebComponent {
      // layout note: sits next to <x-badge> on the page
      render() { return html\`<button @click=\${() => {}}>go</button>\`; }
    }
    Widget.register('x-widget');
  `;
  const page = `
    import { html } from '@webjsdev/core';
    import './components/badge.js';
    import './components/widget.js';
    export default () => html\`<x-widget></x-widget><x-badge></x-badge>\`;
  `;
  const { elidableComponents } = await run({
    files: { '/app/page.js': page, '/app/components/badge.js': BADGE, '/app/components/widget.js': widget },
    components: [...COMPONENTS, { tag: 'x-widget', className: 'Widget', file: '/app/components/widget.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/badge.js', '/app/components/widget.js'] },
  });
  assert.ok(elidableComponents.has('/app/components/badge.js'),
    'a child tag mentioned only in a comment does not force it to ship');
});
