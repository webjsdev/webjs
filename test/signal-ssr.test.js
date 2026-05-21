/**
 * SSR coverage for signals.
 *
 * Signals are passive scalars; they don't need framework-level
 * cooperation. These tests assert the expected behavior end-to-end:
 *
 *   - A module-scope signal's current value is what SSR inlines.
 *   - An instance signal initialised in a class-field declarator
 *     is read by the SSR walker (instance is constructed during SSR).
 *   - A computed signal renders its derived value.
 *   - The `watch(signal)` directive on the server is a one-shot read
 *     (subscription is a client-only concern).
 *   - Signals inside a slotted child render correctly through the
 *     SSR slot projection.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let WebComponent, html, renderToString, signal, computed, watch;

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
  ({ WebComponent, html, renderToString, signal, computed } = await import('../packages/core/index.js'));
  ({ watch } = await import('../packages/core/src/directives.js'));
});

test('SSR inlines a module-scope signal read inside render()', async () => {
  const greeting = signal('Hello');
  class C extends WebComponent {
    render() { return html`<p>${greeting.get()}</p>`; }
  }
  C.register('sig-mod-a');

  const out = await renderToString(html`<sig-mod-a></sig-mod-a>`);
  assert.ok(out.includes('<p>Hello</p>'), `expected greeting in SSR: ${out}`);

  greeting.set('Hola');
  const out2 = await renderToString(html`<sig-mod-a></sig-mod-a>`);
  assert.ok(out2.includes('<p>Hola</p>'), `signal value at SSR reflects current: ${out2}`);
});

test('SSR reads an instance signal initialised in a class-field declarator', async () => {
  class C extends WebComponent {
    count = signal(42);
    render() { return html`<span data-count=${this.count.get()}>${this.count.get()}</span>`; }
  }
  C.register('sig-inst-a');

  const out = await renderToString(html`<sig-inst-a></sig-inst-a>`);
  assert.ok(out.includes('data-count="42"'), `instance signal in SSR attr: ${out}`);
  assert.ok(out.includes('>42</span>'), `instance signal in SSR text: ${out}`);
});

test('SSR renders a computed signal derived from state signals', async () => {
  const a = signal(3);
  const b = signal(4);
  const sum = computed(() => a.get() + b.get());
  class C extends WebComponent {
    render() { return html`<p>sum=${sum.get()}</p>`; }
  }
  C.register('sig-comp-a');

  const out = await renderToString(html`<sig-comp-a></sig-comp-a>`);
  assert.ok(out.includes('sum=7'), `expected computed sum in SSR: ${out}`);
});

test('SSR inlines watch(signal) as a one-shot read', async () => {
  const counter = signal(99);
  class C extends WebComponent {
    render() { return html`<p>${watch(counter)}</p>`; }
  }
  C.register('sig-watch-a');

  const out = await renderToString(html`<sig-watch-a></sig-watch-a>`);
  assert.ok(out.includes('<p>99</p>'), `watch() inlines current signal value in SSR: ${out}`);
});

test('Signal inside a slotted child renders through SSR slot projection', async () => {
  const heading = signal('Welcome');
  class Child extends WebComponent {
    render() { return html`<h1>${heading.get()}</h1>`; }
  }
  Child.register('sig-slot-child');

  class Shell extends WebComponent {
    render() { return html`<section><slot></slot></section>`; }
  }
  Shell.register('sig-slot-shell');

  const out = await renderToString(html`<sig-slot-shell><sig-slot-child></sig-slot-child></sig-slot-shell>`);
  assert.ok(out.includes('<section>'), `shell rendered: ${out}`);
  assert.ok(out.includes('<h1>Welcome</h1>'), `slotted child read the signal at SSR: ${out}`);
});

test('Setting a signal between two SSR passes returns up-to-date HTML', async () => {
  const status = signal('idle');
  class C extends WebComponent {
    render() { return html`<i data-state=${status.get()}>${status.get()}</i>`; }
  }
  C.register('sig-seq-a');

  const first = await renderToString(html`<sig-seq-a></sig-seq-a>`);
  assert.ok(first.includes('idle'), `first pass: ${first}`);

  status.set('working');
  const second = await renderToString(html`<sig-seq-a></sig-seq-a>`);
  assert.ok(second.includes('working'), `second pass: ${second}`);
  assert.ok(!second.includes('>idle<'), `second pass replaced idle: ${second}`);
});

test('Cross-request signal isolation reminder: module-scope signals leak', async () => {
  // Documents the SSR safety rule. Asserts the leaky behaviour so
  // a future regression would surface it.
  const sharedAcrossRequests = signal(0);
  class C extends WebComponent {
    render() { return html`<u>${sharedAcrossRequests.get()}</u>`; }
  }
  C.register('sig-leak-a');

  // Simulated request A.
  sharedAcrossRequests.set(1);
  const ra = await renderToString(html`<sig-leak-a></sig-leak-a>`);
  assert.ok(ra.includes('<u>1</u>'));

  // Simulated request B has no write yet. The prior value persists.
  const rb = await renderToString(html`<sig-leak-a></sig-leak-a>`);
  assert.ok(rb.includes('<u>1</u>'), 'module-scope signals persist across SSR passes by design; use AsyncLocalStorage or request context for request-scoped state');
});
