/**
 * Architectural regressions from the per-bug-class robustness audit of #1021:
 *   1. Snapshot-restore (back/forward) of a slotted component must ADOPT its
 *      framework-rendered markup, never capture-hoover it (the #1006
 *      duplication shape on the restore path).
 *   2. A boundary swap whose markers live INSIDE a light-DOM slot (a layout's
 *      children rendered inside a slotted shell) must resync the owning host's
 *      record, or the host's next apply wipes the swapped-in page content.
 *   3. Cross-host theft: a child moved to another host's slot stays there; the
 *      first host's record drops it (no steal-back).
 * Runs in a REAL browser via WTR + Playwright.
 */
import { WebComponent } from '../../../src/component.js';
import { html } from '../../../src/html.js';
import {
  enableClientRouter,
  _applySwap,
  _parseHTML,
  _diffElementInPlace,
} from '../../../src/router-client.js';

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

suite('Router + slot architectural regressions', () => {
  test('snapshot-restore of a slotted component adopts, never duplicates (#1006 restore path)', async () => {
    const tag = tagName('restore');
    const host = await mount(tag, () => html`<div class="shell"><slot></slot></div>`);
    const p = document.createElement('p');
    p.textContent = 'authored';
    host.appendChild(p);
    await tick();
    assert.equal(host.querySelectorAll('p').length, 1, 'one authored child before snapshot');

    // Simulate the router's back/forward snapshot restore: serialize the
    // POST-HYDRATION host (no webjs-hydrate marker, all symbols gone) and
    // re-create it from that HTML, as replaceBoundaryRange does with a cached
    // snapshot.
    const serialized = host.outerHTML;
    host.remove();
    await tick();
    const holder = document.createElement('div');
    document.body.appendChild(holder);
    holder.innerHTML = serialized; // parser-creates + upgrades the host
    await tick();
    await tick();

    const restored = holder.querySelector(tag);
    assert.ok(restored, 'restored host upgraded');
    // The old failure shape: capture hoovers the rendered tree, so the fresh
    // render nests the old shell (two .shell divs, duplicated authored <p>).
    assert.equal(restored.querySelectorAll('.shell').length, 1, 'exactly one rendered shell (no nested old tree)');
    assert.equal(restored.querySelectorAll('p').length, 1, 'the authored child appears exactly once');
    const slot = restored.querySelector('slot[data-webjs-light]');
    assert.ok(slot && slot.querySelector('p'), 'the authored child is projected in the slot');
    holder.remove();
  });

  test('a boundary swap inside a slotted shell resyncs the record (no wipe on next apply)', async () => {
    enableClientRouter();
    const tag = tagName('shell');
    const host = await mount(tag, () => html`<div class="frame"><slot></slot></div>`);
    // The layout-children-in-a-slotted-shell composition: the wj:children
    // markers and the page content are AUTHORED children of the shell, so
    // they project INSIDE its slot.
    const open = document.createComment('wj:children:/:/');
    const pageA = document.createElement('main');
    pageA.id = 'page-a';
    pageA.textContent = 'A';
    const close = document.createComment('/wj:children:/');
    host.appendChild(open);
    host.appendChild(pageA);
    host.appendChild(close);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.ok(slot.contains(pageA), 'page A projected inside the shell slot');

    try {
      // Soft-nav morph: same segment + route-key on both sides, so the swap
      // reconciles the range between the markers, which live inside the slot.
      const doc = _parseHTML(
        '<!--wj:children:/:/-->' +
        '<main id="page-b">B</main>' +
        '<!--/wj:children:/-->'
      );
      _applySwap(doc, null, false, location.origin + '/');
      assert.ok(slot.querySelector('#page-b'), 'page B swapped in inside the slot');

      // The trigger for the stale-record wipe: any authored write re-applies
      // the record. Without the post-swap resync, the apply would remove page
      // B (not in the record) and restore the pruned stale list.
      const banner = document.createElement('aside');
      banner.id = 'banner';
      host.appendChild(banner);
      await tick();
      assert.ok(slot.querySelector('#page-b'), 'page B SURVIVED the re-apply (record was resynced)');
      assert.ok(slot.querySelector('#banner'), 'the authored write also landed');
    } finally {
      host.remove();
      document.body.querySelectorAll('main#page-b').forEach((e) => e.remove());
    }
  });

  test('a template-forwarded slot on a client-side first mount is captured, not adopted', async () => {
    // The lit-style forwarding shape: the OUTER template passes a <slot> as an
    // authored child of the inner component. discoverSlots stamps
    // data-webjs-light on it at compile time, so the framework-rendered
    // detector must NOT fire on it (it has no data-projection until placed),
    // or the inner host would adopt-and-discard the forwarded slot.
    if (!customElements.get('fw-fixed-inner')) {
      class FixedInner extends WebComponent {
        render() { return html`<div class="inner-shell"><slot></slot></div>`; }
      }
      FixedInner.register('fw-fixed-inner');
    }
    const outerTag = tagName('fw-outer');
    class Outer extends WebComponent {
      render() { return html`<fw-fixed-inner><slot>forwarded fallback</slot></fw-fixed-inner>`; }
    }
    Outer.register(outerTag);
    const o = document.createElement(outerTag);
    document.body.appendChild(o); // client-side mount, no SSR
    await tick();
    await tick();
    const inner = o.querySelector('fw-fixed-inner');
    assert.ok(inner, 'inner mounted');
    // The forwarded slot must survive as inner's authored child, projected
    // into inner's own slot, showing its fallback content.
    assert.ok(inner.textContent.includes('forwarded fallback'),
      'the forwarded slot fallback rendered (not adopted-and-discarded)');
    o.remove();
  });

  test('a template-forwarded slot projects the OUTER content on a client-only mount (#1023)', async () => {
    // The headline #1023 fix: template ownership routes the forwarded slot to
    // the OUTER host that rendered it, so the outer's authored content lands
    // there instead of the fallback.
    if (!customElements.get('fw1023-inner')) {
      class Inner extends WebComponent {
        render() { return html`<div class="card"><slot></slot></div>`; }
      }
      Inner.register('fw1023-inner');
    }
    const outerTag = tagName('fw1023-outer');
    class Outer extends WebComponent {
      render() { return html`<fw1023-inner><slot>forwarded fallback</slot></fw1023-inner>`; }
    }
    Outer.register(outerTag);
    const o = document.createElement(outerTag);
    o.appendChild(document.createTextNode('Hello'));
    document.body.appendChild(o); // client-only mount, never SSR'd
    await tick();
    await tick();
    try {
      const inner = o.querySelector('fw1023-inner');
      const fwd = o.querySelector('fw1023-inner > .card slot[data-webjs-light]');
      assert.ok(fwd, 'the forwarded slot rendered');
      assert.ok(inner.textContent.includes('Hello'), 'the OUTER content projected into the forwarded slot');
      assert.ok(!inner.textContent.includes('forwarded fallback'), 'fallback replaced by content');
      // The forwarded slot's assignedNodes reflect the outer content.
      const assigned = fwd.assignedNodes();
      assert.ok(assigned.some((n) => n.textContent === 'Hello'), 'assignedNodes carries the outer content');
      // Live update re-projects into the forwarded slot.
      o.appendChild(document.createTextNode(' World'));
      await tick();
      assert.ok(inner.textContent.includes('Hello World'), 'a post-mount write re-projects');
    } finally {
      o.remove();
    }
  });

  test('a nested child component keeps its OWN slot (forwarding does not steal, #1023)', async () => {
    // Ownership must exclude a genuine child's own slot: outer forwards its
    // default slot into the inner's default slot, but the inner ALSO has a
    // named slot with inner-authored content that outer must never claim.
    if (!customElements.get('fw1023-inner2')) {
      class Inner extends WebComponent {
        render() {
          return html`<div><slot></slot><em class="tag"><slot name="tag">inner-tag</slot></em></div>`;
        }
      }
      Inner.register('fw1023-inner2');
    }
    const outerTag = tagName('fw1023-outer2');
    class Outer extends WebComponent {
      render() { return html`<fw1023-inner2><slot></slot></fw1023-inner2>`; }
    }
    Outer.register(outerTag);
    const o = document.createElement(outerTag);
    o.appendChild(document.createTextNode('OUTER'));
    document.body.appendChild(o);
    await tick();
    await tick();
    try {
      const inner = o.querySelector('fw1023-inner2');
      const defSlot = inner.querySelector(':scope > div > slot[data-webjs-light]:not([name])');
      const tagSlot = inner.querySelector('slot[name="tag"]');
      assert.ok(defSlot.textContent.includes('OUTER') || inner.textContent.includes('OUTER'), 'outer content in the forwarded default slot');
      assert.ok(tagSlot.textContent.includes('inner-tag'), 'the inner OWN named slot kept its fallback (not stolen)');
    } finally {
      o.remove();
    }
  });

  test('a serialized-stamped host with a conditionally CLOSED slot adopts (no stale-tree projection)', async () => {
    // The serialized shape carries NO projected slot (the conditional is
    // closed at snapshot time), so the structural detector has nothing to see.
    // The router's data-wj-serialized stamp is what routes this restore to
    // adopt; without it, capture hoovers the old rendered tree and a later
    // conditional open projects that stale tree into the slot as authored
    // content (the #1006 shape, one conditional away).
    const tag = tagName('cond-restore');
    class C extends WebComponent({ open: Boolean }) {
      constructor() { super(); this.open = false; }
      render() {
        return this.open
          ? html`<div class="opened"><slot></slot></div>`
          : html`<div class="closed">closed</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    const serialized = host.outerHTML; // post-render, closed: NO slot inside
    host.remove();
    await tick();
    // Restore the serialized HTML with the router's stamp applied, as
    // applySwap does for every host in a parsed doc.
    const holder = document.createElement('div');
    document.body.appendChild(holder);
    holder.innerHTML = serialized.replace('data-wj-host', 'data-wj-host data-wj-serialized');
    await tick();
    const restored = holder.querySelector(tag);
    assert.ok(restored, 'restored host upgraded');
    assert.ok(!restored.hasAttribute('data-wj-serialized'), 'the stamp was consumed on upgrade');
    // Open the conditional. The slot must show its (empty) assignment, never
    // the STALE old rendered "closed" tree.
    restored.open = true;
    await tick();
    await tick();
    const slot = restored.querySelector('slot[data-webjs-light]');
    assert.ok(slot, 'the conditional slot rendered');
    assert.ok(!slot.querySelector('.closed'), 'the stale rendered tree was NOT projected as authored content');
    holder.remove();
  });

  test('the serialized stamp is never copied onto a live reused host', async () => {
    // The morph's attribute sync must skip data-wj-serialized: it is a
    // message to a not-yet-upgraded element's connectedCallback, and copying
    // it onto an already-live host leaves a consume-once marker lingering in
    // the live DOM.
    const dst = document.createElement('div');
    dst.setAttribute('data-wj-host', '');
    const src = document.createElement('div');
    src.setAttribute('data-wj-host', '');
    src.setAttribute('data-wj-serialized', '');
    src.setAttribute('data-extra', 'yes');
    _diffElementInPlace(dst, src);
    assert.ok(!dst.hasAttribute('data-wj-serialized'), 'stamp NOT copied to the live element');
    assert.equal(dst.getAttribute('data-extra'), 'yes', 'ordinary attributes still sync');
  });

  test('a PARKED child survives a serialized-stamped restore', async () => {
    // The outerHTML snapshot carries <wj-slot-park> with the unmatched child
    // inside; the restore adopt must sweep it back into the record (connected,
    // native parity) instead of leaving it lost in a stale serialized park.
    const tag = tagName('park-restore');
    const host = await mount(tag, () => html`<div><slot name="only"></slot></div>`);
    const child = document.createElement('span');
    child.setAttribute('slot', 'unmatched');
    child.id = 'parked-child';
    host.appendChild(child);
    await tick();
    assert.equal(child.parentElement.tagName.toLowerCase(), 'wj-slot-park', 'parked before snapshot');

    const serialized = host.outerHTML;
    host.remove();
    await tick();
    const holder = document.createElement('div');
    document.body.appendChild(holder);
    try {
      holder.innerHTML = serialized.replace('data-wj-host', 'data-wj-host data-wj-serialized');
      await tick();
      await tick();
      const restored = holder.querySelector(tag);
      const rechild = restored.querySelector('#parked-child');
      assert.ok(rechild, 'the parked child exists in the restored host');
      assert.ok(rechild.isConnected, 'still connected (native keeps unmatched children connected)');
      assert.equal(
        rechild.parentElement.tagName.toLowerCase(),
        'wj-slot-park',
        're-parked in the fresh park',
      );
      assert.equal(
        restored.querySelectorAll('wj-slot-park').length,
        1,
        'exactly one park (the serialized one was dropped)',
      );
    } finally {
      holder.remove();
    }
  });

  test('a src-side serialized forwarded slot is not a reprojection target', async () => {
    // The parsed-doc side has no record, so the exclusion is structural: a
    // slot nested inside an ACTUAL-mode container is serialized forwarded
    // content, never a target. Without it, the morph collected the nested
    // name and projected clones into (or evicted from) the live host's
    // same-named own slot.
    const tag = tagName('src-fwd');
    const host = await mount(
      tag,
      () => html`<div><slot></slot><slot name="x"></slot></div>`,
    );
    try {
      const keep = document.createElement('b');
      keep.setAttribute('slot', 'x');
      keep.id = 'keep-x';
      host.appendChild(keep);
      await tick();
      const ownX = host.querySelector('slot[name="x"]');
      assert.ok(ownX.contains(keep), 'live own x slot holds its content');

      // Incoming parsed host: the forwarded serialized shape (an actual
      // name=x slot INSIDE the default actual slot) with different content.
      const doc = _parseHTML(
        `<${tag} data-wj-host><div>` +
          `<slot data-webjs-light data-projection="actual">` +
          `<slot data-webjs-light data-projection="actual" name="x">FWD</slot>` +
          `</slot>` +
          `<slot data-webjs-light data-projection="actual" name="x"><i>inc-x</i></slot>` +
          `</div></${tag}>`,
      );
      const src = doc.querySelector(tag);
      _diffElementInPlace(host, src);
      await tick();
      await tick();
      // The own x slot reprojects from the incoming OWN x slot (inc-x), and
      // the forwarded nested slot's content must never be the source. The
      // POSITIVE assert is the discriminating one: on revert, the exclusion's
      // absence flips the live own slot to fallback, destroys its content,
      // and never projects inc-x.
      assert.ok(ownX.textContent.includes('inc-x'), 'the own slot reprojected from the incoming OWN slot');
      assert.ok(!ownX.textContent.includes('FWD'), 'forwarded content was NOT projected into the own slot');
    } finally {
      host.remove();
    }
  });

  test('applySwap stamps every host in a parsed doc as serialized', async () => {
    enableClientRouter();
    const doc = _parseHTML(
      '<div><some-widget data-wj-host><p>rendered</p></some-widget></div>'
    );
    // A background revalidation with no boundary plan DISCARDS the response
    // (no navigation, no swap), but the stamp runs before that early return.
    _applySwap(doc, null, true, location.origin + '/anywhere');
    const host = doc.querySelector('some-widget');
    assert.ok(host.hasAttribute('data-wj-serialized'), 'the parsed-doc host was stamped');
  });

  test('cross-host move sticks: the first host does not steal the child back', async () => {
    const tagA = tagName('host-a');
    const tagB = tagName('host-b');
    const hostA = await mount(tagA, () => html`<div><slot></slot></div>`);
    const hostB = await mount(tagB, () => html`<div><slot></slot></div>`);
    const child = document.createElement('p');
    hostA.appendChild(child);
    const slotA = hostA.querySelector('slot[data-webjs-light]');
    const slotB = hostB.querySelector('slot[data-webjs-light]');
    assert.equal(child.parentElement, slotA, 'starts in host A');

    hostB.appendChild(child); // native implicit move across hosts
    assert.equal(child.parentElement, slotB, 'moved to host B');

    // Force A to re-apply; its prune rule must drop the moved child instead of
    // stealing it back (the ping-pong the parent-keyed prune prevents).
    hostA.appendChild(document.createElement('span'));
    await tick();
    assert.equal(child.parentElement, slotB, 'child stayed in host B after A re-applied');
    assert.ok(!slotA.contains(child), 'host A did not steal it back');
    hostA.remove();
    hostB.remove();
  });
});
