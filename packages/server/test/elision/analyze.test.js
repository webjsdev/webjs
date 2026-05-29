/**
 * Unit tests for the component-elision analyser. Verifies the
 * interactivity denylist: display-only components are elidable, anything
 * carrying a client-side signal ships. The bias is conservative, so the
 * counterfactual cases (single @click, one signal import, one overridden
 * hook) are as important as the positive ones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeComponentSource,
  extractRenderedTags,
  computeElidableComponents,
} from '../../src/component-elision.js';

const DISPLAY_ONLY = `
import { WebComponent, html } from '@webjsdev/core';
class StudentCard extends WebComponent {
  static properties = { student: { type: Object, state: true } };
  constructor() { super(); this.student = { name: '' }; }
  render() { return html\`<p>\${this.student.name}</p>\`; }
}
StudentCard.register('student-card');
`;

test('display-only component is not interactive', () => {
  assert.equal(analyzeComponentSource(DISPLAY_ONLY).interactive, false);
});

test('component with no static properties at all is not interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class HelloWorld extends WebComponent {
      render() { return html\`<p>Hello</p>\`; }
    }
    HelloWorld.register('hello-world');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('@event binding forces interactive', () => {
  const src = DISPLAY_ONLY.replace(
    '<p>${this.student.name}</p>',
    '<button @click=${() => {}}>x</button>',
  );
  const r = analyzeComponentSource(src);
  assert.equal(r.interactive, true);
  assert.match(r.reason, /@event/);
});

test('a side-effect npm import forces interactive (runs on module load)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import 'some-polyfill';
    class P extends WebComponent { render() { return html\`<p>x</p>\`; } }
    P.register('poly-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a browser global at module scope forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    if (typeof window !== 'undefined') window.__init = 1;
    class G extends WebComponent { render() { return html\`<p>x</p>\`; } }
    G.register('glob-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a BINDING npm import used only in render stays display-only (elidable)', () => {
  // dayjs is only used in render(), which never runs on the client when the
  // component is elided, so it rides away with the module. Must NOT ship.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import dayjs from 'dayjs';
    class D extends WebComponent { render() { return html\`<time>\${dayjs().format()}</time>\`; } }
    D.register('date-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('registration via customElements.define is not mistaken for a client global', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class R extends WebComponent { render() { return html\`<p>x</p>\`; } }
    customElements.define('reg-el', R);
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('a rendered <slot> forces interactive (light-DOM projection runtime)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Card extends WebComponent {
      render() { return html\`<div class="card"><slot></slot></div>\`; }
    }
    Card.register('slot-card');
  `;
  const r = analyzeComponentSource(src);
  assert.equal(r.interactive, true);
  assert.match(r.reason, /slot/);
});

test('a custom tag named <slot-machine> is NOT mistaken for a slot', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Reels extends WebComponent {
      render() { return html\`<slot-machine></slot-machine>\`; }
    }
    Reels.register('reels-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('.onclick native event-handler property forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Btn extends WebComponent {
      render() { return html\`<button .onclick=\${() => {}}>x</button>\`; }
    }
    Btn.register('btn-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('signal import forces interactive', () => {
  const src = `
    import { WebComponent, html, signal } from '@webjsdev/core';
    const n = signal(0);
    class SignalThing extends WebComponent {
      render() { return html\`<p>\${n.get()}</p>\`; }
    }
    SignalThing.register('signal-thing');
  `;
  const r = analyzeComponentSource(src);
  assert.equal(r.interactive, true);
  assert.match(r.reason, /signal/);
});

test('Task import forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import { Task } from '@webjsdev/core/task';
    class Loader extends WebComponent {
      render() { return html\`<p>loading</p>\`; }
    }
    Loader.register('loader-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('namespace import using a reactive member forces interactive', () => {
  const src = `
    import * as core from '@webjsdev/core';
    const n = core.signal(0);
    class NsThing extends core.WebComponent {
      render() { return core.html\`<p>\${n.get()}</p>\`; }
    }
    core.register('ns-thing', NsThing);
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('namespace import using only non-reactive members stays display-only', () => {
  const src = `
    import * as core from '@webjsdev/core';
    class Pure extends WebComponent {
      render() { return core.html\`<p>pure</p>\`; }
    }
    Pure.register('pure-ns');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('each overridden lifecycle hook forces interactive', () => {
  for (const hook of ['connectedCallback', 'firstUpdated', 'updated', 'willUpdate']) {
    const src = DISPLAY_ONLY.replace(
      'render()',
      `${hook}() { /* side effect */ } render()`,
    );
    const r = analyzeComponentSource(src);
    assert.equal(r.interactive, true, `${hook} should ship`);
    assert.match(r.reason, new RegExp(hook));
  }
});

test('lifecycle hook written as an arrow class field forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Widget extends WebComponent {
      connectedCallback = () => { this.ready = true; };
      render() { return html\`<p>x</p>\`; }
    }
    Widget.register('widget-el');
  `;
  const r = analyzeComponentSource(src);
  assert.equal(r.interactive, true);
  assert.match(r.reason, /connectedCallback/);
});

