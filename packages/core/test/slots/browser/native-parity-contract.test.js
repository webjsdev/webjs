/**
 * Contract-gap coverage for the native light-DOM slot parity surface (#1021):
 * items the shipped suites claimed but never asserted. Each test pins one
 * spec-shaped behaviour: append-of-last idempotency, slotchange coalescing of
 * SEPARATE mutations, park connectedness (custom-element upgrade + hidden),
 * renderer-driven dynamic slot names, the reconnect sweep's actual purpose
 * (a bypass write made while disconnected), and assign() reversal.
 * Runs in a REAL browser via WTR + Playwright.
 */
import { WebComponent } from '../../../src/component.js';
import { html } from '../../../src/html.js';

import { assert } from '../../../../../test/browser-assert.js';

function tick() {
  return new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
}

let n = 0;
const tagName = (p) => `${p}-${n++}`;

async function mount(tag, render) {
  class C extends WebComponent {
    render() { return render(); }
  }
  C.register(tag);
  const host = document.createElement(tag);
  document.body.appendChild(host);
  await tick();
  return host;
}

suite('Native parity contract gaps', () => {
  test('appendChild of the current LAST child is a true no-op (no slotchange)', async () => {
    const tag = tagName('append-last');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const a = document.createElement('a-el');
      const b = document.createElement('b-el');
      host.appendChild(a);
      host.appendChild(b);
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      let fires = 0;
      slot.addEventListener('slotchange', () => { fires += 1; });
      host.appendChild(b); // already last: assignment must not change
      await tick();
      assert.deepEqual(
        Array.from(slot.children).map((e) => e.tagName.toLowerCase()),
        ['a-el', 'b-el'],
        'order unchanged',
      );
      assert.equal(fires, 0, 'no slotchange for an unchanged assignment');
    } finally {
      host.remove();
    }
  });

  test('N separate mutations in one task coalesce to exactly ONE slotchange', async () => {
    const tag = tagName('coalesce-sep');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const slot = host.querySelector('slot[data-webjs-light]');
      let fires = 0;
      slot.addEventListener('slotchange', () => { fires += 1; });
      // Three SEPARATE interception calls (not one fragment append), the
      // actual native coalescing contract: one microtask, one event.
      host.appendChild(document.createElement('a-el'));
      host.appendChild(document.createElement('b-el'));
      host.appendChild(document.createElement('c-el'));
      await tick();
      assert.equal(slot.children.length, 3, 'all three placed');
      assert.equal(fires, 1, 'exactly one coalesced slotchange');
    } finally {
      host.remove();
    }
  });

  test('a parked child stays connected: nested custom element upgrades, content is hidden', async () => {
    if (!customElements.get('park-upgrade-probe')) {
      class Probe extends HTMLElement {
        connectedCallback() { this.setAttribute('data-connected', ''); }
      }
      customElements.define('park-upgrade-probe', Probe);
    }
    const tag = tagName('park-upgrade');
    const host = await mount(tag, () => html`<div><slot name="only"></slot></div>`);
    try {
      const child = document.createElement('div');
      child.setAttribute('slot', 'unmatched');
      const probe = document.createElement('park-upgrade-probe');
      child.appendChild(probe);
      host.appendChild(child);
      await tick();
      const park = host.querySelector('wj-slot-park');
      assert.ok(park, 'park element exists');
      assert.equal(child.parentElement, park, 'unmatched child parked');
      assert.ok(child.isConnected, 'parked child is connected (native parity)');
      assert.ok(probe.hasAttribute('data-connected'), 'nested custom element upgraded and ran connectedCallback');
      assert.ok(park.hasAttribute('hidden'), 'park is hidden');
      assert.equal(getComputedStyle(park).display, 'none', 'park renders nothing');
    } finally {
      host.remove();
    }
  });

  test('renderer-driven dynamic name=${expr} re-projects on re-render', async () => {
    const tag = tagName('dyn-name');
    class C extends WebComponent({ mode: String }) {
      constructor() { super(); this.mode = 'a'; }
      render() { return html`<div><slot name=${this.mode}></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const childA = document.createElement('em');
    childA.setAttribute('slot', 'a');
    childA.textContent = 'A';
    const childB = document.createElement('strong');
    childB.setAttribute('slot', 'b');
    childB.textContent = 'B';
    host.appendChild(childA);
    host.appendChild(childB);
    document.body.appendChild(host);
    await tick();
    try {
      const slot = host.querySelector('slot[data-webjs-light]');
      assert.ok(slot.contains(childA), 'mode a: child A projected');
      assert.ok(!slot.contains(childB), 'mode a: child B not in the slot');
      host.mode = 'b'; // re-render flips the name attribute via the RENDERER
      await host.updateComplete;
      await tick();
      await tick();
      assert.ok(slot.contains(childB), 'mode b: child B projected after the renderer flip');
      assert.ok(!slot.contains(childA), 'mode b: child A left the slot');
    } finally {
      host.remove();
    }
  });

  test('reconnect sweep folds a raw bypass write made WHILE disconnected', async () => {
    const tag = tagName('sweep-offline');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      host.appendChild(document.createElement('a-el'));
      await tick();
      host.remove(); // sensors torn down
      await tick();
      const late = document.createElement('late-el');
      // Raw native bypass: the prototype method, not the patched instance one.
      Node.prototype.appendChild.call(host, late);
      document.body.appendChild(host); // reconnect triggers the sweep
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      assert.ok(slot.contains(late), 'the while-disconnected bypass write was folded in and projected');
      assert.equal(slot.children.length, 2, 'both children assigned');
    } finally {
      host.remove();
    }
  });

  test('assign() reversal: an empty assign restores name-matched placement', async () => {
    const tag = tagName('assign-revert');
    const host = await mount(tag, () => html`<div><slot></slot><slot name="x"></slot></div>`);
    try {
      const child = document.createElement('span');
      child.setAttribute('slot', 'x');
      host.appendChild(child);
      await tick();
      const slots = host.querySelectorAll('slot[data-webjs-light]');
      const defSlot = slots[0];
      const xSlot = slots[1];
      assert.ok(xSlot.contains(child), 'starts name-matched in slot x');
      defSlot.assign(child);
      await tick();
      assert.ok(defSlot.contains(child), 'manual assign moved it to the default slot');
      defSlot.assign(); // clear the manual assignment
      await tick();
      assert.ok(xSlot.contains(child), 'empty assign restored name matching');
    } finally {
      host.remove();
    }
  });
});
