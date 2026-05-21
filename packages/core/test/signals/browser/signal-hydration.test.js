/**
 * Browser tests for signal behaviour through the SSR -> hydration
 * roundtrip and across webjs-specific framework features (slot
 * projection, light-DOM hydration markers, the framework's reactive-
 * property + signal coexistence).
 *
 * Each test seeds DOM as if it came from SSR, then upgrades the
 * custom element and asserts the post-hydration state matches the
 * SSR snapshot AND that subsequent signal mutations re-render.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal, computed } from '../../../src/signal.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('Signal + SSR hydration roundtrip', () => {
  let next = 0;
  const newTag = (base) => `${base}-h-${++next}`;

  test('instance signal SSR value matches client hydration value', async () => {
    const T = newTag('sig-hyd');
    class C extends WebComponent {
      count = signal(7);
      render() { return html`<p>count=${this.count.get()}</p>`; }
    }
    customElements.define(T, C);

    // Mount with SSR-like markup (the hydration marker + already-
    // rendered body). The framework's hydration path replaces the
    // marker; the body re-renders to the SAME shape via signal.get(7).
    const el = document.createElement(T);
    el.innerHTML = '<!--webjs-hydrate--><p>count=7</p>';
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'count=7');

    el.count.set(8);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'count=8',
      'signal mutation triggers a re-render via the built-in SignalWatcher');

    el.remove();
  });

  test('module-scope signal across two component instances', async () => {
    const shared = signal('init');
    const T = newTag('sig-mod');
    class C extends WebComponent {
      render() { return html`<span>${shared.get()}</span>`; }
    }
    customElements.define(T, C);

    const a = document.createElement(T);
    const b = document.createElement(T);
    document.body.append(a, b);
    await Promise.all([a.updateComplete, b.updateComplete]);
    assert.equal(a.querySelector('span').textContent, 'init');
    assert.equal(b.querySelector('span').textContent, 'init');

    shared.set('updated');
    await Promise.all([a.updateComplete, b.updateComplete]);
    assert.equal(a.querySelector('span').textContent, 'updated');
    assert.equal(b.querySelector('span').textContent, 'updated');

    a.remove();
    b.remove();
  });

  test('computed signal updates downstream component on dep change', async () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.get() + b.get());
    const T = newTag('sig-comp');
    class C extends WebComponent {
      render() { return html`<p>sum=${sum.get()}</p>`; }
    }
    customElements.define(T, C);

    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'sum=5');

    a.set(10);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'sum=13');

    b.set(100);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'sum=110');

    el.remove();
  });

  test('signal-driven component as a slotted child works through projection', async () => {
    const heading = signal('First');
    const Child = newTag('sig-slot-child');
    const Shell = newTag('sig-slot-shell');

    class ChildEl extends WebComponent {
      render() { return html`<h1>${heading.get()}</h1>`; }
    }
    customElements.define(Child, ChildEl);

    class ShellEl extends WebComponent {
      render() { return html`<section><slot></slot></section>`; }
    }
    customElements.define(Shell, ShellEl);

    const shell = document.createElement(Shell);
    const child = document.createElement(Child);
    shell.appendChild(child);
    document.body.appendChild(shell);
    await shell.updateComplete;
    await child.updateComplete;
    assert.equal(shell.querySelector('h1').textContent, 'First');

    heading.set('Second');
    await child.updateComplete;
    assert.equal(shell.querySelector('h1').textContent, 'Second',
      'signal update on slotted child re-renders that child without remounting the shell');

    shell.remove();
  });

  test('disconnect + reconnect re-establishes signal tracking', async () => {
    const tick = signal(0);
    const T = newTag('sig-reconn');
    class C extends WebComponent {
      render() { return html`<i>${tick.get()}</i>`; }
    }
    customElements.define(T, C);

    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('i').textContent, '0');

    // While connected, set fires re-render.
    tick.set(1);
    await el.updateComplete;
    assert.equal(el.querySelector('i').textContent, '1');

    // Disconnect, set, reconnect. The first connection's watcher
    // was disposed; the second connection lazily allocates a new
    // one when render() runs.
    el.remove();
    tick.set(99);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('i').textContent, '99',
      'reconnected component reads the current signal value');

    tick.set(100);
    await el.updateComplete;
    assert.equal(el.querySelector('i').textContent, '100',
      'the reconnected watcher reacts to subsequent set()');

    el.remove();
  });

  test('signal works alongside reactive properties (mixed state)', async () => {
    // Confirm signals and reactive properties coexist: reactive
    // property `mode` drives one part of the template, instance
    // signal `count` drives another. Each works independently.
    const T = newTag('sig-mixed');
    class C extends WebComponent {
      static properties = { mode: { type: String, reflect: true } };
      count = signal(0);
      constructor() { super(); this.mode = 'idle'; }
      render() {
        return html`<p>mode=${this.mode} count=${this.count.get()}</p>`;
      }
    }
    customElements.define(T, C);

    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'mode=idle count=0');

    el.mode = 'busy';
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'mode=busy count=0');

    el.count.set(5);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'mode=busy count=5');

    // Reflection still works.
    assert.equal(el.getAttribute('mode'), 'busy', 'reflect:true still mirrors property to attribute');

    el.remove();
  });
});
