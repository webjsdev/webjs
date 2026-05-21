/**
 * Browser tests for the `watch(signal)` directive: fine-grained
 * reactive binding that updates one template hole on signal change
 * without re-running the host component's render().
 */
import { html } from '../../packages/core/src/html.js';
import { WebComponent } from '../../packages/core/src/component.js';
import { watch } from '../../packages/core/src/directives.js';
import { signal } from '../../packages/core/src/signal.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('watch() directive', () => {
  let nextTag = 0;
  const newTag = (base) => `${base}-watchdir-${++nextTag}`;

  test('renders the signal value and updates only that hole on change', async () => {
    let renders = 0;
    const count = signal(0);
    const T = newTag('w');
    class C extends WebComponent {
      render() { renders++; return html`<p>Count: ${watch(count)}</p>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(renders, 1);
    assert.equal(el.querySelector('p').textContent, 'Count: 0');

    count.set(1);
    // The directive defers the DOM update to a microtask because the
    // spec forbids signal reads inside Watcher notify. Yield once.
    await Promise.resolve();
    assert.equal(renders, 1, 'watch update bypasses host re-render');
    assert.equal(el.querySelector('p').textContent, 'Count: 1');

    count.set(5);
    await Promise.resolve();
    assert.equal(renders, 1);
    assert.equal(el.querySelector('p').textContent, 'Count: 5');

    document.body.removeChild(el);
  });

  test('teardown on disconnect, no notify after teardown', async () => {
    const tick = signal(0);
    const T = newTag('w-tear');
    class C extends WebComponent {
      render() { return html`<span>${watch(tick)}</span>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('span').textContent, '0');

    document.body.removeChild(el);
    // Removing the element disposes its TemplateInstance which tears
    // down the watch part's watcher. No DOM update happens, no error
    // is thrown.
    tick.set(99);
  });

  test('swapping the signal at the same position rewires the binding (requires re-render)', async () => {
    // The host component re-renders via a reactive property, which
    // calls render() again with a different signal at the same hole.
    // applyWatch detects the swap, disposes the prior watcher, and
    // subscribes the new signal.
    const a = signal('alpha');
    const b = signal('beta');
    const T = newTag('w-swap');
    class C extends WebComponent {
      static properties = { which: { type: String } };
      constructor() { super(); this.which = 'a'; }
      render() {
        const sig = this.which === 'a' ? a : b;
        return html`<i>${watch(sig)}</i>`;
      }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('i').textContent, 'alpha');

    el.which = 'b';
    await el.updateComplete;
    assert.equal(el.querySelector('i').textContent, 'beta');

    // Changing the OLD signal should NOT update the DOM.
    a.set('alpha-2');
    await Promise.resolve();
    assert.equal(el.querySelector('i').textContent, 'beta');

    // Changing the NEW signal updates (defer one microtask).
    b.set('beta-2');
    await Promise.resolve();
    assert.equal(el.querySelector('i').textContent, 'beta-2');

    document.body.removeChild(el);
  });
});
