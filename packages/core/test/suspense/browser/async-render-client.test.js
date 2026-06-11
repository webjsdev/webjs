/**
 * Client half of bare-await async render (#469), real browser via WTR.
 *
 * Covers the stale-while-revalidate default, the renderFallback() override
 * (re-fetch only, never first paint), per-component renderError isolation,
 * and the superseding-render race guard.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';

const { suite, test } = window.Mocha ? Mocha : { suite, test };
const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
};

let host;
function container() {
  if (host) host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const uniq = (p) => `${p}-${++n}`;

suite('async render() on the client', () => {
  test('awaits render() and commits the resolved template', async () => {
    const tag = uniq('async-basic');
    class C extends WebComponent {
      async render() {
        await tick(5);
        return html`<p class="loaded">done</p>`;
      }
    }
    C.register(tag);
    const el = document.createElement(tag);
    container().appendChild(el);
    await el.updateComplete;
    await tick(0);
    assert.ok(el.querySelector('.loaded'), 'resolved template committed');
    assert.equal(el.querySelector('.loaded').textContent, 'done');
  });

  test('stale-while-revalidate: prior content stays during a re-fetch (no renderFallback)', async () => {
    const tag = uniq('async-swr');
    let resolveGate;
    class C extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 1; this.gate = null; }
      async render() {
        const v = this.v;
        if (this.gate) await this.gate;
        return html`<p class="val">v=${v}</p>`;
      }
    }
    C.register(tag);
    const el = document.createElement(tag);
    container().appendChild(el);
    await el.updateComplete;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'first render committed');

    // Trigger a re-fetch that hangs on a gate; the OLD content must persist.
    el.gate = new Promise((res) => { resolveGate = res; });
    el.v = 2;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'stale content stays during the re-fetch');
    resolveGate();
    await el.updateComplete;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=2', 'new content commits when the fetch resolves');
  });

  test('renderFallback() shows a loading state during a re-fetch, never on first paint', async () => {
    const tag = uniq('async-fallback');
    let resolveGate;
    class C extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 1; this.gate = null; }
      renderFallback() { return html`<p class="skeleton">loading…</p>`; }
      async render() {
        const v = this.v;
        if (this.gate) await this.gate;
        return html`<p class="val">v=${v}</p>`;
      }
    }
    C.register(tag);
    const el = document.createElement(tag);
    container().appendChild(el);
    await el.updateComplete;
    await tick(0);
    // First paint: NO fallback, the resolved value instead.
    assert.ok(!el.querySelector('.skeleton'), 'no fallback on first paint');
    assert.equal(el.querySelector('.val').textContent, 'v=1');

    // Re-fetch: the fallback replaces the stale content while loading.
    el.gate = new Promise((res) => { resolveGate = res; });
    el.v = 2;
    await tick(0);
    assert.ok(el.querySelector('.skeleton'), 'fallback shown during the re-fetch');
    assert.ok(!el.querySelector('.val'), 'stale content replaced by the fallback');
    resolveGate();
    await el.updateComplete;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=2', 'real content replaces the fallback');
  });

  test('a rejected async render renders renderError(), the element survives', async () => {
    const tag = uniq('async-err');
    const origError = console.error;
    console.error = () => {};
    try {
      class C extends WebComponent {
        async render() { await tick(2); throw new Error('boom'); }
        renderError(e) { return html`<p class="err">${e.message}</p>`; }
      }
      C.register(tag);
      const el = document.createElement(tag);
      container().appendChild(el);
      await el.updateComplete;
      await tick(5);
      assert.ok(el.querySelector('.err'), 'renderError committed');
      assert.equal(el.querySelector('.err').textContent, 'boom');
    } finally {
      console.error = origError;
    }
  });

  test('race guard: a superseding render wins, the stale resolution is dropped', async () => {
    const tag = uniq('async-race');
    const gates = [];
    class C extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 0; }
      async render() {
        const v = this.v;
        await new Promise((res) => { gates[v] = res; });
        return html`<p class="val">v=${v}</p>`;
      }
    }
    C.register(tag);
    const el = document.createElement(tag);
    container().appendChild(el);
    // First render (v=0) is in flight, gated.
    await tick(0);
    el.v = 1; // supersede before v=0 resolves
    await tick(0);
    // Resolve the STALE render first, then the new one.
    gates[0] && gates[0]();
    await tick(0);
    gates[1] && gates[1]();
    await el.updateComplete;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'the latest render wins regardless of resolution order');
  });
});
