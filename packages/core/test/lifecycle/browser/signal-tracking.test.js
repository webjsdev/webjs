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
import { signal } from '../../../src/signal.js';
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
