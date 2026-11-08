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
import { html } from '../../../src/html.js';
import { WebComponent, prop } from '../../../src/component.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('Lifecycle hooks in a real browser', () => {

  test('updateComplete resolves after the real DOM commit', async () => {
    class LcUcEl extends WebComponent({ v: Number }) {
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
    class LcSuEl extends WebComponent({ x: Number }) {
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
    class LcWuEl extends WebComponent({
      a: Number,
      b: prop(Number, { state: true }),
    }) {
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
    class LcUdEl extends WebComponent({ tall: Boolean }) {
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
    class LcFuEl extends WebComponent({ v: Number }) {
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


  test('getUpdateComplete override chains additional work', async () => {
    let extraDone = false;
    class LcGcEl extends WebComponent({ v: Number }) {
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

  test('throwing willUpdate does NOT deadlock the component', async () => {
    let willThrows = true;
    class LcThrowEl extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      willUpdate() {
        if (willThrows) {
          willThrows = false;
          throw new Error('willUpdate boom');
        }
      }
      render() { return html`<p>v=${this.v}</p>`; }
    }
    customElements.define('lc-throw-1', LcThrowEl);
    const el = document.createElement('lc-throw-1');
    document.body.appendChild(el);

    // First update: willUpdate throws. The component should NOT deadlock.
    let firstCompleted = false;
    try {
      await Promise.race([
        el.updateComplete.then(() => { firstCompleted = true; }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('deadlock')), 200)),
      ]);
    } catch (e) {
      if (e.message === 'deadlock') throw e;
    }
    assert.ok(firstCompleted, 'updateComplete resolved even after willUpdate throw');

    // Second update: willUpdate no longer throws. Component must render.
    el.v = 42;
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'v=42');
    el.remove();
  });

  test('shouldUpdate=false preserves changedProperties for the next cycle', async () => {
    let allow = false;
    const seen = [];
    class LcGateEl extends WebComponent({
      a: Number,
      b: Number,
    }) {
      constructor() { super(); this.a = 0; this.b = 0; }
      shouldUpdate() { return allow; }
      updated(cp) { seen.push([...cp.keys()].sort()); }
      render() { return html`<p>a=${this.a},b=${this.b}</p>`; }
    }
    customElements.define('lc-gate-1', LcGateEl);
    const el = document.createElement('lc-gate-1');
    document.body.appendChild(el);
    // Initial render is gated.
    await el.updateComplete;
    assert.deepEqual(seen, []);  // shouldUpdate=false from the start

    // Make changes while gated.
    el.a = 1;
    await el.updateComplete;
    el.b = 2;
    await el.updateComplete;
    assert.deepEqual(seen, []);  // still gated

    // Open the gate. The next cycle should see BOTH 'a' and 'b' (plus any
    // initial entries) in changedProperties, because they were preserved
    // across the gated cycles.
    allow = true;
    el.a = 3;
    await el.updateComplete;
    const lastKeys = seen[seen.length - 1];
    assert.ok(lastKeys.includes('a'), 'a was preserved');
    assert.ok(lastKeys.includes('b'), 'b was preserved');
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
