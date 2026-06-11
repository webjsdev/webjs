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

  test('race guard: the NEW render commits, a later-resolving STALE one is dropped', async () => {
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
    await tick(0);            // first render (v=0) is in flight, gated
    el.v = 1;                 // supersede before v=0 resolves
    await tick(0);
    // Resolve the NEW render FIRST so it commits, THEN the stale one. Without
    // the token guard the late stale resolution would clobber back to v=0.
    gates[1] && gates[1]();
    await el.updateComplete;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'the new render committed');
    gates[0] && gates[0]();   // the stale render resolves last
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'the stale resolution did NOT overwrite the new content');
  });

  test('race guard: an async render superseded by a SYNC render is dropped', async () => {
    // Regression: __renderToken must be stamped for every commit (sync too),
    // or a stale async resolution clobbers a fresh synchronous commit.
    const tag = uniq('async-sync-race');
    let resolveGate;
    class C extends WebComponent {
      static properties = { v: { type: Number } };
      constructor() { super(); this.v = 0; this.sync = false; }
      render() {
        if (this.sync) return html`<p class="val">v=${this.v}</p>`;   // synchronous
        const v = this.v;
        return new Promise((res) => { resolveGate = () => res(html`<p class="val">v=${v}</p>`); });
      }
    }
    C.register(tag);
    const el = document.createElement(tag);
    container().appendChild(el);
    await tick(0);            // first render (v=0) is async, in flight, gated
    el.sync = true;
    el.v = 1;                 // a SYNC cycle that commits v=1 immediately
    await el.updateComplete;
    await tick(0);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'the sync render committed');
    resolveGate();            // the stale async render resolves last
    await tick(5);
    assert.equal(el.querySelector('.val').textContent, 'v=1', 'the stale async resolution did NOT clobber the sync commit');
  });
});
