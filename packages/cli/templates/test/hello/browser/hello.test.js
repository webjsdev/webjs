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

  // A REAL `.ts` app component loads here. `webjs test --browser` serves it
  // through the webjs dev pipeline (TypeScript stripped, any `.server.ts`
  // action import rewritten to an RPC stub, `#` aliases resolved), so a
  // component that talks to the server works in a real browser, not just a
  // node test. Point the import at your own component + assert its behaviour.
  test('a real .ts app component loads through the browser harness (#806)', async () => {
    await import('../../../components/theme-toggle.ts');
    const el = document.createElement('theme-toggle');
    document.body.appendChild(el);
    await customElements.whenDefined('theme-toggle');
    assert.ok(el instanceof customElements.get('theme-toggle'), 'the component module loaded and upgraded the element');
    el.remove();
  });

  // Replace with your own component tests, e.g. a component that imports a
  // 'use server' action:
  // test('todo-list adds a row optimistically', async () => {
  //   await import('../../../components/todo-list.ts');  // imports create-todo.server.ts
  //   const el = await ssrFixture(html`<todo-list></todo-list>`);
  //   el.shadowRoot?.querySelector('button')?.click();   // triggers the action RPC
  //   await assertNoA11yViolations(el);
  // });
});
