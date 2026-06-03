/**
 * ssrFixture() hydration + updateComplete tests (#268), real browser via WTR.
 *
 * ssrFixture() server-renders a template, sets the SSR markup into the
 * container so the browser upgrades the custom element, then awaits the
 * element's native `updateComplete` (the real render-cycle promise) instead
 * of a macrotask timer. These tests assert:
 *   1. the post-hydration DOM is correct AND that updateComplete was awaited
 *      (a value only present after the cycle is in the DOM);
 *   2. a hydration-mismatch counterfactual is OBSERVABLE: when SSR and the
 *      client render disagree, the returned hydrated element surfaces the
 *      post-hydration DOM so the divergence is assertable. A passing case
 *      (SSR == hydrated) is paired with the divergence case.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { signal } from '../../../src/signal.js';
import { renderToString } from '../../../src/render-server.js';
import { ssrFixture, waitForUpdate } from '../../../src/testing.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  notEqual: (a, b, msg) => { if (a === b) throw new Error(msg || `Expected values to differ, both were ${JSON.stringify(a)}`); },
};

function normalize(s) {
  return String(s)
    .replace(/<!--webjs-hydrate-->/g, '')
    .replace(/<!--\/?w\$[^>]*-->/g, '')
    .replace(/\s+data-webjs-prop-[a-z0-9-]+="[^"]*"/g, '')
    .replace(/=""/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}
function ssrLightInner(ssr, tag) {
  const m = ssr.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*)</${tag}>`));
  return m ? m[1] : ssr;
}

suite('ssrFixture() (#268)', () => {

  test('hydrates and awaits the native updateComplete', async () => {
    // The component records, inside willUpdate (which runs during the update
    // cycle, not the constructor), a derived value read in render(). If
    // ssrFixture did NOT await the real update cycle, this value would be the
    // constructor placeholder. Its presence proves updateComplete was awaited.
    class SF1 extends WebComponent {
      static properties = { count: { type: Number } };
      constructor() { super(); this.count = 0; this.derived = 'placeholder'; }
      willUpdate() { this.derived = `cycle-${this.count}`; }
      render() { return html`<output>${this.derived}</output>`; }
    }
    SF1.register('ssrf-cycle');

    const el = await ssrFixture(html`<ssrf-cycle count="5"></ssrf-cycle>`);
    // The promise the helper awaits is the element's real updateComplete; assert
    // it is settled (awaiting again resolves synchronously to a truthy value).
    assert.ok(el.updateComplete && typeof el.updateComplete.then === 'function', 'element exposes updateComplete');
    assert.ok(el.innerHTML.includes('cycle-5'), `post-hydration DOM should show the cycle-derived value, got: ${el.innerHTML}`);
    assert.ok(!el.innerHTML.includes('placeholder'), 'constructor placeholder must not survive the awaited update cycle');
  });

  test('passing case: SSR markup equals the hydrated DOM (no mismatch)', async () => {
    const count = signal(7);
    class SF2 extends WebComponent {
      render() { return html`<p class="g">value <strong>${count.get()}</strong></p>`; }
    }
    SF2.register('ssrf-stable');

    const ssr = normalize(ssrLightInner(await renderToString(html`<ssrf-stable></ssrf-stable>`), 'ssrf-stable'));
    const el = await ssrFixture(html`<ssrf-stable></ssrf-stable>`);
    const hydrated = normalize(el.innerHTML);
    assert.equal(hydrated, ssr, `expected SSR == hydrated DOM\nSSR:      ${ssr}\nHYDRATED: ${hydrated}`);
    assert.ok(hydrated.includes('7'), 'value rendered');
  });

  test('counterfactual: a hydration mismatch is observable on the returned element', async () => {
    // This component's render() is non-deterministic: it emits a different
    // value on each call (a module-scope counter). The SSR call (via
    // renderToString, producing the server paint string) and the subsequent
    // client hydration render therefore DISAGREE, which is exactly the
    // hydration-mismatch class of bug. ssrFixture returns the live hydrated
    // element, so comparing the SSR string against el.innerHTML detects the
    // divergence. (Contrast with the passing case above, where SSR == hydrated.)
    let n = 0;
    class SF3 extends WebComponent {
      render() { return html`<span>${++n}</span>`; }
    }
    SF3.register('ssrf-mismatch');

    const ssr = normalize(ssrLightInner(await renderToString(html`<ssrf-mismatch></ssrf-mismatch>`), 'ssrf-mismatch'));
    const el = await ssrFixture(html`<ssrf-mismatch></ssrf-mismatch>`);
    const hydrated = normalize(el.innerHTML);

    // The SSR render produced the first value; the hydration render produced a
    // later one. The helper surfaces a detectable SSR-vs-hydrated divergence.
    assert.notEqual(hydrated, ssr,
      `ssrFixture must surface the post-hydration DOM so a mismatch is observable\nSSR:      ${ssr}\nHYDRATED: ${hydrated}`);
    assert.ok(hydrated.length > 0, 'hydrated DOM is present to compare against');
  });

  test('waitForUpdate awaits the real updateComplete after a mutation', async () => {
    class SF4 extends WebComponent {
      static properties = { n: { type: Number } };
      constructor() { super(); this.n = 1; }
      render() { return html`<i>${this.n}</i>`; }
    }
    SF4.register('ssrf-wait');
    const el = await ssrFixture(html`<ssrf-wait></ssrf-wait>`);
    assert.ok(el.innerHTML.includes('1'), 'initial render');
    el.n = 42;
    await waitForUpdate(el);
    assert.ok(el.innerHTML.includes('42'), `waitForUpdate should settle the re-render, got: ${el.innerHTML}`);
  });
});
