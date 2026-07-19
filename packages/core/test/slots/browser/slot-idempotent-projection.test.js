/**
 * Real-browser regression for #1006: light-DOM slot projection must be
 * idempotent over already-projected SSR HTML.
 *
 * The bug: on a client-router path that re-enters `connectedCallback` after the
 * boot-time `webjs-hydrate` marker is already gone (a forward soft nav whose
 * parse dropped the marker, or a back/forward snapshot restore of the live,
 * already-hydrated DOM), `__isHydrating()` returns false, so control falls to
 * `captureAuthoredChildren`. That function used to hoover EVERY host child into
 * the assignment table. But on this path the host's children ARE its own
 * rendered output (the render tree with the authored content already sitting
 * inside a `<slot data-webjs-light data-projection="actual">`). Capturing that
 * whole subtree and re-projecting it into a fresh slot nests the entire render
 * one level inside itself: two copy buttons, the render output duplicated
 * inside its own slot.
 *
 * The fix makes `captureAuthoredChildren` idempotent: it detects an
 * already-projected host via the durable `data-projection` marker (which,
 * unlike the transient `webjs-hydrate` comment, survives serialization into a
 * snapshot / soft-nav fragment) and adopts the existing slot assignments in
 * place instead of moving DOM.
 *
 * Counterfactual: revert the `isAlreadyProjected` guard in `slot.js` and both
 * assertions below go red (two buttons, render output nested inside the slot).
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import {
  installSlotPolyfills,
  captureAuthoredChildren,
  SLOT_STATE,
} from '../../../src/slot.js';

installSlotPolyfills();

import { assert } from '../../../../../test/browser-assert.js';

function tick() {
  return new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
}

let nextTag = 0;
function tagName(base) { return `idem-${base}-${++nextTag}`; }

suite('Light-DOM slot projection is idempotent over projected HTML (#1006)', () => {

  test('captureAuthoredChildren adopts an already-projected host instead of hoovering', () => {
    // A plain host (no custom-element upgrade needed) already carrying a
    // component's rendered output: the copy-cmd shape, with the authored
    // command text inside a data-projection="actual" slot.
    const host = document.createElement('div');
    host.innerHTML =
      '<span class="group"><span data-copy-text>' +
      '<slot data-webjs-light data-projection="actual">npm create webjs@latest my-app</slot>' +
      '</span><button>copy</button></span>';
    const renderRoot = host.firstElementChild; // the span.group render output

    captureAuthoredChildren(host);

    const state = /** @type {any} */ (host)[SLOT_STATE];
    const def = state.assignedByName.get(null);
    // Idempotent: it recorded ONLY the slot's authored content, not the whole
    // render subtree. Without the fix, `def` is `[span.group]` (the render
    // output) and the host is emptied.
    assert.ok(def && def.length === 1, 'exactly one default-slot assignment recorded');
    assert.equal(def[0].nodeType, 3, 'the recorded assignment is the authored text node');
    assert.equal(def[0].textContent, 'npm create webjs@latest my-app');
    // Adoption does not move DOM: the render output is untouched, still in place.
    assert.equal(host.firstElementChild, renderRoot, 'render output left in place (no hoover)');
    assert.equal(host.querySelectorAll('button').length, 1, 'still exactly one button');
  });

  test('a slotted component inserted already-projected does not nest its render inside its own slot', async () => {
    const tag = tagName('card');
    class Card extends WebComponent({ label: String }) {
      render() {
        return html`<span class="group"
          ><span data-copy-text><slot></slot></span
          ><button @click=${() => { this.label = 'x'; }}>copy</button></span>`;
      }
    }
    Card.register(tag);

    // Simulate the soft-nav / snapshot-restore insertion: the host arrives
    // ALREADY projected (its own render output, authored text inside a
    // data-projection="actual" slot) and WITHOUT the webjs-hydrate marker.
    const host = document.createElement(tag);
    host.innerHTML =
      '<span class="group"><span data-copy-text>' +
      '<slot data-webjs-light data-projection="actual">npm create webjs@latest my-app</slot>' +
      '</span><button>copy</button></span>';
    document.body.appendChild(host);
    await tick();
    await host.updateComplete;
    await tick();

    assert.equal(host.querySelectorAll('button').length, 1,
      'exactly one button after projection (not two)');
    assert.equal(host.querySelector('slot [data-copy-text]'), null,
      'render output must NOT be nested inside the slot');
    assert.equal(host.querySelector('slot').textContent, 'npm create webjs@latest my-app',
      'the authored command text is the slot content');

    host.remove();
  });

  test('a first mount with real authored children (no SSR) still captures normally', async () => {
    // The non-projected path must be unchanged: raw authored children get
    // hoovered and projected into the slot exactly once.
    const tag = tagName('fresh');
    class Fresh extends WebComponent {
      render() { return html`<div class="wrap"><slot></slot></div>`; }
    }
    Fresh.register(tag);

    const host = document.createElement(tag);
    host.innerHTML = '<p>hi</p><b>!</b>';
    document.body.appendChild(host);
    await tick();

    const slot = host.querySelector('slot[data-webjs-light]');
    assert.ok(slot, 'slot exists');
    assert.equal(slot.getAttribute('data-projection'), 'actual');
    assert.equal(slot.children.length, 2, 'both authored children projected once');
    assert.equal(host.querySelectorAll('slot').length, 1, 'exactly one slot, no nesting');

    host.remove();
  });

  test('an already-projected host does not adopt a NESTED child component slot (#906)', () => {
    // The idempotency guard must scope to the host's OWN slots. A
    // data-projection slot that belongs to a nested child custom element is
    // owned by THAT component; the outer host must not adopt its content.
    const host = document.createElement('div');
    host.innerHTML =
      '<section>' +
      '<slot data-webjs-light data-projection="actual">OUTER</slot>' +
      '<nested-child><slot data-webjs-light data-projection="actual">INNER</slot></nested-child>' +
      '</section>';

    captureAuthoredChildren(host);

    const state = /** @type {any} */ (host)[SLOT_STATE];
    const def = state.assignedByName.get(null);
    // Only the outer's own default slot content ("OUTER") is adopted; the
    // nested child's slot ("INNER") is left to that component.
    assert.ok(def && def.length === 1, 'one assignment for the outer default slot');
    assert.equal(def[0].textContent, 'OUTER', 'adopted the OUTER slot content only');
    assert.equal(host.querySelector('nested-child slot').textContent, 'INNER',
      'nested child slot content untouched');
  });
});
