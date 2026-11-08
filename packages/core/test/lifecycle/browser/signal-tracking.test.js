/**
 * Which signal reads re-render a component (#1677).
 *
 * Every signal the synchronous update cycle reads is tracked, the same span
 * lit-labs/signals tracks: willUpdate, render and the post-commit hooks. The
 * DOM commit is not tracked, so a `watch()` part keeps its fine-grained swap
 * and does not re-render its host. Internal state lives in signals now that
 * the factory refuses `state: true`, and a component commonly derives a host
 * attribute from that state in `updated()`, which a render-only watcher never
 * saw.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal, Signal } from '../../../src/signal.js';
import { watch } from '../../../src/directives.js';

import { assert } from '../../../../../test/browser-assert.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

suite('Signal tracking across the update cycle', () => {
  test('a signal read only in updated() re-runs the cycle when it changes', async () => {
    class SigUpdatedEl extends WebComponent {
      #shown = signal(true);
      get shown() { return this.#shown.get(); }
      set shown(v) { this.#shown.set(v); }
      updated() { this.hidden = !this.shown; }
      render() { return html`<p>content</p>`; }
    }
    customElements.define('sig-track-updated', SigUpdatedEl);
    const el = document.createElement('sig-track-updated');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.hidden, false);
    el.shown = false;
    await tick();
    await el.updateComplete;
    assert.equal(el.hidden, true, 'the host attribute follows the signal');
    el.remove();
  });

  test('a signal read only in willUpdate() re-renders with the derived value', async () => {
    const count = signal(1);
    class SigWillUpdateEl extends WebComponent {
      #label = '';
      willUpdate() { this.#label = `n=${count.get()}`; }
      render() { return html`<p>${this.#label}</p>`; }
    }
    customElements.define('sig-track-willupdate', SigWillUpdateEl);
    const el = document.createElement('sig-track-willupdate');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'n=1');
    count.set(2);
    await tick();
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'n=2');
    el.remove();
  });

  test('a signal written in willUpdate() renders in the same pass', async () => {
    let renders = 0;
    const source = signal('a');
    class SigFoldEl extends WebComponent {
      #derived = signal('');
      willUpdate() { this.#derived.set(source.get().toUpperCase()); }
      render() { renders++; return html`<p>${this.#derived.get()}</p>`; }
    }
    customElements.define('sig-track-fold', SigFoldEl);
    const el = document.createElement('sig-track-fold');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'A');
    renders = 0;
    source.set('b');
    await tick();
    await el.updateComplete;
    await tick();
    assert.equal(el.querySelector('p').textContent, 'B');
    assert.equal(renders, 1, 'the write folds into the cycle that made it');
    el.remove();
  });

  test('a write in updated() re-renders even after willUpdate wrote a tracked signal', async () => {
    // willUpdate's write marks the first watcher; updated() runs under its own,
    // so the first one is re-armed by then and still hears the second write.
    const src = signal('a');
    class SigTwoWritesEl extends WebComponent {
      #picked = signal('');
      #label = signal('');
      willUpdate() { this.#picked.set(src.get()); }
      updated() {
        const want = `${this.#picked.get()}!`;
        if (this.#label.get() !== want) this.#label.set(want);
      }
      render() { return html`<p>${this.#picked.get()}|${this.#label.get()}</p>`; }
    }
    customElements.define('sig-track-two-writes', SigTwoWritesEl);
    const el = document.createElement('sig-track-two-writes');
    document.body.appendChild(el);
    for (let i = 0; i < 4; i++) { await tick(); await el.updateComplete; }
    assert.equal(el.querySelector('p').textContent, 'a|a!');
    src.set('b');
    for (let i = 0; i < 4; i++) { await tick(); await el.updateComplete; }
    assert.equal(el.querySelector('p').textContent, 'b|b!', 'the write updated() made reached the screen');
    el.remove();
  });

  test('a cycle shouldUpdate() skips keeps the signals the last render read', async () => {
    const count = signal(0);
    class SigSkipEl extends WebComponent {
      frozen = false;
      shouldUpdate() { return !this.frozen; }
      render() { return html`<p>${count.get()}</p>`; }
    }
    customElements.define('sig-track-skip', SigSkipEl);
    const el = document.createElement('sig-track-skip');
    document.body.appendChild(el);
    await el.updateComplete;
    el.frozen = true;
    el.requestUpdate();
    await el.updateComplete;
    el.frozen = false;
    count.set(5);
    await tick();
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '5', 'the skipped cycle did not unsubscribe render');
    el.remove();
  });

  test('a listener doing a read-modify-write from an event updated() dispatches does not loop', async () => {
    const log = signal([]);
    const n = signal(0);
    let renders = 0;
    class SigDispatchEl extends WebComponent {
      render() { renders++; return html`<p>${n.get()}</p>`; }
      updated() { this.dispatchEvent(new CustomEvent('sig-changed', { detail: n.get() })); }
    }
    customElements.define('sig-track-dispatch', SigDispatchEl);
    const el = document.createElement('sig-track-dispatch');
    el.addEventListener('sig-changed', (e) => log.set([...log.get(), e.detail]));
    document.body.appendChild(el);
    await el.updateComplete;
    renders = 0;
    n.set(1);
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(renders, 1, 'one render for the one change, not a loop');
    assert.deepEqual(log.get(), [0, 1]);
    el.remove();
  });

  test('a host detached from inside a post-commit hook releases its watchers', async () => {
    const s = signal(1);
    class SigDetachEl extends WebComponent {
      render() { return html`<p>${s.get()}</p>`; }
      firstUpdated() { this.remove(); s.get(); }
    }
    customElements.define('sig-track-detach', SigDetachEl);
    const el = document.createElement('sig-track-detach');
    document.body.appendChild(el);
    await tick();
    await tick();
    assert.equal(el.isConnected, false);
    assert.equal(Signal.subtle.hasSinks(s), false, 'no disposed watcher still holds the signal');
  });

  test('a signal a child constructor reads during the render-error commit is not the host\'s', async () => {
    const store = signal('x');
    let hostRenders = 0;
    class SigChildEl extends WebComponent {
      constructor() { super(); this.seen = store.get(); }
      render() { return html``; }
    }
    customElements.define('sig-track-child', SigChildEl);
    class SigErrorEl extends WebComponent {
      render() { hostRenders++; throw new Error('boom'); }
      renderError() { return html`<sig-track-child></sig-track-child>`; }
    }
    customElements.define('sig-track-error', SigErrorEl);
    const el = document.createElement('sig-track-error');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.ok(el.querySelector('sig-track-child'), 'the error state committed');
    hostRenders = 0;
    store.set('y');
    await tick();
    await tick();
    assert.equal(hostRenders, 0, 'the commit read was untracked');
    el.remove();
  });

  test('a watch() part swaps on its own and does not re-render its host', async () => {
    let renders = 0;
    const value = signal('x');
    class SigWatchEl extends WebComponent {
      render() { renders++; return html`<p>${watch(value)}</p>`; }
    }
    customElements.define('sig-track-watch', SigWatchEl);
    const el = document.createElement('sig-track-watch');
    document.body.appendChild(el);
    await el.updateComplete;
    renders = 0;
    value.set('y');
    await tick();
    await tick();
    assert.equal(el.querySelector('p').textContent, 'y');
    assert.equal(renders, 0, 'the commit reads the signal untracked');
    el.remove();
  });
});
