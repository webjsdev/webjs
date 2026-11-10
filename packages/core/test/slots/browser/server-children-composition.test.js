/**
 * Server-only content composed into a client component (#1686), the Next.js
 * rule for a client component rendering a server component: it cannot import
 * or render one itself, but the server parent passes it in as children.
 *
 * In WebJs the server parent is a page, the server-only piece is a component
 * defined in a `*.server.ts` file (rendered on the server, never defined in
 * the browser), and the hand-off is a `<slot>`. This proves the SSR'd
 * server-only markup survives the client component's hydration and its later
 * client re-renders by node identity, so the composition holds.
 *
 * Runs in a REAL browser via WTR + Playwright.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { installSlotPolyfills } from '../../../src/slot.js';

installSlotPolyfills();

import { assert } from '../../../../../test/browser-assert.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
let n = 0;

suite('a server-only component composed into a client component through <slot> (#1686)', () => {
  test('the server-rendered child survives hydration and every client re-render', async () => {
    const tag = `x-sc-tabs-${++n}`;
    // What the server sends: the client host already SSR'd around its slot,
    // and inside the slot the server-only <user-card> with its rendered markup.
    const ssr =
      '<!--webjs-hydrate--><div class="tabs"><span class="active">0</span>' +
      '<slot data-webjs-light data-projection="actual">' +
      '<user-card name="Ada" data-wj-host><!--webjs-hydrate--><div class="card"><b>Ada</b></div></user-card>' +
      '</slot></div>';
    const box = document.createElement('div');
    document.body.appendChild(box);
    box.innerHTML = `<${tag}>${ssr}</${tag}>`;
    const host = /** @type {any} */ (box.firstElementChild);
    const card = host.querySelector('user-card');
    const removed = [];
    const mo = new MutationObserver((records) => {
      for (const r of records) for (const node of r.removedNodes) if (node === card || node.contains?.(card)) removed.push(node);
    });
    mo.observe(host, { childList: true, subtree: true });

    class Tabs extends WebComponent {
      static properties = { active: { type: Number } };
      constructor() { super(); this.active = 0; }
      render() { return html`<div class="tabs"><span class="active">${this.active}</span><slot></slot></div>`; }
    }
    Tabs.register(tag);
    await tick();
    await host.updateComplete;

    assert.equal(customElements.get('user-card'), undefined, 'the server-only element is never defined in the browser');
    assert.equal(host.querySelector('user-card'), card, 'hydration kept the server-rendered child');

    for (const value of [1, 2]) {
      host.active = value;
      await host.updateComplete;
      assert.equal(host.querySelector('.active').textContent, String(value), `the client component re-rendered (${value})`);
      assert.equal(host.querySelector('user-card'), card, `the same server-rendered node is still projected (${value})`);
      assert.equal(card.querySelector('.card b').textContent, 'Ada', `its server markup is intact (${value})`);
    }
    await tick();
    mo.disconnect();
    assert.deepEqual(removed, [], 'the server-rendered child never left the document');
    const slot = host.querySelector('slot');
    assert.deepEqual(slot.assignedElements(), [card], 'the slot still reports it as assigned');
    box.remove();
  });
});
