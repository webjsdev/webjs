/**
 * A bare `${signal}` in a template hole is bound to the signal on the client:
 * a change rewrites just that hole (child, attribute, boolean, interpolated
 * attribute) with no re-render of the host component, as `watch()` does. A
 * `.prop` hole receives the signal object. The last suite runs the same
 * through the BUILT browser bundle, the file `@webjsdev/core` and (since this
 * change) `@webjsdev/core/signals` both resolve to in dist mode, to prove one
 * signal graph drives the component there.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { signal, computed, SignalWatcher } from '../../../src/signal.js';
import { WebComponent } from '../../../src/component.js';
import { watch } from '../../../src/directives.js';

import { assert } from '../../../../../test/browser-assert.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const settle = () => new Promise((r) => setTimeout(r, 0));

suite('bare signals in template holes (client)', () => {
  let container;
  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  teardown(() => container.remove());

  test('child, attribute, boolean and mixed holes update in place', async () => {
    const name = signal('Ada');
    const hide = signal(false);
    const n = computed(() => name.get().length);
    render(html`<p title=${name} class="x ${n} y" ?hidden=${hide}>${name}</p>`, container);
    const p = container.querySelector('p');
    assert.equal(strip(container.innerHTML), '<p title="Ada" class="x 3 y">Ada</p>');
    name.set('Grace');
    hide.set(true);
    await settle();
    assert.equal(container.querySelector('p'), p, 'same element');
    assert.equal(p.getAttribute('title'), 'Grace');
    assert.equal(p.getAttribute('class'), 'x 5 y');
    assert.equal(p.hasAttribute('hidden'), true);
    assert.equal(p.textContent, 'Grace');
  });

  test('watch(signal) binds an attribute hole the same way', async () => {
    const s = signal('a');
    render(html`<p data-v=${watch(s)} class="k ${watch(s)}"></p>`, container);
    const p = container.querySelector('p');
    assert.equal(p.dataset.v, 'a');
    s.set('b');
    await settle();
    assert.equal(p.dataset.v, 'b');
    assert.equal(p.getAttribute('class'), 'k b');
  });

  test('a .prop hole receives the signal object itself', () => {
    const s = signal(1);
    render(html`<div .holder=${s}></div>`, container);
    assert.equal(container.querySelector('div').holder, s);
  });

  test('a signal change updates the hole WITHOUT re-rendering the host', async () => {
    const label = signal('a');
    let renders = 0;
    class BareSignalHost extends SignalWatcher(WebComponent) {
      render() {
        renders++;
        return html`<span data-x=${label}>${label}</span>`;
      }
    }
    BareSignalHost.register('bare-signal-host');
    const el = document.createElement('bare-signal-host');
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(renders, 1);
    label.set('b');
    await settle();
    await el.updateComplete;
    assert.equal(el.querySelector('span').textContent, 'b');
    assert.equal(el.querySelector('span').dataset.x, 'b');
    assert.equal(renders, 1, 'only the holes changed');
  });

  test('swapping a signal hole for a plain value drops the subscription', async () => {
    const s = signal('one');
    const view = (v) => html`<p title=${v}>${v}</p>`;
    render(view(s), container);
    render(view('plain'), container);
    s.set('two');
    await settle();
    assert.equal(strip(container.innerHTML), '<p title="plain">plain</p>');
  });
});

suite('bare signals through the built browser bundle (dist mode)', () => {
  test('a component and a signal from the bundle share one signal graph', async () => {
    const core = await import('../../../dist/webjs-core-browser.js');
    const { html: h, WebComponent: WC, signal: sig, SignalWatcher: SW, watch } = core;
    assert.equal(typeof SW, 'function', 'the bundle carries SignalWatcher (the /signals subpath resolves to it)');
    assert.equal(typeof watch, 'function');
    const count = sig(0);
    class DistSignalHost extends WC {
      render() { return h`<p>${count}|${count.get()}</p>`; }
    }
    DistSignalHost.register('dist-bare-signal-host');
    const el = document.createElement('dist-bare-signal-host');
    document.body.appendChild(el);
    try {
      await el.updateComplete;
      assert.equal(el.querySelector('p').textContent, '0|0');
      count.set(4);
      await settle();
      await el.updateComplete;
      assert.equal(el.querySelector('p').textContent, '4|4', 'the bare hole AND the host re-render both saw the change');
    } finally {
      el.remove();
    }
  });
});
