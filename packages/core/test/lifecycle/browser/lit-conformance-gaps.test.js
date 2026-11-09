/**
 * Lit behaviours #1686 listed as suspected gaps, each asserted the way Lit's
 * reactive-element and lit-html suites do. Two were real and are fixed here:
 * `useDefault` (the first value is the default, not reflected, and restored
 * when the attribute is removed) and a `ref` callback receiving the host as
 * `this`. The rest already matched and stay as regression guards.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { WebComponent } from '../../../src/component.js';
import { ref } from '../../../src/directives.js';
import { repeat } from '../../../src/repeat.js';
import { assert } from '../../../../../test/browser-assert.js';

let n = 0;
const tag = () => `probe-el-${++n}`;

suite('lit gaps probe', () => {
  test('toAttribute returning undefined removes the reflected attribute', async () => {
    class E extends WebComponent {
      static properties = { foo: { type: String, reflect: true, converter: { toAttribute: (v) => (v === 'x' ? undefined : v) } } };
    }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    el.foo = 'a'; await el.updateComplete;
    assert.equal(el.getAttribute('foo'), 'a');
    el.foo = 'x'; await el.updateComplete;
    assert.equal(el.getAttribute('foo'), null);
    el.remove();
  });

  test('removing an attribute sets a String prop to null', async () => {
    class E extends WebComponent { static properties = { foo: { type: String } }; }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    el.setAttribute('foo', 'a'); await el.updateComplete;
    assert.equal(el.foo, 'a');
    el.removeAttribute('foo'); await el.updateComplete;
    assert.equal(el.foo, null);
    el.remove();
  });

  test('removing an attribute sets a Number prop to null', async () => {
    class E extends WebComponent { static properties = { n: { type: Number } }; }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    el.setAttribute('n', '3'); await el.updateComplete;
    assert.equal(el.n, 3);
    el.removeAttribute('n'); await el.updateComplete;
    assert.equal(el.n, null);
    el.remove();
  });

  test('fromAttribute receives the declared type', async () => {
    let seen;
    class E extends WebComponent {
      static properties = { foo: { type: Number, converter: { fromAttribute: (v, type) => { seen = type; return v; } } } };
    }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    el.setAttribute('foo', '1'); await el.updateComplete;
    assert.equal(seen, Number);
    el.remove();
  });

  test('toAttribute receives the declared type', async () => {
    let seen;
    class E extends WebComponent {
      static properties = { foo: { type: Number, reflect: true, converter: { toAttribute: (v, type) => { seen = type; return String(v); } } } };
    }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    el.foo = 2; await el.updateComplete;
    assert.equal(seen, Number);
    el.remove();
  });

  test('a prop set inside update() before super.update does not schedule another update', async () => {
    let updates = 0;
    class E extends WebComponent {
      static properties = { a: { type: Number }, b: { type: Number } };
      update(changed) { if (changed.has('a')) this.b = this.a * 2; super.update(changed); }
      updated() { updates++; }
    }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    await el.updateComplete; updates = 0;
    el.a = 2; await el.updateComplete;
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(el.b, 4);
    assert.equal(updates, 1);
    el.remove();
  });

  test('useDefault: the default is not reflected and removing the attribute restores it', async () => {
    class E extends WebComponent {
      static properties = { mode: { type: String, reflect: true, useDefault: true } };
      constructor() { super(); this.mode = 'auto'; }
    }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    await el.updateComplete;
    assert.equal(el.hasAttribute('mode'), false);
    el.setAttribute('mode', 'x'); await el.updateComplete;
    assert.equal(el.mode, 'x');
    el.removeAttribute('mode'); await el.updateComplete;
    assert.equal(el.mode, 'auto');
    el.remove();
  });

  test('ref callback is called with the host as this', async () => {
    let self;
    class E extends WebComponent {
      cb(el) { self = this; }
      render() { return html`<div ${ref(this.cb)}></div>`; }
    }
    const t = tag(); customElements.define(t, E);
    const el = document.createElement(t); document.body.append(el);
    await el.updateComplete;
    assert.equal(self, el);
    el.remove();
  });

  test('repeat with duplicate keys renders every item', () => {
    const c = document.createElement('div');
    render(html`${repeat([1, 1, 2], (i) => i, (i) => html`<p>${i}</p>`)}`, c);
    assert.equal(c.querySelectorAll('p').length, 3);
  });

  test('repeat multi-move keeps nodes', () => {
    const c = document.createElement('div');
    const r = (items) => render(html`${repeat(items, (i) => i, (i) => html`<p>${i}</p>`)}`, c);
    r([1, 2, 3, 4, 5]);
    const nodes = [...c.querySelectorAll('p')];
    r([5, 3, 1, 4, 2]);
    const after = [...c.querySelectorAll('p')];
    assert.equal(after.map((p) => p.textContent).join(''), '53142');
    assert.equal(after[0], nodes[4]);
    assert.equal(after[1], nodes[2]);
  });

  test('event listener options: passive and capture', () => {
    const c = document.createElement('div');
    let order = [];
    const capture = { handleEvent() { order.push('capture'); }, capture: true };
    render(html`<div @click=${capture}><span @click=${() => order.push('span')}></span></div>`, c);
    document.body.append(c);
    c.querySelector('span').click();
    assert.equal(order.join(','), 'capture,span');
    c.remove();
  });
});
