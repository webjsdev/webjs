/**
 * Real-browser tests for the dev component hot swap (#1689).
 *
 * `dev-hot-client.js` is the exact source the served reload client inlines
 * (`reloadClientJs` strips `export` and embeds it), driven here against the
 * real core: the `customElements.define` wrapper in `registry.js` and the
 * `html()` interner seam in `hot.js`. A second define of a known tag must patch
 * the REGISTERED class in place, re-render the live elements, and keep their
 * reactive values, instance signals, untouched DOM and child components. A
 * change the native registry would ignore must throw with its reason and leave
 * the class untouched.
 */
import { installHotClient } from '../../../src/dev-hot-client.js';
import { WebComponent, prop } from '../../../../core/src/component.js';
import { html } from '../../../../core/src/html.js';
import { css } from '../../../../core/src/css.js';
import { signal } from '../../../../core/src/signal.js';

import { assert } from '../../../../../test/browser-assert.js';

// Installed before any template renders, as the reload script is in a page.
const hot = installHotClient(globalThis);
const HOT = Symbol.for('webjs.hot');

/** @param {Element} el */
const settle = async (el) => { await /** @type {any} */ (el).updateComplete; await new Promise((r) => setTimeout(r, 0)); };

class HotChild extends WebComponent({ n: Number }) {
  constructor() { super(); this.n = 0; }
  render() { return html`<span class="n">${this.n}</span>`; }
}
HotChild.register('hot-child');

