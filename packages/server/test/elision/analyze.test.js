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
  );
  assert.deepEqual([...elidable], []);
});

test('unreadable component file is conservatively kept (ships)', async () => {
  const elidable = await computeElidableComponents(
    [{ tag: 'gone-el', file: '/app/gone.js' }],
    graphOf({}),
    async () => { throw new Error('ENOENT'); },
  );
  assert.deepEqual([...elidable], []);
});
