/**
 * `closest()` at SSR (issue #220).
 *
 * Compound components derive active/pressed state by walking to a parent with
 * `this.closest('parent-tag')` and reading its state. The SSR walker threads an
 * ancestor chain of the enclosing custom-element instances into each instance,
 * and the server element shim implements `closest()` over that chain, so a
 * child resolves its parent server-side and the first paint is correct (no
 * hydration flash). render() may also mutate host IDL properties
 * (this.dataset.* / this.className / this.hidden / this.ariaPressed); those
 * surface as attributes on the SSR'd host tag.
 *
 * The counterfactual at the end proves the parent resolution is driven by the
 * ancestor chain: a child rendered at the top level (no enclosing parent) gets
 * null from closest() and falls back to the inactive paint.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebComponent } from '../../src/component.js';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';

// A minimal compound pair mirroring the ui-tabs shape: the trigger reads the
// parent's selected value via closest() and marks itself active at SSR.
class CxGroup extends WebComponent {
  static properties = { value: { type: String } };
  constructor() {
    super();
    this.value = '';
  }
  render() {
    return html`<div data-group><slot></slot></div>`;
  }
}
CxGroup.register('cx-group');

class CxItem extends WebComponent {
  static properties = { value: { type: String } };
  constructor() {
    super();
    this.value = '';
  }
  get _group() {
    return typeof this.closest === 'function' ? this.closest('cx-group') : null;
  }
  render() {
    const group = this._group;
    const active = !!group && group.value === this.value && this.value !== '';
    // Mutate host IDL properties during render() to exercise the reflections.
    this.dataset.state = active ? 'active' : 'inactive';
    this.ariaPressed = String(active);
    this.className = active ? 'is-active' : 'is-idle';
    this.hidden = !active;
    return html`<button>${this.value}</button>`;
  }
}
CxItem.register('cx-item');

test('a child resolves its parent via closest() at SSR and marks active state', async () => {
  const out = await renderToString(html`
    <cx-group value="b">
      <cx-item value="a">A</cx-item>
      <cx-item value="b">B</cx-item>
    </cx-group>
  `);
  const items = [...out.matchAll(/<cx-item value="(\w)"([^>]*)>/g)].map((m) => ({
    value: m[1],
    state: m[2].match(/data-state="(\w+)"/)?.[1],
    pressed: m[2].match(/aria-pressed="(\w+)"/)?.[1],
    cls: m[2].match(/class="([^"]+)"/)?.[1],
    hidden: /(^|\s)hidden(=|\s|$)/.test(m[2]),
  }));
  const a = items.find((i) => i.value === 'a');
  const b = items.find((i) => i.value === 'b');
  // The value="b" item matches the group's value, so it is active first paint.
  assert.deepEqual(
    { state: b.state, pressed: b.pressed, cls: b.cls, hidden: b.hidden },
    { state: 'active', pressed: 'true', cls: 'is-active', hidden: false },
  );
  // The value="a" item is inactive (and hidden) in the first paint.
  assert.deepEqual(
    { state: a.state, pressed: a.pressed, cls: a.cls, hidden: a.hidden },
    { state: 'inactive', pressed: 'false', cls: 'is-idle', hidden: true },
  );
});

test('closest() resolves through intermediate custom elements (deep chain)', async () => {
  class CxList extends WebComponent {
    render() {
      return html`<div data-list><slot></slot></div>`;
    }
  }
  CxList.register('cx-list');

  const out = await renderToString(html`
    <cx-group value="x">
      <cx-list>
        <cx-item value="x">X</cx-item>
      </cx-list>
    </cx-group>
  `);
  // The cx-item sits inside cx-list inside cx-group, so closest('cx-group')
  // skips the intermediate cx-list and resolves the grandparent.
  const item = out.match(/<cx-item value="x"([^>]*)>/)[1];
  assert.match(item, /data-state="active"/, 'grandparent resolved through cx-list');
});

test('closest() returns null with no matching ancestor; child paints inactive', async () => {
  // No enclosing cx-group, so the item is rendered at the top level.
  const out = await renderToString(html`<cx-item value="a">A</cx-item>`);
  const item = out.match(/<cx-item value="a"([^>]*)>/)[1];
  assert.match(item, /data-state="inactive"/, 'no parent yields the inactive paint');
  assert.match(item, /aria-pressed="false"/);
});

test('closest() supports tag-name selectors only; a non-tag selector returns null', async () => {
  // Assert on rendered OUTPUT (not a captured side effect): nested components
  // render twice in the walker (an empty-chain pass whose edit is dropped, then
  // the kept pass with the real chain), so the emitted HTML is the source of
  // truth for what closest() resolved.
  class CxProbe extends WebComponent {
    render() {
      // A class / attribute / descendant selector is unsupported at SSR.
      const r = (v) => (v ? 'hit' : 'null');
      return html`<i
        data-klass=${r(this.closest('.some-class'))}
        data-attr=${r(this.closest('[role="x"]'))}
        data-descendant=${r(this.closest('cx-group cx-item'))}
        data-tag=${r(this.closest('cx-group'))}
      >probe</i>`;
    }
  }
  CxProbe.register('cx-probe');

  const out = await renderToString(html`<cx-group value="v"><cx-probe></cx-probe></cx-group>`);
  const probe = out.match(/<i\b[^>]*data-tag[^>]*>/)[0];
  assert.match(probe, /data-klass="null"/, 'class selector returns null at SSR');
  assert.match(probe, /data-attr="null"/, 'attribute selector returns null at SSR');
  assert.match(probe, /data-descendant="null"/, 'descendant selector returns null at SSR');
  assert.match(probe, /data-tag="hit"/, 'bare tag selector resolves');
});

test('closest() is self-inclusive (matches the element itself)', async () => {
  let self;
  class CxSelf extends WebComponent {
    render() {
      self = this.closest('cx-self');
      return html`<i>x</i>`;
    }
  }
  CxSelf.register('cx-self');
  await renderToString(html`<cx-self></cx-self>`);
  assert.ok(self, 'closest(ownTag) returns the element itself');
});

test('the ancestor chain is available in willUpdate (before render) at SSR', async () => {
  // willUpdate runs before render in the SSR update cycle. Derive a value
  // there from closest() and emit it in render() so the assertion reads the
  // kept (real-chain) output rather than a clobbered side effect.
  class CxEarly extends WebComponent {
    constructor() {
      super();
      this.fromWillUpdate = 'unset';
    }
    willUpdate() {
      this.fromWillUpdate = this.closest('cx-group') ? 'has-parent' : 'no-parent';
    }
    render() {
      return html`<i>${this.fromWillUpdate}</i>`;
    }
  }
  CxEarly.register('cx-early');
  const out = await renderToString(html`<cx-group value="v"><cx-early></cx-early></cx-group>`);
  assert.match(out, /<i>has-parent<\/i>/, 'closest() works in willUpdate, not just render');
});

test('dataset maps camelCase to kebab-case data-* attributes at SSR', async () => {
  class CxData extends WebComponent {
    render() {
      this.dataset.fooBar = 'baz';
      return html`<i>x</i>`;
    }
  }
  CxData.register('cx-data');
  const out = await renderToString(html`<cx-data></cx-data>`);
  assert.match(out, /<cx-data[^>]*\sdata-foo-bar="baz"/, 'dataset.fooBar maps to data-foo-bar');
});
