/**
 * Browser tests for WebComponent + signal integration. Plain reads
 * of `signal.get()` from inside render() should track against the
 * component's built-in SignalWatcher, so any subsequent signal change
 * triggers a re-render through the normal update cycle.
 *
 * For fine-grained reactivity (one hole only, no full re-render),
 * see watch-directive.test.js.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal, computed } from '../../../src/signal.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('WebComponent + signal integration', () => {
  let nextTag = 0;
  const newTag = (base) => `${base}-sigcomp-${++nextTag}`;

  test('signal read in render() schedules a re-render on change', async () => {
    const count = signal(0);
    const T = newTag('sc');
    let renders = 0;
    class C extends WebComponent {
      render() { renders++; return html`<p>Count: ${count.get()}</p>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(renders, 1);
    assert.equal(el.querySelector('p').textContent, 'Count: 0');

    count.set(1);
    await el.updateComplete;
    assert.equal(renders, 2);
    assert.equal(el.querySelector('p').textContent, 'Count: 1');

    count.set(5);
    await el.updateComplete;
    assert.equal(renders, 3);
    assert.equal(el.querySelector('p').textContent, 'Count: 5');

    document.body.removeChild(el);
  });

  test('two components reading the same signal both re-render', async () => {
    const shared = signal('hello');
    const T1 = newTag('sc-a');
    const T2 = newTag('sc-b');
    class A extends WebComponent { render() { return html`<a-text>${shared.get()}</a-text>`; } }
    class B extends WebComponent { render() { return html`<b-text>${shared.get()}</b-text>`; } }
    customElements.define(T1, A);
    customElements.define(T2, B);
    const a = document.createElement(T1);
    const b = document.createElement(T2);
    document.body.append(a, b);
    await Promise.all([a.updateComplete, b.updateComplete]);
    assert.equal(a.querySelector('a-text').textContent, 'hello');
    assert.equal(b.querySelector('b-text').textContent, 'hello');

    shared.set('world');
    await Promise.all([a.updateComplete, b.updateComplete]);
    assert.equal(a.querySelector('a-text').textContent, 'world');
    assert.equal(b.querySelector('b-text').textContent, 'world');

    a.remove();
    b.remove();
  });

  test('signal read NOT in render() does not subscribe the component', async () => {
    const tick = signal(0);
    const T = newTag('sc-no-track');
    let renders = 0;
    class C extends WebComponent {
      connectedCallback() {
        super.connectedCallback();
        // Read OUTSIDE the active render phase. No tracking.
        this.__seen = tick.get();
      }
      render() { renders++; return html`<p>static</p>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(renders, 1);

    tick.set(99);
    await el.updateComplete;
    assert.equal(renders, 1, 'tick was read in connectedCallback (outside render), no re-render');

    document.body.removeChild(el);
  });

  test('dependency tracking is dynamic (drops deps not read in current render)', async () => {
    const a = signal('A');
    const b = signal('B');
    const which = signal('a');
    const T = newTag('sc-dyn');
    let renders = 0;
    class C extends WebComponent {
      render() {
        renders++;
        return html`<p>${which.get() === 'a' ? a.get() : b.get()}</p>`;
      }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'A');
    const initialRenders = renders;

    // Currently reads a + which; b is NOT a dep.
    b.set('B-2');
    await el.updateComplete;
    assert.equal(renders, initialRenders, 'b is not a dep, no re-render');

    // Flip which to read b.
    which.set('b');
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'B-2');

    // Now a is NO LONGER a dep.
    const after = renders;
    a.set('A-2');
    await el.updateComplete;
    assert.equal(renders, after, 'a is no longer a dep after which flipped');

    document.body.removeChild(el);
  });

  test('computed read in render() also tracks transitively', async () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.get() + b.get());
    const T = newTag('sc-comp');
    class C extends WebComponent {
      render() { return html`<p>${sum.get()}</p>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '5');

    a.set(10);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '13');

    b.set(20);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '30');

    document.body.removeChild(el);
  });

  test('disconnect disposes the watcher (no re-render after removal)', async () => {
    const s = signal(0);
    const T = newTag('sc-dispose');
    let renders = 0;
    class C extends WebComponent {
      render() { renders++; return html`<p>${s.get()}</p>`; }
    }
    customElements.define(T, C);
    const el = document.createElement(T);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(renders, 1);

    document.body.removeChild(el);
    s.set(42);
    // No render after disconnect.
    assert.equal(renders, 1);
  });
});
