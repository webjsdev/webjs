/**
 * Real-browser tests for the lit-aligned lifecycle hooks added in Phase 2
 * of the lit-API parity initiative (shouldUpdate, willUpdate, update,
 * updated, firstUpdated(changedProperties), updateComplete,
 * getUpdateComplete).
 *
 * Companion to test/component-lifecycle.test.js (linkedom unit tests).
 * Runs in real Chromium via WTR + Playwright so we exercise the actual
 * microtask scheduling, customElements upgrade timing, and DOM commit
 * paths that linkedom doesn't replicate.
 */
import { html } from '../../packages/core/src/html.js';
import { WebComponent } from '../../packages/core/src/component.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  deepEqual: (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(msg || `deepEqual failed: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    }
  },
};

suite('Lifecycle hooks in a real browser', () => {

  test('updateComplete resolves after the real DOM commit', async () => {
    class LcUcEl extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 0; }
      render() { return html`<p>v=${this.v}</p>`; }
    }
    customElements.define('lc-uc-1', LcUcEl);
    const el = document.createElement('lc-uc-1');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'v=0');

    el.v = 42;
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'v=42');
    el.remove();
  });

  test('shouldUpdate=false in real browser skips the DOM commit', async () => {
    let renders = 0;
    class LcSuEl extends WebComponent {
      static properties = { x: { type: Number } };
      constructor() { super(); this.x = 0; }
      shouldUpdate() { return this.x !== 99; }
      render() { renders++; return html`<p>x=${this.x}</p>`; }
    }
    customElements.define('lc-su-1', LcSuEl);
    const el = document.createElement('lc-su-1');
    document.body.appendChild(el);
    await el.updateComplete;
    const baselineRenders = renders;
    assert.equal(el.querySelector('p').textContent, 'x=0');

    el.x = 99;
    await el.updateComplete;
    assert.equal(renders, baselineRenders);
    // DOM still shows the prior render.
    assert.equal(el.querySelector('p').textContent, 'x=0');
    el.remove();
  });

  test('willUpdate mutations fold into the same render (no second microtask)', async () => {
    let renders = 0;
    class LcWuEl extends WebComponent {
      static properties = {
        a: { type: Number },
        b: { type: Number, state: true },
      };
      constructor() { super(); this.a = 0; this.b = -1; }
      willUpdate(cp) {
        if (cp.has('a')) this.b = this.a * 2;
      }
      render() { renders++; return html`<p>a=${this.a},b=${this.b}</p>`; }
    }
    customElements.define('lc-wu-1', LcWuEl);
    const el = document.createElement('lc-wu-1');
    document.body.appendChild(el);
    await el.updateComplete;
    const baseline = renders;

    el.a = 7;
    await el.updateComplete;
    assert.equal(el.b, 14);
    assert.equal(el.querySelector('p').textContent, 'a=7,b=14');
    // Exactly one new render.
    assert.equal(renders - baseline, 1);
    el.remove();
  });

  test('updated() runs after the DOM is live; can read post-render layout', async () => {
    let measured = null;
    class LcUdEl extends WebComponent {
      static properties = { tall: { type: Boolean } };
      constructor() { super(); this.tall = false; }
      updated(cp) {
        if (cp.has('tall')) {
          measured = this.querySelector('div').offsetHeight;
        }
      }
      render() {
        return html`<div style=${`height:${this.tall ? 200 : 50}px`}>content</div>`;
      }
    }
    customElements.define('lc-ud-1', LcUdEl);
    const el = document.createElement('lc-ud-1');
    document.body.appendChild(el);
    await el.updateComplete;
    const initialHeight = measured;
    assert.ok(initialHeight === 50 || initialHeight === undefined,
      `Initial height should be 50px or undefined (first paint), got ${initialHeight}`);

    el.tall = true;
    await el.updateComplete;
    // Now the post-render measurement should reflect the live DOM.
    assert.equal(measured, 200);
    el.remove();
  });

  test('firstUpdated runs once even across multiple updates', async () => {
    let firsts = 0;
    class LcFuEl extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 0; }
      firstUpdated() { firsts++; }
      render() { return html`<p>${this.v}</p>`; }
    }
    customElements.define('lc-fu-1', LcFuEl);
    const el = document.createElement('lc-fu-1');
    document.body.appendChild(el);
    await el.updateComplete;
    el.v = 1; await el.updateComplete;
    el.v = 2; await el.updateComplete;
    el.v = 3; await el.updateComplete;
    assert.equal(firsts, 1);
    el.remove();
  });

  test('setState routes through changedProperties (key "state", oldValue is prior bag)', async () => {
    let captured = null;
    class LcSsEl extends WebComponent {
      constructor() { super(); this.state = { count: 1 }; }
      updated(cp) {
        if (cp.has('state')) captured = cp.get('state');
      }
      render() { return html`<p>${this.state.count}</p>`; }
    }
    customElements.define('lc-ss-1', LcSsEl);
    const el = document.createElement('lc-ss-1');
    document.body.appendChild(el);
    await el.updateComplete;
    captured = null;

    el.setState({ count: 2 });
    await el.updateComplete;
    assert.deepEqual(captured, { count: 1 });
    assert.equal(el.querySelector('p').textContent, '2');
    el.remove();
  });

  test('getUpdateComplete override chains additional work', async () => {
    let extraDone = false;
    class LcGcEl extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 0; }
      async getUpdateComplete() {
        const r = await super.getUpdateComplete();
        await new Promise(res => setTimeout(res, 10));
        extraDone = true;
        return r;
      }
      render() { return html`<p>${this.v}</p>`; }
    }
    customElements.define('lc-gc-1', LcGcEl);
    const el = document.createElement('lc-gc-1');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.ok(extraDone, 'Override ran extra work before updateComplete settled');
    el.remove();
  });

  test('ReactiveController with lit hostConnected/hostUpdate/hostUpdated/hostDisconnected', async () => {
    const order = [];
    const controller = {
      hostConnected() { order.push('hostConnected'); },
      hostUpdate() { order.push('hostUpdate'); },
      hostUpdated() { order.push('hostUpdated'); },
      hostDisconnected() { order.push('hostDisconnected'); },
    };
    class LcCtEl extends WebComponent {
      constructor() { super(); this.addController(controller); }
      render() { return html`<p>ok</p>`; }
    }
    customElements.define('lc-ct-1', LcCtEl);
    const el = document.createElement('lc-ct-1');
    document.body.appendChild(el);
    await el.updateComplete;
    el.remove();
    // Allow the disconnectedCallback's host.disconnected propagation.
    await new Promise(r => requestAnimationFrame(r));
    assert.ok(order.includes('hostConnected'), 'hostConnected fired');
    assert.ok(order.includes('hostUpdate'), 'hostUpdate fired');
    assert.ok(order.includes('hostUpdated'), 'hostUpdated fired');
    assert.ok(order.includes('hostDisconnected'), 'hostDisconnected fired');
  });
});
