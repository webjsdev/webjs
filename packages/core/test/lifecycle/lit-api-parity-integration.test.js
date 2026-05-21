/**
 * Integration smoke for the lit-API parity work. Exercises a component
 * that combines the new lifecycle hooks (shouldUpdate, willUpdate,
 * updated, firstUpdated with changedProperties, updateComplete) AND
 * the new directives (keyed, guard, cache, until, ref, templateContent)
 * to verify the full path renders cleanly via renderToString on the
 * server AND hydrates without crashing under linkedom.
 *
 * Sits between unit tests and real-browser tests. Catches regressions
 * where a new lifecycle hook accidentally breaks the SSR path, or a
 * new directive crashes when used inside a component with reactive
 * properties.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let WebComponent, html, renderToString;
let keyed, guard, cache, until, ref, createRef, templateContent;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.customElements = window.customElements;
  globalThis.NodeFilter = window.NodeFilter;
  globalThis.MutationObserver = window.MutationObserver;

  ({ WebComponent, html, renderToString } = await import('../../index.js'));
  ({ keyed, guard, cache, until, ref, createRef, templateContent } =
    await import('../../src/directives.js'));
});

test('integration: component using new lifecycle + directives SSRs correctly', async () => {
  class CombinedEl extends WebComponent {
    static properties = {
      id: { type: Number },
      title: { type: String },
    };
    constructor() {
      super();
      this.id = 0;
      this.title = '';
      this._inputRef = createRef();
      this._cycles = { willUpdate: 0, firstUpdated: 0, updated: 0 };
    }
    shouldUpdate(_cp) { return true; }
    willUpdate(_cp) { this._cycles.willUpdate++; }
    firstUpdated(_cp) { this._cycles.firstUpdated++; }
    updated(_cp) { this._cycles.updated++; }
    render() {
      return html`
        <article>
          <h1>${this.title}</h1>
          ${keyed(this.id, html`<form><input ${ref(this._inputRef)}></form>`)}
          ${guard([this.id], () => html`<p data-id=${this.id}>guarded</p>`)}
          ${cache(html`<aside>aside</aside>`)}
          <footer>${until(Promise.resolve('async-resolved'), 'fallback')}</footer>
          <p>${until(new Promise(() => {}), 'fallback-only')}</p>
        </article>
      `;
    }
  }
  CombinedEl.register('combined-el');

  const out = await renderToString(html`
    <combined-el id="7" title="hello"></combined-el>
  `);

  // Component rendered.
  assert.ok(out.includes('<article>'));
  assert.ok(out.includes('<h1>hello</h1>'));
  // keyed wrapper renders the inner template.
  assert.ok(out.includes('<form>'));
  assert.ok(out.includes('<input'));
  // guard invokes the fn (SSR has no cache).
  assert.ok(out.includes('data-id="7"'));
  assert.ok(out.includes('guarded'));
  // cache passes through.
  assert.ok(out.includes('<aside>aside</aside>'));
  // until renders the first synchronous candidate (when one exists),
  // so 'fallback' wins over the unresolved-priority Promise.
  assert.ok(out.includes('fallback'));
  assert.ok(out.includes('fallback-only'));
});

test('integration: component with shouldUpdate=false skips render but SSR still works', async () => {
  class GatedEl extends WebComponent {
    static properties = { v: { type: Number } };
    constructor() { super(); this.v = 5; }
    shouldUpdate() { return false; }
    render() { return html`<p>v=${this.v}</p>`; }
  }
  GatedEl.register('gated-el');

  // SSR calls render() directly without going through the shouldUpdate gate,
  // so the gate must not affect SSR output.
  const out = await renderToString(html`<gated-el v="5"></gated-el>`);
  assert.ok(out.includes('v=5'), `Expected v=5 in SSR output: ${out}`);
});

test('integration: hook order with controllers matches lit', async () => {
  const order = [];
  const controller = {
    hostConnected() { order.push('hostConnected'); },
    hostUpdate() { order.push('hostUpdate'); },
    hostUpdated() { order.push('hostUpdated'); },
    hostDisconnected() { order.push('hostDisconnected'); },
  };
  class OrderEl extends WebComponent {
    static properties = { n: { type: Number } };
    constructor() {
      super();
      this.n = 0;
      this.addController(controller);
    }
    shouldUpdate() { order.push('shouldUpdate'); return true; }
    willUpdate() { order.push('willUpdate'); }
    update(cp) { order.push('update'); super.update?.(cp); }
    firstUpdated() { order.push('firstUpdated'); }
    updated() { order.push('updated'); }
    render() { order.push('render'); return html``; }
  }
  OrderEl.register('order-el');
  const el = document.createElement('order-el');
  document.body.appendChild(el);
  await el.updateComplete;

  // Trim to the first render's events.
  const idx = order.indexOf('hostConnected');
  const slice = order.slice(idx);
  assert.deepEqual(slice, [
    'hostConnected',
    'shouldUpdate',
    'willUpdate',
    'hostUpdate',
    'update',
    'render',
    'hostUpdated',
    'firstUpdated',
    'updated',
  ]);

  el.remove();
  // disconnectedCallback fires hostDisconnected synchronously.
  assert.ok(order.includes('hostDisconnected'));
});
