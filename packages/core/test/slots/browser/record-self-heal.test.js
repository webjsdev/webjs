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
import { repeat, cache, asyncAppend } from '../../../src/directives.js';
import { projectAuthored } from '../../../src/slot.js';

import { assert } from '../../../../../test/browser-assert.js';

function tick() {
  return new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
}

/** Bounded poll so async-path tests never race a loaded CI runner. */
async function waitFor(cond, budgetMs = 2000) {
  const start = Date.now();
  while (!cond() && Date.now() - start < budgetMs) {
    await new Promise((r) => setTimeout(r, 10));
  }
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

  test('a write during the unfinalized-slot window does not corrupt the record (nested-template slot)', async () => {
    // A slot inside a NESTED TemplateResult hole gets its slot-part finalize
    // deferred one microtask on the first client render. A write landing in
    // that window (firstUpdated is the canonical author spot) used to treat
    // the unfinalized slot as fallback-mode: it destroyed the compiled
    // fallback, then the deferred finalize hijacked the placed nodes as
    // "fallback", leaving visible-but-record-dead content.
    const tag = tagName('unfinalized-write');
    class C extends WebComponent {
      firstUpdated() {
        const el = document.createElement('mark');
        el.textContent = 'window-write';
        this.appendChild(el);
      }
      render() {
        return html`<div>${html`<slot>compiled fallback</slot>`}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    await tick();
    try {
      const slot = host.querySelector('slot[data-webjs-light]');
      assert.equal(slot.getAttribute('data-projection'), 'actual', 'slot settled as ACTUAL');
      const assigned = slot.assignedNodes();
      assert.ok(
        assigned.some((n) => n.textContent === 'window-write'),
        'the window write is record-live (assignedNodes sees it)',
      );
      assert.ok(!slot.textContent.includes('compiled fallback'), 'fallback not shown with content present');
      // The fallback must have SURVIVED (not been destroyed): remove the
      // content and the compiled fallback must come back.
      const el = assigned.find((n) => n.textContent === 'window-write');
      host.removeChild(el);
      await tick();
      assert.ok(slot.textContent.includes('compiled fallback'), 'compiled fallback restored after removal');
    } finally {
      host.remove();
    }
  });

  test('an author write does not revert a pending renderer reorder of OTHER nodes', async () => {
    // Node-scoped order authority: the parent reorders a keyed list inside
    // the shell's slot (no apply fires), then the author appends a banner.
    // The append must land at the end WITHOUT fighting the reorder back.
    ensureFixedShell();
    const parentTag = tagName('reorder-keep');
    class P extends WebComponent({ items: Array }) {
      constructor() { super(); this.items = ['a', 'b']; }
      render() {
        return html`<heal-shell-fixed>${repeat(
          this.items,
          (i) => i,
          (i) => html`<p class="item">${i}</p>`,
        )}</heal-shell-fixed>`;
      }
    }
    P.register(parentTag);
    const parent = document.createElement(parentTag);
    document.body.appendChild(parent);
    await tick();
    try {
      const shell = parent.querySelector('heal-shell-fixed');
      const slot = shell.querySelector('slot[data-webjs-light]');
      parent.items = ['b', 'a']; // keyed reorder INSIDE the slot
      await parent.updateComplete;
      await tick();
      assert.deepEqual(
        Array.from(slot.querySelectorAll('.item')).map((e) => e.textContent),
        ['b', 'a'],
        'renderer reordered in place',
      );
      const banner = document.createElement('aside');
      banner.id = 'kept-banner';
      shell.appendChild(banner); // the record op that used to revert the order
      await tick();
      assert.deepEqual(
        Array.from(slot.querySelectorAll('.item')).map((e) => e.textContent),
        ['b', 'a'],
        'the reorder SURVIVED the author write',
      );
      assert.ok(slot.querySelector('#kept-banner'), 'the banner landed');
      assert.equal(slot.lastElementChild.id, 'kept-banner', 'appended at the end');
    } finally {
      parent.remove();
    }
  });

  test('appendChild of a non-Node throws TypeError with zero record change', async () => {
    const tag = tagName('arg-validity');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      host.appendChild(document.createElement('em'));
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      let threw = null;
      try { host.appendChild(/** @type {any} */ ({})); } catch (e) { threw = e; }
      assert.ok(threw instanceof TypeError, 'TypeError like native');
      assert.equal(slot.children.length, 1, 'record and placement untouched');
      host.appendChild(document.createElement('strong')); // still functional
      assert.equal(slot.children.length, 2, 'later writes unaffected');
    } finally {
      host.remove();
    }
  });

  test('assign() on the SECOND duplicate slot targets that element', async () => {
    const tag = tagName('dup-assign');
    const host = await mount(tag, () => html`<div><slot name="x"></slot><slot name="x"></slot></div>`);
    try {
      const dupes = host.querySelectorAll('slot[name="x"]');
      const child = document.createElement('span');
      host.appendChild(child);
      dupes[1].assign(child);
      await tick();
      assert.equal(child.parentElement, dupes[1], 'manual assignment bound to the RECEIVING element');
      assert.ok(!dupes[0].contains(child), 'not routed to the first-wins duplicate');
    } finally {
      host.remove();
    }
  });

  test('assign() before the node is a child is honoured on the later append', async () => {
    const tag = tagName('assign-first');
    const host = await mount(tag, () => html`<div><slot></slot><slot name="x"></slot></div>`);
    try {
      const slots = host.querySelectorAll('slot[data-webjs-light]');
      const xSlot = slots[1];
      const node = document.createElement('span'); // detached, no slot attr
      xSlot.assign(node); // native-legal ordering: assign first
      host.appendChild(node); // append later
      await tick();
      assert.equal(node.parentElement, xSlot, 'the earlier manual assignment routed the append');
    } finally {
      host.remove();
    }
  });

  test('a manual assignment to a TORN-DOWN slot element goes dormant, not lost', async () => {
    // Element-keyed assign() + a conditional re-render that disposes and
    // recreates the slot: the dead element must not keep excluding the node
    // from every slot (permanent limbo). The node falls back to attribute
    // routing (here: parked, connected) while the entry stays dormant.
    const tag = tagName('dead-target');
    class C extends WebComponent({ open: Boolean }) {
      constructor() { super(); this.open = true; }
      render() {
        return this.open
          ? html`<div><slot name="x"></slot></div>`
          : html`<div>closed</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    try {
      const oldSlot = host.querySelector('slot[name="x"]');
      const node = document.createElement('span');
      node.id = 'dormant-node';
      host.appendChild(node); // no slot attr
      oldSlot.assign(node);
      await tick();
      assert.equal(node.parentElement, oldSlot, 'manually assigned');
      host.open = false; // tears the slot down
      await host.updateComplete;
      await tick();
      host.open = true; // recreates a NEW slot element with the same name
      await host.updateComplete;
      await tick();
      await tick();
      assert.ok(node.isConnected, 'node still connected (not lost in limbo)');
      // The dead-element entry is dormant: the attribute-less node parks
      // (native unassigned-but-connected) rather than vanishing.
      assert.equal(
        node.parentElement.tagName.toLowerCase(),
        'wj-slot-park',
        'fell back to attribute routing (parked)',
      );
    } finally {
      host.remove();
    }
  });

  test('content written in the unfinalized window is placed with NO park bounce', async () => {
    if (!customElements.get('reparent-probe')) {
      class Probe extends HTMLElement {
        constructor() { super(); this.connects = 0; }
        connectedCallback() { this.connects += 1; }
      }
      customElements.define('reparent-probe', Probe);
    }
    const tag = tagName('window-probe');
    class C extends WebComponent {
      firstUpdated() {
        const probe = document.createElement('reparent-probe');
        this.appendChild(probe);
      }
      render() {
        return html`<div>${html`<slot></slot>`}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    await tick();
    try {
      const probe = host.querySelector('reparent-probe');
      assert.ok(probe, 'probe placed');
      assert.equal(probe.parentElement.tagName.toLowerCase(), 'slot', 'in the slot');
      assert.equal(
        /** @type {any} */ (probe).connects,
        1,
        'connected exactly once: never bounced through the park while the slot was pending',
      );
    } finally {
      host.remove();
    }
  });

  test('replaceChildren fully replaces even when a third writer diverged the slot', async () => {
    const tag = tagName('wholesale-diverge');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const a = document.createElement('a-el');
      host.appendChild(a);
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      // Third-writer divergence: a library node directly in the container.
      const lib = document.createElement('u');
      lib.id = 'lib';
      slot.appendChild(lib);
      // Wholesale replacement: the displaced children must NOT resurrect.
      const fresh = document.createElement('strong');
      host.replaceChildren(fresh);
      await tick();
      assert.ok(!slot.contains(a), 'displaced child did not resurrect');
      assert.ok(slot.contains(fresh), 'new content placed');
      assert.ok(slot.contains(lib), 'the third writer node was folded, not destroyed');
    } finally {
      host.remove();
    }
  });

  test('removeChild drops the node even when a renderer write diverged the slot', async () => {
    const tag = tagName('remove-diverge');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      const a = document.createElement('a-el');
      const b = document.createElement('b-el');
      host.append(a, b);
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      slot.appendChild(document.createElement('u')); // divergence
      host.removeChild(a);
      await tick();
      assert.ok(!slot.contains(a), 'removed node is gone (not resurrected by the resync)');
      assert.ok(!a.isConnected, 'detached like native');
      assert.ok(slot.contains(b), 'sibling intact');
    } finally {
      host.remove();
    }
  });

  test('a rename of the receiving slot carries its manual assignment along', async () => {
    const tag = tagName('rename-manual');
    const host = await mount(tag, () => html`<div><slot name="x"></slot><slot name="y"></slot></div>`);
    try {
      const xSlot = host.querySelector('slot[name="x"]');
      const node = document.createElement('span');
      node.setAttribute('slot', 'y'); // attribute says y
      host.appendChild(node);
      await tick();
      xSlot.assign(node); // manual overrides to x
      await tick();
      assert.equal(node.parentElement, xSlot, 'manually in x');
      xSlot.setAttribute('name', 'z'); // rename the RECEIVING element
      await tick();
      await tick();
      assert.equal(node.parentElement, xSlot, 'assignment followed the ELEMENT through the rename');
    } finally {
      host.remove();
    }
  });

  test('appendChild of a non-insertable Node throws HierarchyRequestError untouched', async () => {
    const tag = tagName('bad-nodetype');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    try {
      host.appendChild(document.createElement('em'));
      await tick();
      const slot = host.querySelector('slot[data-webjs-light]');
      let threw = null;
      try { host.appendChild(/** @type {any} */ (document.createAttribute('data-x'))); } catch (e) { threw = e; }
      assert.equal(threw && threw.name, 'HierarchyRequestError', 'Attr rejected like native');
      assert.equal(slot.children.length, 1, 'zero state change');
    } finally {
      host.remove();
    }
  });

  test('slots inside a repeat() item finalize and project (client-only mount)', async () => {
    // buildDetached items apply their slot parts like every other template
    // path; the deferred finalize retry lands after the caller's synchronous
    // insert. Without it, content for these slots was permanently
    // unplaceable (excluded from placement AND exempted from the park).
    const tag = tagName('repeat-slots');
    class C extends WebComponent({ names: Array }) {
      constructor() { super(); this.names = ['top', 'side']; }
      render() {
        return html`<div>${repeat(
          this.names,
          (n) => n,
          (n) => html`<section><slot name=${n}></slot></section>`,
        )}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const a = document.createElement('em');
    a.setAttribute('slot', 'top');
    a.textContent = 'TOP';
    const b = document.createElement('strong');
    b.setAttribute('slot', 'side');
    b.textContent = 'SIDE';
    host.append(a, b);
    document.body.appendChild(host);
    await tick();
    await tick();
    try {
      const slots = host.querySelectorAll('slot[data-webjs-light]');
      assert.equal(slots.length, 2, 'both repeat-item slots rendered');
      assert.ok(slots[0].contains(a), 'first item slot received its content');
      assert.ok(slots[1].contains(b), 'second item slot received its content');
      assert.equal(slots[0].getAttribute('data-projection'), 'actual', 'finalized + applied');
    } finally {
      host.remove();
    }
  });

  test('a library write into a NAMED slot stays in that slot (adopted key)', async () => {
    const tag = tagName('named-fold');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="side"></slot></div>`,
    );
    try {
      const child = document.createElement('em');
      child.setAttribute('slot', 'side');
      host.appendChild(child);
      await tick();
      const sideSlot = host.querySelector('slot[name="side"]');
      // The sanctioned third-party write: into the assigned CONTAINER of a
      // NAMED slot, with a node that has no slot attribute.
      const badge = document.createElement('u');
      badge.id = 'badge';
      sideSlot.appendChild(badge);
      // Any record-driven apply used to teleport it to the default slot.
      host.appendChild(document.createElement('span'));
      await tick();
      assert.equal(badge.parentElement, sideSlot, 'the badge STAYED in the named slot');
      // An explicit later slot= change still wins over the adoption.
      badge.setAttribute('slot', '');
      await tick();
      await tick();
      const defSlot = host.querySelector('slot[data-webjs-light]:not([name])');
      assert.ok(defSlot.contains(badge), 'explicit attribute reclaimed routing');
    } finally {
      host.remove();
    }
  });

  test('projectAuthored preserves the slot= attribute of a manually assigned node', async () => {
    const tag = tagName('proj-attr-keep');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="side"></slot></div>`,
    );
    try {
      const el = document.createElement('em');
      el.setAttribute('slot', 'side');
      host.appendChild(el);
      await tick();
      const slots = host.querySelectorAll('slot[data-webjs-light]');
      const defSlot = slots[0];
      defSlot.assign(el); // manual: element-bound to the DEFAULT slot
      await tick();
      assert.equal(el.parentElement, defSlot, 'manually in the default slot');
      // The router's morph re-projects the default slice from its physical
      // children; the manual node's latent attribute must survive.
      projectAuthored(host, null, Array.from(defSlot.childNodes));
      await tick();
      assert.equal(el.getAttribute('slot'), 'side', 'latent slot= attribute intact');
      assert.equal(el.parentElement, defSlot, 'still manually routed');
      // Releasing the overlay restores attribute routing.
      defSlot.assign();
      await tick();
      assert.equal(el.parentElement, slots[1], 'released back to the named slot');
    } finally {
      host.remove();
    }
  });

  test('a BATCH of slot= flips clears every adoption (no first-record early exit)', async () => {
    const tag = tagName('batch-flip');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="a"></slot><slot name="b"></slot></div>`,
    );
    try {
      const aSlot = host.querySelector('slot[name="a"]');
      const bSlot = host.querySelector('slot[name="b"]');
      // Attribute-routed content puts both named slots in ACTUAL mode (the
      // self-heal only folds applied actual slots).
      const seedA = document.createElement('span');
      seedA.setAttribute('slot', 'a');
      const seedB = document.createElement('span');
      seedB.setAttribute('slot', 'b');
      host.append(seedA, seedB);
      await tick();
      // Two library writes create two adoptions.
      const n1 = document.createElement('u');
      const n2 = document.createElement('i');
      aSlot.appendChild(n1);
      bSlot.appendChild(n2);
      host.appendChild(document.createElement('em')); // fold both adoptions
      await tick();
      assert.equal(n1.parentElement, aSlot, 'n1 adopted into a');
      assert.equal(n2.parentElement, bSlot, 'n2 adopted into b');
      // BOTH flips in one task = one MutationObserver batch.
      n1.setAttribute('slot', '');
      n2.setAttribute('slot', '');
      await tick();
      await tick();
      const defSlot = host.querySelector('slot[data-webjs-light]:not([name])');
      assert.ok(defSlot.contains(n1), 'first flip honoured');
      assert.ok(defSlot.contains(n2), 'SECOND flip honoured too (no early exit)');
    } finally {
      host.remove();
    }
  });

  test('an author record op on an adopted node restores attribute routing', async () => {
    const tag = tagName('op-clears-adopt');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="side"></slot></div>`,
    );
    try {
      const seed = document.createElement('span');
      seed.setAttribute('slot', 'side'); // puts the side slot in ACTUAL mode
      host.appendChild(seed);
      await tick();
      const sideSlot = host.querySelector('slot[name="side"]');
      const node = document.createElement('u');
      sideSlot.appendChild(node); // library write
      host.appendChild(document.createElement('em')); // fold: node adopted to side
      await tick();
      assert.equal(node.parentElement, sideSlot, 'adopted into side');
      // Author takes over: detach + re-append via the record API in ways the
      // flip sensor never sees. Attribute intent (no attr = default) wins.
      host.removeChild(node);
      host.appendChild(node);
      await tick();
      const defSlot = host.querySelector('slot[data-webjs-light]:not([name])');
      assert.ok(defSlot.contains(node), 'record op ended the adoption; attribute routing resumed');
    } finally {
      host.remove();
    }
  });

  test('a slot inside asyncAppend chunk content finalizes and projects', async () => {
    const tag = tagName('stream-chunk-slot');
    async function* gen() {
      yield html`<section><slot name="x"></slot></section>`;
    }
    class C extends WebComponent {
      render() { return html`<div>${asyncAppend(gen())}</div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const child = document.createElement('em');
    child.setAttribute('slot', 'x');
    child.textContent = 'streamed-slot-content';
    host.appendChild(child);
    document.body.appendChild(host);
    // Let the chunk land + the deferred finalize + its queued apply run.
    await waitFor(
      () => host.querySelector('slot[name="x"]')?.getAttribute('data-projection') === 'actual',
    );
    await tick();
    try {
      const slot = host.querySelector('slot[name="x"]');
      assert.ok(slot, 'the chunk slot rendered');
      assert.equal(slot.getAttribute('data-projection'), 'actual', 'finalized and applied');
      assert.ok(slot.contains(child), 'authored content projected into the streamed slot');
    } finally {
      host.remove();
    }
  });

  test('cache() toggle-back re-applies: parked content returns to the slot', async () => {
    const tag = tagName('cache-slot');
    class C extends WebComponent({ showA: Boolean }) {
      constructor() { super(); this.showA = true; }
      render() {
        return html`<div>${cache(
          this.showA ? html`<slot name="x"></slot>` : html`<em>alt</em>`,
        )}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const child = document.createElement('strong');
    child.setAttribute('slot', 'x');
    child.textContent = 'cached-away';
    host.appendChild(child);
    document.body.appendChild(host);
    await tick();
    try {
      assert.equal(child.parentElement.getAttribute('name'), 'x', 'projected initially');
      host.showA = false; // stash the branch (slot + child leave the doc)
      await host.updateComplete;
      // An authored write while stashed: the apply cannot reach the stashed
      // slot, so the child parks (or is held by the record).
      host.appendChild(document.createElement('span'));
      await tick();
      host.showA = true; // re-attach the cached branch
      await host.updateComplete;
      await tick();
      await tick();
      const slot = host.querySelector('slot[name="x"]');
      assert.ok(slot, 'slot re-attached');
      assert.ok(slot.contains(child), 'the child RETURNED to the slot on toggle-back (no strand)');
      assert.ok(child.isConnected, 'connected');
    } finally {
      host.remove();
    }
  });

  test('a snapshot restore keeps an adopted node in the slot the markup shows', async () => {
    const tag = tagName('restore-adopt');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="side"></slot></div>`,
    );
    const holder = document.createElement('div');
    try {
      const seed = document.createElement('span');
      seed.setAttribute('slot', 'side');
      host.appendChild(seed);
      await tick();
      const sideSlot = host.querySelector('slot[name="side"]');
      const lib = document.createElement('u');
      lib.id = 'restored-adopted';
      sideSlot.appendChild(lib); // library write
      host.appendChild(document.createElement('em')); // fold: adopted to side
      await tick();
      assert.equal(lib.parentElement, sideSlot, 'adopted before snapshot');

      const serialized = host.outerHTML; // lib sits in the side slot, NO attribute
      host.remove();
      await tick();
      document.body.appendChild(holder);
      holder.innerHTML = serialized.replace('data-wj-host', 'data-wj-host data-wj-serialized');
      await tick();
      await tick();
      const restored = holder.querySelector(tag);
      const relib = restored.querySelector('#restored-adopted');
      assert.ok(relib, 'node restored');
      const reSide = restored.querySelector('slot[name="side"]');
      assert.ok(reSide.contains(relib), 'STAYED in the slot the restored markup showed it in');
    } finally {
      host.remove();
      holder.remove();
    }
  });

  test('projectAuthored on an ADOPTED node ends its adoption (router takes over)', async () => {
    const tag = tagName('proj-clears-adopt');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="side"></slot></div>`,
    );
    try {
      const seed = document.createElement('span');
      seed.setAttribute('slot', 'side');
      host.appendChild(seed);
      await tick();
      const sideSlot = host.querySelector('slot[name="side"]');
      const node = document.createElement('u');
      sideSlot.appendChild(node); // library write
      host.appendChild(document.createElement('em')); // fold: adopted to side
      await tick();
      assert.equal(node.parentElement, sideSlot, 'adopted into side');
      // The router seam projects the node into the DEFAULT slice (a morph
      // list can contain it). The projection is a record op: the adoption
      // must end, and the node (attribute-less after the stamp) must route
      // to the default slot and STAY there on later applies.
      projectAuthored(host, null, [node]);
      await tick();
      const defSlot = host.querySelector('slot[data-webjs-light]:not([name])');
      assert.ok(defSlot.contains(node), 'projected into the default slice');
      host.appendChild(document.createElement('i')); // a later unrelated apply
      await tick();
      assert.ok(defSlot.contains(node), 'no stale adoption pulled it back to side');
    } finally {
      host.remove();
    }
  });

  test('a slot= flip on a node detached in the SAME task still clears its adoption', async () => {
    const tag = tagName('detached-flip-clear');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="side"></slot></div>`,
    );
    try {
      const seed = document.createElement('span');
      seed.setAttribute('slot', 'side');
      host.appendChild(seed);
      await tick();
      const sideSlot = host.querySelector('slot[name="side"]');
      const node = document.createElement('u');
      sideSlot.appendChild(node); // library write
      host.appendChild(document.createElement('em')); // fold: adopted to side
      await tick();
      assert.equal(node.parentElement, sideSlot, 'adopted into side');
      // Same task: explicit attribute change, then detach. The sensor batch
      // arrives with the node no longer authored; the adoption delete must
      // run anyway, or a later re-append routes by the stale adopted key.
      node.setAttribute('slot', '');
      host.removeChild(node);
      await tick();
      host.appendChild(node);
      await tick();
      const defSlot = host.querySelector('slot[data-webjs-light]:not([name])');
      assert.ok(defSlot.contains(node), 're-append routed by the attribute, not the stale adoption');
    } finally {
      host.remove();
    }
  });

  test('cache() re-apply reaches slots in NESTED templates inside the cached branch', async () => {
    const tag = tagName('cache-nested-slot');
    class C extends WebComponent({ showA: Boolean }) {
      constructor() { super(); this.showA = true; }
      render() {
        return html`<div>${cache(
          this.showA
            ? html`<section>${html`<slot name="x"></slot>`}</section>`
            : html`<em>alt</em>`,
        )}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const child = document.createElement('strong');
    child.setAttribute('slot', 'x');
    child.textContent = 'nested-cached';
    host.appendChild(child);
    document.body.appendChild(host);
    await tick();
    await tick();
    try {
      assert.equal(child.parentElement.getAttribute('name'), 'x', 'projected initially');
      host.showA = false;
      await host.updateComplete;
      host.appendChild(document.createElement('span')); // apply while stashed
      await tick();
      host.showA = true;
      await host.updateComplete;
      await tick();
      await tick();
      const slot = host.querySelector('slot[name="x"]');
      assert.ok(slot, 'nested slot re-attached');
      assert.ok(slot.contains(child), 'the DEEP re-apply pulled the child back (shallow scan missed it)');
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