suite('dev component hot swap (#1689)', () => {
  test('a re-define patches the live element: new render, state, signal, DOM and child kept', async () => {
    class HotA extends WebComponent({ count: Number }) {
      constructor() { super(); this.count = 0; this.note = signal('n0'); }
      render() { return html`<div><input class="in"><hot-child></hot-child>${this.label()}</div>`; }
      label() { return html`<p class="msg">v1 ${this.count} ${this.note.get()}</p>`; }
    }
    HotA.register('hot-a');
    const el = /** @type {any} */ (document.createElement('hot-a'));
    document.body.appendChild(el);
    await settle(el);
    el.count = 5;
    el.note.set('kept');
    const input = el.querySelector('.in');
    input.value = 'typed';
    const child = el.querySelector('hot-child');
    child.n = 7;
    await settle(el);
    await settle(child);
    assert.equal(el.querySelector('.msg').textContent, 'v1 5 kept');

    class HotA2 extends WebComponent({ count: Number }) {
      constructor() { super(); this.count = 0; this.note = signal('n0'); }
      render() { return html`<div><input class="in"><hot-child></hot-child>${this.label()}</div>`; }
      label() { return html`<p class="msg">v2 ${this.count} ${this.note.get()}</p>`; }
    }
    HotA2.register('hot-a');
    await settle(el);

    assert.equal(el.querySelector('.msg').textContent, 'v2 5 kept', 'the new render runs with the kept property and signal');
    assert.ok(el instanceof HotA, 'the element keeps its registered class');
    assert.equal(customElements.get('hot-a'), HotA, 'the native registry still holds the first class');
    assert.equal(el.count, 5);
    assert.equal(el.querySelector('.in'), input, 'an unchanged template keeps its DOM node');
    assert.equal(input.value, 'typed', 'and what was typed into it');
    assert.equal(el.querySelector('hot-child'), child, 'a nested component is the same element');
    assert.equal(child.n, 7, 'with its own state');
    el.remove();
  });

  test('without the interner an unchanged template is rebuilt (counterfactual)', async () => {
    class HotI extends WebComponent({ count: Number }) {
      constructor() { super(); this.count = 0; }
      render() { return html`<div><input class="in">${this.label()}</div>`; }
      label() { return html`<p class="msg">i1</p>`; }
    }
    HotI.register('hot-i');
    const el = /** @type {any} */ (document.createElement('hot-i'));
    document.body.appendChild(el);
    await settle(el);
    const input = el.querySelector('.in');
    const real = hot.strings;
    hot.strings = (s) => s;
    try {
      class HotI2 extends WebComponent({ count: Number }) {
        constructor() { super(); this.count = 0; }
        render() { return html`<div><input class="in">${this.label()}</div>`; }
        label() { return html`<p class="msg">i2</p>`; }
      }
      HotI2.register('hot-i');
      await settle(el);
    } finally {
      hot.strings = real;
    }
    assert.equal(el.querySelector('.msg').textContent, 'i2');
    assert.notEqual(el.querySelector('.in'), input, 'with no interning the identical outer template is rebuilt');
    el.remove();
  });

  test('a shadow component adopts its new styles', async () => {
    class HotS extends WebComponent({ count: Number }) {
      static shadow = true;
      static styles = css`p { color: rgb(255, 0, 0); }`;
      constructor() { super(); this.count = 0; }
      render() { return html`<p>s ${this.count}</p>`; }
    }
    HotS.register('hot-s');
    const el = /** @type {any} */ (document.createElement('hot-s'));
    document.body.appendChild(el);
    await settle(el);
    el.count = 3;
    await settle(el);
    const p = el.shadowRoot.querySelector('p');
    assert.equal(getComputedStyle(p).color, 'rgb(255, 0, 0)');
    class HotS2 extends WebComponent({ count: Number }) {
      static shadow = true;
      static styles = css`p { color: rgb(0, 0, 255); }`;
      constructor() { super(); this.count = 0; }
      render() { return html`<p>s2 ${this.count}</p>`; }
    }
    HotS2.register('hot-s');
    await settle(el);
    const p2 = el.shadowRoot.querySelector('p');
    assert.equal(p2.textContent, 's2 3');
    assert.equal(getComputedStyle(p2).color, 'rgb(0, 0, 255)', 'the shadow root adopted the new sheet');
    el.remove();
  });

  /**
   * Define V1, mount it, then assert defining V2 throws `reason` and leaves the
   * element rendering V1.
   * @param {string} tag
   * @param {Function} V1
   * @param {Function} V2
   * @param {string} reason
   */
  async function refused(tag, V1, V2, reason) {
    customElements.define(tag, /** @type {any} */ (V1));
    const el = /** @type {any} */ (document.createElement(tag));
    document.body.appendChild(el);
    await settle(el);
    const before = el.textContent;
    let err;
    try { customElements.define(tag, /** @type {any} */ (V2)); } catch (e) { err = e; }
    assert.ok(err, `defining a changed ${tag} throws`);
    assert.match(String(err.message), new RegExp(`hot swap of <${tag}> needs a reload: ${reason}`));
    el.requestUpdate();
    await settle(el);
    assert.equal(el.textContent, before, 'the class was left unpatched');
    el.remove();
  }

  test('a new reactive property is refused', async () => {
    await refused('hot-g1',
      class extends WebComponent({ a: Number }) { render() { return html`<p>g1</p>`; } },
      class extends WebComponent({ a: Number, b: String }) { render() { return html`<p>g1b</p>`; } },
      'reactive-properties-changed');
  });

  test('a changed property option is refused', async () => {
    await refused('hot-g2',
      class extends WebComponent({ a: prop(Number) }) { render() { return html`<p>g2</p>`; } },
      class extends WebComponent({ a: prop(Number, { reflect: true }) }) { render() { return html`<p>g2b</p>`; } },
      'reactive-properties-changed');
  });

  test('changed observedAttributes are refused', async () => {
    await refused('hot-g3',
      class extends WebComponent({ a: Number }) { render() { return html`<p>g3</p>`; } },
      class extends WebComponent({ a: Number }) {
        static get observedAttributes() { return [...super.observedAttributes, 'extra']; }
        render() { return html`<p>g3b</p>`; }
      },
      'observed-attributes-changed');
  });

  test('a changed connectedCallback override is refused', async () => {
    await refused('hot-g4',
      class extends WebComponent({ a: Number }) {
        connectedCallback() { super.connectedCallback(); this.dataset.v = '1'; }
        render() { return html`<p>g4</p>`; }
      },
      class extends WebComponent({ a: Number }) {
        connectedCallback() { super.connectedCallback(); this.dataset.v = '2'; }
        render() { return html`<p>g4b</p>`; }
      },
      'connectedCallback-changed');
  });

  test('a static shadow flip is refused', async () => {
    await refused('hot-g5',
      class extends WebComponent({ a: Number }) { render() { return html`<p>g5</p>`; } },
      class extends WebComponent({ a: Number }) { static shadow = true; render() { return html`<p>g5b</p>`; } },
      'static-shadow-changed');
  });

  test('with no hot client a re-define leaves the old render (counterfactual)', async () => {
    class HotN extends WebComponent({ a: Number }) { render() { return html`<p>n1</p>`; } }
    HotN.register('hot-n');
    const el = /** @type {any} */ (document.createElement('hot-n'));
    document.body.appendChild(el);
    await settle(el);
    delete (/** @type {any} */ (globalThis))[HOT];
    try {
      class HotN2 extends WebComponent({ a: Number }) { render() { return html`<p>n2</p>`; } }
      HotN2.register('hot-n');
      el.requestUpdate();
      await settle(el);
    } finally {
      /** @type {any} */ (globalThis)[HOT] = hot;
    }
    assert.equal(el.textContent, 'n1');
    el.remove();
  });

  test('applyModules imports versioned modules and reports the swapped tags, or the refusal', async () => {
    await import('./hot-fixture-b1.js');
    const el = /** @type {any} */ (document.createElement('hot-b'));
    document.body.appendChild(el);
    await settle(el);
    el.count = 4;
    await settle(el);
    const base = new URL('./', import.meta.url).pathname;
    const ok = await hot.applyModules([base + 'hot-fixture-b2.js?t=1']);
    assert.deepEqual(ok, { ok: true, tags: ['hot-b'] });
    await settle(el);
    assert.equal(el.textContent, 'b2 4');
    const refusedApply = await hot.applyModules([base + 'hot-fixture-b3.js?t=2']);
    assert.equal(refusedApply.ok, false);
    assert.match(refusedApply.why, /hot swap of <hot-b> needs a reload: reactive-properties-changed/);
    el.remove();
  });
});
