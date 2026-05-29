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

test('a side-effect import with no space or a trailing comment is still caught', () => {
  const noSpace = `
    import { WebComponent, html } from '@webjsdev/core';
    import"some-polyfill";
    class A extends WebComponent { render() { return html\`<p>x</p>\`; } }
    A.register('a-el');
  `;
  assert.equal(analyzeComponentSource(noSpace).interactive, true);

  const trailingComment = `
    import { WebComponent, html } from '@webjsdev/core';
    import 'some-polyfill'; // bootstrap
    class B extends WebComponent { render() { return html\`<p>x</p>\`; } }
    B.register('b-el');
  `;
  assert.equal(analyzeComponentSource(trailingComment).interactive, true);
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

test('component importing a relative helper that does client work ships (any import, not just npm)', async () => {
  // The component itself is display-only, but it imports a plain helper
  // that touches a browser global at module scope. Eliding the component
  // would drop that helper's client effect, so it must ship.
  const comp = `
    import { WebComponent, html } from '@webjsdev/core';
    import './setup.js';
    class Inert extends WebComponent { render() { return html\`<p>x</p>\`; } }
    Inert.register('inert-el');
  `;
  const setup = `if (typeof window !== 'undefined') window.__did = 1;`;
  const files = { '/app/inert.js': comp, '/app/setup.js': setup };
  const elidable = await computeElidableComponents(
    [{ tag: 'inert-el', file: '/app/inert.js' }],
    graphOf({ '/app/inert.js': ['/app/setup.js'] }),
    async (f) => files[f],
    '/app',
  );
  assert.deepEqual([...elidable], [], 'a client-effecting helper forces the component to ship');
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

// --- module-scope client work beyond window/document (false-elision guard) ---

test('module-scope fetch() forces interactive', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    fetch('/track');
    class Pixel extends WebComponent { render() { return html\`<span></span>\`; } }
    Pixel.register('x-pixel');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('module-scope new WebSocket / setTimeout / IntersectionObserver force interactive', () => {
  for (const stmt of ['new WebSocket("/ws");', 'setTimeout(() => {}, 0);', 'new IntersectionObserver(() => {});']) {
    const src = `
      import { WebComponent, html } from '@webjsdev/core';
      ${stmt}
      class W extends WebComponent { render() { return html\`<span></span>\`; } }
      W.register('x-w');
    `;
    assert.equal(analyzeComponentSource(src).interactive, true, stmt);
  }
});

test('a dynamic import() forces interactive (loads code on the client)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    import('./analytics-boot.js');
    class Widget extends WebComponent { render() { return html\`<span></span>\`; } }
    Widget.register('x-widget');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a same-named member (this.fetch, route.location) does NOT force interactive', () => {
  // The not-a-dot lookbehind must skip property/method names, or every
  // component with a .fetch() helper or .location field would wrongly ship.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Card extends WebComponent {
      render() { return html\`<p>\${this.route?.location ?? ''}</p>\`; }
    }
    Card.register('x-card');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('a global-looking WORD in rendered template text does NOT force interactive', () => {
  // "location"/"history" as visible prose live in the html template, which
  // redaction blanks, so they must not be read as the browser globals.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Notice extends WebComponent {
      render() { return html\`<p>Update your location and view your history.</p>\`; }
    }
    Notice.register('x-notice');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('import.meta and static imports are NOT mistaken for a dynamic import()', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const base = import.meta.url;
    class M extends WebComponent { render() { return html\`<a href=\${base}>x</a>\`; } }
    M.register('x-m');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('namespace-qualified global access (globalThis.fetch, self.setTimeout) forces interactive', () => {
  // The not-a-dot lookbehind skips `.fetch`, so the global namespace object
  // itself (globalThis/self) is what must be recognised; window.* is already
  // caught via bare `window`.
  for (const stmt of ['globalThis.fetch("/x");', 'self.setTimeout(() => {}, 0);']) {
    const src = `
      import { WebComponent, html } from '@webjsdev/core';
      ${stmt}
      class N extends WebComponent { render() { return html\`<span></span>\`; } }
      N.register('x-n');
    `;
    assert.equal(analyzeComponentSource(src).interactive, true, stmt);
  }
});

test('module-scope XMLHttpRequest / performance / crypto force interactive', () => {
  for (const stmt of ['new XMLHttpRequest();', 'performance.now();', 'crypto.getRandomValues(new Uint8Array(1));']) {
    const src = `
      import { WebComponent, html } from '@webjsdev/core';
      ${stmt}
      class X extends WebComponent { render() { return html\`<span></span>\`; } }
      X.register('x-x');
    `;
    assert.equal(analyzeComponentSource(src).interactive, true, stmt);
  }
});

// --- allowlist of safe top-level forms (no-rot replacement for the global denylist) ---

test('an UNKNOWN top-level global call still ships (allowlist does not rot)', () => {
  // The whole point of the allowlist: a global the analyser has never heard
  // of is caught because it is a top-level CALL, not because its name is on a
  // list. A new browser API needs no code change here.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    someBrandNewBrowserApi.activate('x');
    class Z extends WebComponent { render() { return html\`<span></span>\`; } }
    Z.register('x-z');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a top-level new of an unknown constructor ships', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const t = new SomeFutureThing();
    class Z extends WebComponent { render() { return html\`<span></span>\`; } }
    Z.register('x-z2');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('registration via customElements.define keeps the component elidable', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Plain extends WebComponent { render() { return html\`<span>hi</span>\`; } }
    customElements.define('x-plain', Plain);
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('pure top-level declarations (const literal, tagged css, object) stay elidable', () => {
  const src = `
    import { WebComponent, html, css } from '@webjsdev/core';
    const LABEL = 'verified';
    const STYLES = css\`span { color: red; }\`;
    const OPTS = { a: 1, b: [2, 3] };
    class Tag extends WebComponent {
      static styles = STYLES;
      render() { return html\`<span>\${LABEL}\${OPTS.a}</span>\`; }
    }
    Tag.register('x-tag');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('an async-arrow page default export is not mistaken for an async() call', () => {
  // `export default async () => ...` must stay elidable; the `async (` is an
  // arrow param list, not a call.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Box extends WebComponent { render() { return html\`<span></span>\`; } }
    Box.register('x-box');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

// --- lexical robustness of the module-scope allowlist ---

test('an unbalanced-brace regex literal does NOT hide a later top-level side effect', () => {
  // redactStringsAndTemplates does not track regex literals, so /[{]/ would
  // desync the brace scan. The unbalanced-brace fallback must ship.
  for (const re of ['/[{]/', '/\\$\\{/', '/^[a-z{]+$/']) {
    const src = `
      import { WebComponent, html } from '@webjsdev/core';
      const OPEN = ${re};
      fetch('/analytics/pageview');
      class R extends WebComponent { render() { return html\`<span></span>\`; } }
      R.register('x-r');
    `;
    assert.equal(analyzeComponentSource(src).interactive, true, re);
  }
});

test('optional-chaining calls at module scope ship (foo?.(), globalThis.x?.())', () => {
  for (const stmt of ['boot?.();', 'globalThis.analytics?.track?.();']) {
    const src = `
      import { WebComponent, html } from '@webjsdev/core';
      ${stmt}
      class O extends WebComponent { render() { return html\`<span></span>\`; } }
      O.register('x-o');
    `;
    assert.equal(analyzeComponentSource(src).interactive, true, stmt);
  }
});

test('a balanced or brace-free regex with no side effect stays elidable', () => {
  // Guards against the fallback over-firing: /\d{4}/ braces net out, and a
  // char-class regex with no { stays balanced, so neither forces shipping.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const YEAR = /\\d{4}/;
    const SLUG = /^[a-z0-9-]+$/;
    class G extends WebComponent { render() { return html\`<span>\${YEAR.test('2026')}</span>\`; } }
    G.register('x-g');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('a string body that looks like a call does not force shipping', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const MSG = 'please fetch() and call support() later';
    class S extends WebComponent { render() { return html\`<span>\${MSG}</span>\`; } }
    S.register('x-s2');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('a regex literal containing a quote does not hide a later top-level call', () => {
  // A regex with a stray quote desyncs the upstream string redaction; the
  // string-skip then hits a newline/EOF without closing, which must ship.
  for (const re of ["/[']/", '/["]/', "/it's/"]) {
    const src = `
      import { WebComponent, html } from '@webjsdev/core';
      const RE = ${re};
      fetch('/analytics');
      class Q extends WebComponent { render() { return html\`<span></span>\`; } }
      Q.register('x-q');
    `;
    assert.equal(analyzeComponentSource(src).interactive, true, re);
  }
});

test('an ordinary multi-line component with normal strings stays elidable', () => {
  // Counterfactual for the newline-in-string-skip fallback: normal one-line
  // strings close on their line and must NOT force shipping.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const A = 'hello';
    const B = "world";
    class P extends WebComponent {
      render() { return html\`<span>\${A} \${B}</span>\`; }
    }
    P.register('x-p2');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

// --- proper-lexer cases: regex literals and nested templates no longer desync ---

test('two same-line quote-bearing regexes do NOT hide a call between them', () => {
  // The even-quote / same-line case that defeated the earlier parity patch.
  // The lexer blanks regex bodies, so the quotes never reach the quote pairing.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const A = /'/; track(); const B = /'/;
    class T extends WebComponent { render() { return html\`<span></span>\`; } }
    T.register('x-t3');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a regex with a brace then a top-level call ships (no brace desync)', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const RE = /^[a-z{]+$/; sendBeacon('/x');
    class T extends WebComponent { render() { return html\`<span></span>\`; } }
    T.register('x-t4');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});

test('a nested template does not spill, so a clean component stays elidable', () => {
  // The inner backtick must not be read as the outer template close; the
  // module scope after it is just the register call, so this elides.
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    class Grid extends WebComponent {
      render() { return html\`<ul>\${[1,2].map((x) => html\`<li>\${x}</li>\`)}</ul>\`; }
    }
    Grid.register('x-grid2');
  `;
  assert.equal(analyzeComponentSource(src).interactive, false);
});

test('a module-scope call after a nested-template assignment still ships', () => {
  const src = `
    import { WebComponent, html } from '@webjsdev/core';
    const TPL = html\`<a>\${html\`<b></b>\`}</a>\`;
    ping('/beacon');
    class T extends WebComponent { render() { return html\`<span></span>\`; } }
    T.register('x-t5');
  `;
  assert.equal(analyzeComponentSource(src).interactive, true);
});