test('ref / createRef directive import forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import { ref, createRef } from '@webjsdev/core/directives';
    class Focusable extends WebComponent {
      _r = createRef();
      render() { return html\`<input \${ref(this._r)}>\`; }
    }
    Focusable.register('focus-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('live directive import forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import { live } from '@webjsdev/core/directives';
    class Field extends WebComponent {
      static properties = { v: { state: true } };
      render() { return html\`<input .value=\${live('x')}>\`; }
    }
    Field.register('field-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a render-time directive (repeat) does NOT force interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import { repeat } from '@webjsdev/core/directives';
    class List extends WebComponent {
      static properties = { items: { state: true } };
      render() { return html\`<ul>\${repeat([], (x) => x, (x) => html\`<li>\${x}</li>\`)}</ul>\`; }
    }
    List.register('list-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('addController forces interactive', () => {
  const src = DISPLAY_ONLY.replace(
    'constructor() { super();',
    'constructor() { super(); this.addController({});',
  );
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('non-state reactive property forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Counter extends WebComponent {
      static properties = { count: { type: Number, reflect: true } };
      declare count;
      render() { return html\`<p>\${this.count}</p>\`; }
    }
    Counter.register('my-counter');
  `;
  const r = analyzeComponentSource(src);
  assert.equal(r.interactive, true);
  assert.match(r.reason, /state/);
});

test('shorthand reactive property (count: Number) forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Counter extends WebComponent {
      static properties = { count: Number };
      render() { return html\`<p>\${this.count}</p>\`; }
    }
    Counter.register('my-counter');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('mixed state + non-state property still ships (non-state wins)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Mixed extends WebComponent {
      static properties = { label: { type: String }, open: { type: Boolean, state: true } };
      render() { return html\`<p>\${this.label}</p>\`; }
    }
    Mixed.register('mixed-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('only state properties stays display-only', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Internal extends WebComponent {
      static properties = { a: { type: String, state: true }, b: { state: true } };
      render() { return html\`<p>x</p>\`; }
    }
    Internal.register('internal-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('static properties assigned a function call ships (cannot parse state flags)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Built extends WebComponent {
      static properties = buildProps();
      render() { return html\`<p>x</p>\`; }
    }
    Built.register('built-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('static properties assigned an identifier ships', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import { SHARED_PROPS } from './props.js';
    class Shared extends WebComponent {
      static properties = SHARED_PROPS;
      render() { return html\`<p>x</p>\`; }
    }
    Shared.register('shared-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('static properties with a spread ships (spread can inject non-state props)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import { BASE } from './base.js';
    class Spread extends WebComponent {
      static properties = { ...BASE, mode: { state: true } };
      render() { return html\`<p>x</p>\`; }
    }
    Spread.register('spread-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('static properties with a TS type annotation is still parsed', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Typed extends WebComponent {
      static properties: Record<string, object> = { count: { type: Number } };
      render() { return html\`<p>x</p>\`; }
    }
    Typed.register('typed-el');
  `;
  // count is non-state, so it must ship even through the annotation.
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a string descriptor value containing "state: true" does not forge the flag', () => {
  // `attribute` is a real descriptor option. The literal text inside the
  // string must not be mistaken for the state flag.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Variant extends WebComponent {
      static properties = { variant: { type: String, attribute: 'data-state: true' } };
      render() { return html\`<p>x</p>\`; }
    }
    Variant.register('variant-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('namespace reactive primitive via destructuring forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import * as core from '@webjsdev/core';
    const { signal } = core;
    const n = signal(0);
    class DThing extends WebComponent {
      render() { return html\`<p>\${n.get()}</p>\`; }
    }
    DThing.register('d-thing');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('namespace reactive primitive via computed access forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import * as core from '@webjsdev/core';
    const n = core['signal'](0);
    class CThing extends WebComponent {
      render() { return html\`<p>\${n.get()}</p>\`; }
    }
    CThing.register('c-thing');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('static get properties is conservative (ships)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Old extends WebComponent {
      static get properties() { return { x: { state: true } }; }
      render() { return html\`<p>x</p>\`; }
    }
    Old.register('old-el');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('component with no parseable WebComponent body ships', () => {
  const src = `
    import { html } from '@webjsdev/core';
    import { Base } from './base.js';
    class Fancy extends Base { render() { return html\`<p>x</p>\`; } }
    Fancy.register('fancy-el');
  `;
  const r = analyzeComponentSource(src);
  assert.equal(r.interactive, true);
  assert.match(r.reason, /no parseable/);
});

test('an @event in a JS comment, not a template, does not falsely relax', () => {
  // The analyser scans raw source, so a stray marker in a comment only
  // ever over-detects (ships). This pins that direction.
  const src = DISPLAY_ONLY.replace('render()', '// uses @click=${} elsewhere\n  render()');
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('extractRenderedTags finds only hyphenated custom-element tags', () => {
  const src = `html\`<div><user-card></user-card><p>hi</p><nav-bar/></div>\``;
  const tags = extractRenderedTags(src);
  assert.deepEqual([...tags].sort(), ['nav-bar', 'user-card']);
});

// ── computeElidableComponents fixpoint ──────────────────────────────

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}

test('two display-only components, both elidable', async () => {
  const files = {
    '/app/components/a.js': DISPLAY_ONLY.replace(/student-card/g, 'comp-a'),
    '/app/components/b.js': DISPLAY_ONLY.replace(/student-card/g, 'comp-b'),
  };
  const elidable = await computeElidableComponents(
    [
      { tag: 'comp-a', file: '/app/components/a.js' },
      { tag: 'comp-b', file: '/app/components/b.js' },
    ],
    graphOf({}),
    async (f) => files[f],
    '/app',
  );
  assert.deepEqual([...elidable].sort(), ['/app/components/a.js', '/app/components/b.js']);
});

test('interactive parent rendering a display-only child forces the child to ship', async () => {
  const parent = `
    import { WebComponent, html } from '@webjsdev/core';
    class Parent extends WebComponent {
      static properties = { items: { type: Array } };
      render() { return html\`<child-el></child-el>\`; }
    }
    Parent.register('parent-el');
  `;
  const child = DISPLAY_ONLY.replace(/student-card/g, 'child-el');
  const files = { '/app/parent.js': parent, '/app/child.js': child };
  const elidable = await computeElidableComponents(
    [
      { tag: 'parent-el', file: '/app/parent.js' },
      { tag: 'child-el', file: '/app/child.js' },
    ],
    graphOf({}),
    async (f) => files[f],
    '/app',
  );
  assert.deepEqual([...elidable], []);
});

test('import rule: display-only importer of a shipping component ships', async () => {
  const interactive = DISPLAY_ONLY.replace(/student-card/g, 'shipper-el').replace(
    'render()',
    'connectedCallback() {} render()',
  );
  const displayOnly = DISPLAY_ONLY.replace(/student-card/g, 'plain-el');
  const files = { '/app/ship.js': interactive, '/app/plain.js': displayOnly };
  const elidable = await computeElidableComponents(
    [
      { tag: 'shipper-el', file: '/app/ship.js' },
      { tag: 'plain-el', file: '/app/plain.js' },
    ],
    graphOf({ '/app/plain.js': ['/app/ship.js'] }),
    async (f) => files[f],
    '/app',
  );
  assert.deepEqual([...elidable], []);
});

test('unreadable component file is conservatively kept (ships)', async () => {
  const elidable = await computeElidableComponents(
    [{ tag: 'gone-el', file: '/app/gone.js' }],
    graphOf({}),
    async () => { throw new Error('ENOENT'); },
    '/app',
  );
  assert.deepEqual([...elidable], []);
});

test('component reading an imported shared module-scope signal ships', async () => {
  // The canonical shared-state pattern: a state module exports a signal,
  // a read-only consumer renders signal.get(). The consumer imports no
  // primitive itself but its SignalWatcher re-renders on change, so it
  // must ship.
  const consumer = `
    import { WebComponent, html } from '@webjsdev/core';
    import { count } from './state.js';
    class Badge extends WebComponent {
      render() { return html\`<span>\${count.get()}</span>\`; }
    }
    Badge.register('count-badge');
  `;
  const state = `
    import { signal } from '@webjsdev/core';
    export const count = signal(0);
  `;
  const files = { '/app/badge.js': consumer, '/app/state.js': state };
  const elidable = await computeElidableComponents(
    [{ tag: 'count-badge', file: '/app/badge.js' }],
    graphOf({ '/app/badge.js': ['/app/state.js'] }),
    async (f) => files[f],
    '/app',
  );
  assert.deepEqual([...elidable], [], 'count-badge reads a shared signal, must ship');
});

test('render rule: child emitted via an imported template helper still ships', async () => {
  // The interactive parent does NOT name <grid-cell> in its own source; it
  // emits it through a helper module (the lib/utils/ui.ts pattern). The
  // child must still be forced to ship.
  const parent = `
    import { WebComponent, html } from '@webjsdev/core';
    import { cell } from './ui.js';
    class Grid extends WebComponent {
      static properties = { rows: { type: Array } };
      render() { return html\`<div>\${cell()}</div>\`; }
    }
    Grid.register('data-grid');
  `;
  const ui = `
    import { html } from '@webjsdev/core';
    export const cell = () => html\`<grid-cell></grid-cell>\`;
  `;
  const child = DISPLAY_ONLY.replace(/student-card/g, 'grid-cell');
  const files = {
    '/app/grid.js': parent,
    '/app/ui.js': ui,
    '/app/cell.js': child,
  };
  const elidable = await computeElidableComponents(
    [
      { tag: 'data-grid', file: '/app/grid.js' },
      { tag: 'grid-cell', file: '/app/cell.js' },
    ],
    graphOf({ '/app/grid.js': ['/app/ui.js', '/app/cell.js'] }),
    async (f) => files[f],
    '/app',
  );
  assert.deepEqual([...elidable], [], 'grid-cell must ship because data-grid can emit it via the helper');
});
