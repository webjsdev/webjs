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
import { enableClientRouter, _applySwap, _parseHTML } from '../../../src/router-client.js';

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
