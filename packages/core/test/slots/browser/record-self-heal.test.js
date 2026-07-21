/**
 * Round-16 review fixes: the record self-heals against legitimate non-record
 * writers (a parent component's hole committed inside a projected slot, a
 * library writing into the assigned container, a raw bypass move), the
 * manual-assignment overlay is honoured everywhere (park step, router seam,
 * last-wins), placement never reparents surviving assigned nodes, and the
 * interceptors keep native error/coercion fidelity for stale-record inputs.
 * Runs in a REAL browser via WTR + Playwright.
 */
import { WebComponent } from '../../../src/component.js';
import { html } from '../../../src/html.js';
import { projectAuthored } from '../../../src/slot.js';

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

/** Shared slotted shell, defined once so every test can run in isolation. */
const fixedShell = 'heal-shell-fixed';
function ensureFixedShell() {
  if (!customElements.get(fixedShell)) {
    class FixedShell extends WebComponent {
      render() { return html`<div class="shell"><slot></slot></div>`; }
    }
    FixedShell.register(fixedShell);
  }
}

suite('Record self-heal + overlay coherence (review round 16)', () => {
  test('a parent hole committed inside the slot SURVIVES a later record-driven apply', async () => {
    // The one-writer seam: the parent's child-part marker projects into the
    // child's slot, so array growth commits divB directly there with no
    // record fold. The author's appendChild must not destroy it.
    ensureFixedShell();
    const parentTag2 = tagName('heal-parent2');
    class Parent2 extends WebComponent({ items: Array }) {
      constructor() { super(); this.items = ['a']; }
      render() {
        return html`<heal-shell-fixed>${this.items.map(
          (i) => html`<p class="item">${i}</p>`,
        )}</heal-shell-fixed>`;
      }
    }
    Parent2.register(parentTag2);
    const parent = document.createElement(parentTag2);
    document.body.appendChild(parent);
    await tick();
    try {
      const shell = parent.querySelector(fixedShell);
      const slot = shell.querySelector('slot[data-webjs-light]');
      assert.equal(slot.querySelectorAll('.item').length, 1, 'one item projected');

      parent.items = ['a', 'b'];
      await parent.updateComplete;
      await tick();
      assert.equal(slot.querySelectorAll('.item').length, 2, 'renderer grew the list inside the slot');

      // The sanctioned author write that used to wipe the renderer's node.
      const extra = document.createElement('aside');
      extra.id = 'author-extra';
      shell.appendChild(extra);
      await tick();
      assert.equal(slot.querySelectorAll('.item').length, 2, 'renderer-committed item SURVIVED the apply');
      assert.ok(slot.querySelector('#author-extra'), 'the author write landed too');

      // The surviving node is still LIVE renderer DOM: a later parent update
      // must reach it (a detached part target would go nowhere).
      parent.items = ['a', 'B2'];
      await parent.updateComplete;
      await tick();
      const texts = Array.from(slot.querySelectorAll('.item')).map((e) => e.textContent);
      assert.deepEqual(texts, ['a', 'B2'], 'the part still updates the surviving node in place');
    } finally {
      parent.remove();
    }
  });

  test('a renderer REMOVAL inside the slot is adopted (no resurrection)', async () => {
    ensureFixedShell();
    const parentTag = tagName('heal-shrink');
    class P extends WebComponent({ items: Array }) {
      constructor() { super(); this.items = ['a', 'b']; }
      render() {
        return html`<heal-shell-fixed>${this.items.map(
          (i) => html`<p class="item">${i}</p>`,
        )}</heal-shell-fixed>`;
      }
    }
    P.register(parentTag);
    const parent = document.createElement(parentTag);
    document.body.appendChild(parent);
    await tick();
    try {
      const shell = parent.querySelector(fixedShell);
      const slot = shell.querySelector('slot[data-webjs-light]');
      assert.equal(slot.querySelectorAll('.item').length, 2, 'two items projected');
      parent.items = ['a'];
      await parent.updateComplete;
      await tick();
      assert.equal(slot.querySelectorAll('.item').length, 1, 'renderer shrank the list');
      shell.appendChild(document.createElement('aside'));
      await tick();
      assert.equal(slot.querySelectorAll('.item').length, 1, 'the removed item was NOT resurrected');
    } finally {
      parent.remove();
    }
  });

  test('a library write into the assigned container survives the next apply', async () => {
    const tag = tagName('lib-write');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      host.appendChild(document.createElement('em'));
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      // The documented target for generic DOM libraries: the assigned
      // container, NOT the host. A sortable/virtualizer writing here is a
      // legitimate non-record writer.
      const libNode = document.createElement('u');
      libNode.id = 'lib-node';
      slot.appendChild(libNode);
      host.appendChild(document.createElement('strong'));
      await tick();
      assert.ok(slot.querySelector('#lib-node'), 'the library node survived the record-driven apply');
      assert.equal(slot.children.length, 3, 'em + lib node + strong all present');
    } finally {
      host.remove();
    }
  });

  test('assign() of an attribute-less node onto a NAMED slot sticks (no self-park)', async () => {
    const tag = tagName('assign-named');
    const host = await mount(tag, () => html`<div><slot name="x"></slot></div>`);
    try {
      const div = document.createElement('div');
      div.id = 'no-attr';
      host.appendChild(div); // no slot attribute, no default slot: parked
      await tick();
      const xSlot = host.querySelector('slot[name="x"]');
      assert.ok(!xSlot.contains(div), 'starts parked (no matching name)');
      xSlot.assign(div);
      await tick();
      assert.equal(div.parentElement, xSlot, 'manual assign placed it in slot x');
      // A later unrelated apply must not park it back out (the park step now
      // uses the same effective key as repartition).
      host.appendChild(document.createElement('span'));
      await tick();
      assert.equal(div.parentElement, xSlot, 'STAYED in slot x across the next apply');
    } finally {
      host.remove();
    }
  });

  test('appending a sibling never reparents surviving assigned nodes', async () => {
    if (!customElements.get('reparent-probe')) {
      class Probe extends HTMLElement {
        constructor() { super(); this.connects = 0; }
        connectedCallback() { this.connects += 1; }
      }
      customElements.define('reparent-probe', Probe);
    }
    const tag = tagName('no-reparent');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const a = document.createElement('a-el');
      const probe = document.createElement('reparent-probe');
      const c = document.createElement('c-el');
      host.append(a, probe, c);
      await tick();
      assert.equal(probe.connects, 1, 'probe connected once on placement');
      host.appendChild(document.createElement('d-el'));
      await tick();
      assert.equal(probe.connects, 1, 'appending d did NOT bounce the probe through disconnect/connect');
      const slot = host.querySelector('slot[data-webjs-light]');
      assert.equal(slot.children.length, 4, 'all four assigned');
    } finally {
      host.remove();
    }
  });

  test('a raw bypass MOVE back onto the host is repaired with no slotchange', async () => {
    const tag = tagName('bypass-move');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const child = document.createElement('p');
      host.appendChild(child);
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      assert.equal(child.parentElement, slot, 'projected');
      let fires = 0;
      slot.addEventListener('slotchange', () => { fires += 1; });
      // Raw native call: moves the node from the slot to a direct host child,
      // observed only by the backstop.
      Node.prototype.appendChild.call(host, child);
      assert.equal(child.parentElement, host, 'bypass-moved to a direct host child');
      await tick();
      await tick();
      assert.equal(child.parentElement, slot, 'repaired back into the slot');
      assert.equal(fires, 0, 'no slotchange: the assigned SET never changed');
    } finally {
      host.remove();
    }
  });

  test('slotchange fires for a mutation made while the host is disconnected', async () => {
    const tag = tagName('detached-change');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      host.appendChild(document.createElement('em'));
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      let fires = 0;
      slot.addEventListener('slotchange', () => { fires += 1; });
      host.remove();
      host.appendChild(document.createElement('strong')); // interception is live for life
      await tick();
      assert.equal(fires, 1, 'the event was delivered, not silently dropped');
      assert.equal(slot.children.length, 2, 'assignment applied while disconnected');
    } finally {
      host.remove();
    }
  });

  test('manual assignment is LAST-assign-wins across slots', async () => {
    const tag = tagName('last-wins');
    const host = await mount(tag, () => html`<div><slot name="a"></slot><slot name="b"></slot></div>`);
    try {
      const slotA = host.querySelector('slot[name="a"]');
      const slotB = host.querySelector('slot[name="b"]');
      const child = document.createElement('x-el');
      host.appendChild(child);
      slotA.assign(child);
      await tick();
      assert.equal(child.parentElement, slotA, 'assigned to a');
      slotB.assign(child);
      await tick();
      assert.equal(child.parentElement, slotB, 'the LATER assign wins (native semantics)');
    } finally {
      host.remove();
    }
  });

  test('append(42) coerces to the text "42" (WebIDL Node-or-DOMString)', async () => {
    const tag = tagName('coerce');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      host.append(42, null);
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      assert.equal(slot.textContent, '42null', 'non-Node args stringified like native');
    } finally {
      host.remove();
    }
  });

  test('an orphan light slot reports NO assigned nodes', async () => {
    const orphan = document.createElement('slot');
    orphan.setAttribute('data-webjs-light', '');
    orphan.textContent = 'fallback';
    document.body.appendChild(orphan);
    try {
      assert.deepEqual(orphan.assignedNodes(), [], 'no data-projection means nothing is assigned');
    } finally {
      orphan.remove();
    }
  });

  test('removeChild of a node bypass-moved into a fragment throws NotFoundError', async () => {
    const tag = tagName('stale-remove');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const child = document.createElement('p');
      host.appendChild(child);
      await tick();
      document.createDocumentFragment().appendChild(child); // out-of-band move
      let threw = null;
      try { host.removeChild(child); } catch (e) { threw = e; }
      assert.equal(threw && threw.name, 'NotFoundError', 'native fidelity for a stale record entry');
    } finally {
      host.remove();
    }
  });

  test('router projectAuthored on the default slice leaves a manual assignment intact', async () => {
    const tag = tagName('proj-manual');
    const host = await mount(tag, () => html`<div><slot></slot><slot name="x"></slot></div>`);
    try {
      const slots = host.querySelectorAll('slot[data-webjs-light]');
      const xSlot = slots[1];
      const div = document.createElement('div');
      div.id = 'manual-div';
      host.appendChild(div); // attribute-less: default slice
      await tick();
      xSlot.assign(div);
      await tick();
      assert.equal(div.parentElement, xSlot, 'manually assigned into x');
      // The router's seam replacing the DEFAULT slice must key by the
      // effective assignment, not the raw attribute, or it evicts the
      // manually-assigned node.
      const p = document.createElement('p');
      projectAuthored(host, null, [p]);
      await tick();
      assert.equal(div.parentElement, xSlot, 'the manual assignment survived the default-slice projection');
      assert.ok(slots[0].contains(p), 'the projected default content landed');
    } finally {
      host.remove();
    }
  });
});
