/**
 * Which calls a component's render-scoped action signal binds (#1514, #492),
 * under linkedom. The browser half is browser/render-action-signal.test.js.
 *
 * Only the synchronous part of the component's own render() may see the
 * signal. The DOM commit runs unbound, so a child created by the parent's
 * render never inherits the parent's signal in its connectedCallback.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let WebComponent, html, signal, activeActionSignal, setActiveActionSignal;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'DocumentFragment',
    'Comment', 'Text', 'customElements', 'NodeFilter', 'MutationObserver']) {
    globalThis[k] = k === 'window' ? window : window[k];
  }
  ({ WebComponent, html, signal } = await import('../../index.js'));
  ({ activeActionSignal, setActiveActionSignal } = await import('../../src/action-abort-client.js'));
});

const tick = () => new Promise((r) => setTimeout(r, 0));

test('the render signal is bound during render() and cleared after the commit', async () => {
  /** @type {(AbortSignal|undefined)[]} */
  const seen = [];
  /** @type {(AbortSignal|undefined)[]} */
  const inUpdated = [];
  const v = signal(0);
  class C extends WebComponent {
    render() { seen.push(activeActionSignal()); return html`<p>${v.get()}</p>`; }
    updated() { inUpdated.push(activeActionSignal()); }
  }
  C.register('ras-own');
  const el = document.createElement('ras-own');
  document.body.appendChild(el);
  await el.updateComplete;
  v.set(1);
  await el.updateComplete;
  assert.ok(seen[0] instanceof AbortSignal, 'render() saw its signal');
  assert.equal(seen[0].aborted, true, 'the superseding render aborted it');
  assert.equal(seen[1].aborted, false);
  assert.deepEqual(inUpdated, [undefined, undefined], 'post-commit hooks are unbound');
  assert.equal(activeActionSignal(), undefined);
  el.remove();
});

test('a child connected by the parent\'s commit does not inherit the parent\'s signal (#1514)', async () => {
  /** @type {(AbortSignal|undefined)[]} */
  const childSignals = [];
  class Child extends WebComponent {
    connectedCallback() { super.connectedCallback(); childSignals.push(activeActionSignal()); }
    render() { return html`<span>c</span>`; }
  }
  Child.register('ras-child');
  const show = signal(false);
  const n = signal(0);
  class Parent extends WebComponent {
    render() {
      const s = show.get();
      return html`<p>${n.get()}</p>${s ? html`<ras-child></ras-child>` : ''}`;
    }
  }
  Parent.register('ras-parent');
  const el = document.createElement('ras-parent');
  document.body.appendChild(el);
  await el.updateComplete;
  show.set(true);
  await el.updateComplete;
  await tick();
  assert.equal(childSignals.length, 1, 'the child connected during the parent\'s commit');
  assert.equal(childSignals[0], undefined, 'its connectedCallback saw no render signal');
  el.remove();
});

test('a nested render restores the outer binding instead of clearing it', async () => {
  class C extends WebComponent { render() { return html`<p>x</p>`; } }
  C.register('ras-nested');
  const el = document.createElement('ras-nested');
  document.body.appendChild(el);
  await el.updateComplete;
  const outer = new AbortController();
  setActiveActionSignal(outer.signal);
  try {
    el._performRender();
    assert.equal(activeActionSignal(), outer.signal);
  } finally {
    setActiveActionSignal(null);
    el.remove();
  }
});
