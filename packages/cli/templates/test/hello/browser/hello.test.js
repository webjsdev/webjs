/**
 * Example browser test: runs in real Chromium via WTR + Playwright.
 *
 * Run:  webjs test --browser
 *       npx wtr
 *
 * Tests here have full access to real browser APIs: Shadow DOM,
 * adoptedStyleSheets, IntersectionObserver, events, etc.
 */

import { html } from '@webjsdev/core';
import { ssrFixture, assertNoA11yViolations } from '@webjsdev/core/testing';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
};

suite('Example browser tests', () => {
  test('DOM is real (not jsdom/linkedom)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    assert.ok(el.isConnected, 'Element should be connected to real DOM');
    el.remove();
  });

  test('Shadow DOM works', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<p>inside shadow</p>';
    assert.ok(shadow.querySelector('p'));
    assert.ok(!host.querySelector('p'), 'Shadow content not in light DOM');
  });

  // ssrFixture() server-renders a template THEN hydrates it in this real
  // browser, awaiting the component's native updateComplete (the real
  // render-cycle promise), so the post-hydration DOM is observable. Use it
  // for any component test where the SSR-then-hydrate round-trip matters.
  test('ssrFixture hydrates a server-rendered button', async () => {
    const el = await ssrFixture(html`<button type="button">Save</button>`);
    assert.equal(el.tagName, 'BUTTON', 'button hydrated');
    assert.ok(el.textContent.includes('Save'), 'rendered label survives hydration');
  });

  // assertNoA11yViolations() is the OPT-IN accessibility assertion. It runs
  // the standard axe-core engine against the element subtree (axe-core is a
  // test-only devDependency, dynamically imported, never shipped to the app
  // runtime). Resolves on a clean element, throws a named violation otherwise.
  test('a button with an accessible name has no a11y violations', async () => {
    const el = await ssrFixture(html`<button type="button">Submit form</button>`);
    await assertNoA11yViolations(el);
  });

  // Replace with your component tests:
  // test('my-widget renders correctly', async () => {
  //   await import('../../components/my-widget.ts');
  //   const el = await ssrFixture(html`<my-widget></my-widget>`);
  //   assert.ok(el.shadowRoot ?? el.firstElementChild);
  //   await assertNoA11yViolations(el);   // opt-in a11y check
  // });
});
