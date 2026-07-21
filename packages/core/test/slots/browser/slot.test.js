/**
 * Light-DOM <slot> tests in a REAL browser via WTR + Playwright.
 *
 * Covers the runtime behaviours that linkedom cannot exercise faithfully:
 *
 *   - DOM identity preservation across re-renders
 *   - MutationObserver-driven re-projection
 *   - slotchange event firing with equality detection
 *   - Microtask batching of mutations
 *   - Dynamic slot name + child slot= attribute changes
 *   - Slot inside conditional (collapse + re-create)
 *   - Multiple instances + disconnect / reconnect
 *   - Light vs shadow DOM template parity
 *   - SSR hydration with projected children
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { installSlotPolyfills } from '../../../src/slot.js';

// Make sure polyfills are installed against the live DOM realm.
installSlotPolyfills();

import { assert } from '../../../../../test/browser-assert.js';

// Tiny helper to wait for microtask batch + observer callbacks.
function tick() {
  return new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
}

// Each test registers components under a unique tag to avoid registry
// collisions across the suite.
let nextTag = 0;
function tagName(base) { return `slot-b-${base}-${++nextTag}`; }

suite('Light-DOM slot projection (browser)', () => {

  test('default slot projects authored children on first connection', async () => {
    const tag = tagName('default');
    class C extends WebComponent {
      render() { return html`<div class="wrap"><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.innerHTML = '<p>hi</p><b>!</b>';
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.ok(slot, 'slot element should exist after render');
    assert.equal(slot.getAttribute('data-projection'), 'actual');
    assert.equal(slot.children.length, 2);
    assert.equal(slot.children[0].tagName, 'P');
    assert.equal(slot.children[1].tagName, 'B');
    host.remove();
  });

  test('named slots route by slot= attribute', async () => {
    const tag = tagName('named');
    class C extends WebComponent {
      render() {
        return html`<header><slot name="head"></slot></header><main><slot></slot></main>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.innerHTML = '<h1 slot="head">Title</h1><p>Body</p>';
    document.body.appendChild(host);
    await tick();
    const slots = host.querySelectorAll('slot[data-webjs-light]');
    const headSlot = host.querySelector('slot[name="head"]');
    const defaultSlot = Array.from(slots).find((s) => !s.hasAttribute('name'));
    assert.equal(headSlot.children[0].tagName, 'H1');
    assert.equal(defaultSlot.children[0].tagName, 'P');
    host.remove();
  });

  test('fallback content shown when no children provided', async () => {
    const tag = tagName('fallback');
    class C extends WebComponent {
      render() { return html`<div><slot>FALLBACK</slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.getAttribute('data-projection'), 'fallback');
    assert.ok(slot.textContent.includes('FALLBACK'));
    host.remove();
  });

  test('assignedNodes returns projected nodes', async () => {
    const tag = tagName('assigned-nodes');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const p = document.createElement('p');
    p.textContent = 'one';
    host.appendChild(p);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    const got = slot.assignedNodes();
    assert.equal(got.length, 1);
    assert.equal(got[0], p);
    host.remove();
  });

  test('assignedNodes returns empty when slot is showing fallback', async () => {
    const tag = tagName('assigned-fallback');
    class C extends WebComponent {
      render() { return html`<div><slot>F</slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.deepEqual(slot.assignedNodes(), []);
    host.remove();
  });

  test('element.assignedSlot returns the slot a child is projected into', async () => {
    const tag = tagName('assigned-slot');
    class C extends WebComponent {
      render() { return html`<header><slot name="x"></slot></header>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const h = document.createElement('h2');
    h.setAttribute('slot', 'x');
    host.appendChild(h);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[name="x"]');
    assert.equal(h.assignedSlot, slot);
    host.remove();
  });

  test('a slotted host nested inside an <a> is NOT misread as shadow DOM (anchor .host bug)', async () => {
    // HTMLAnchorElement exposes a URL-derived `.host` ('example.com'), so a
    // shadow-root walk that checks `.host` truthiness alone bails at the
    // anchor and silently skips the light-DOM slot application. The real
    // check requires a DocumentFragment (nodeType 11). This is exactly the
    // blog's post-card shape (<a><muted-text>meta</muted-text></a>), where
    // the author line vanished post-hydration.
    const tag = tagName('anchor-nested');
    class C extends WebComponent {
      render() { return html`<slot></slot>`; }
    }
    C.register(tag);
    const a = document.createElement('a');
    a.href = '/somewhere';
    const host = document.createElement(tag);
    host.appendChild(document.createTextNode('Demo Author'));
    a.appendChild(host);
    document.body.appendChild(a);
    await tick();
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.ok(slot, 'the slot rendered');
    assert.equal(slot.getAttribute('data-projection'), 'actual',
      'the slot was applied as light DOM (not skipped as shadow)');
    assert.equal(slot.textContent, 'Demo Author', 'the authored content was placed');
    a.remove();
  });

  test('the reserved `default` alias addresses the default slot everywhere (#1015)', async () => {
    // 'default', '', and null all address the default slot, uniformly across
    // capture, application, and the public API, so a router morph that reads
    // a name attribute of "default" cannot strand content on a mismatched key.
    const tag = tagName('default-alias');
    class C extends WebComponent {
      render() { return html`<main><slot name="default">fb</slot></main>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.appendChild(document.createTextNode('captured'));
    document.body.appendChild(host);
    await tick();
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.textContent, 'captured', 'unnamed children land in the name="default" slot');
    assert.equal(slot.assignedNodes().length, 1, 'assignedNodes reads the default slot');
    host.replaceChildren('replaced');
    await tick();
    assert.equal(slot.textContent, 'replaced', 'a default-slot child addresses the name="default" slot');
    host.remove();
  });

  test('slotchange fires when a child is appended at runtime (native)', async () => {
    const tag = tagName('slotchange-add');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    let fireCount = 0;
    slot.addEventListener('slotchange', () => { fireCount++; });
    const p = document.createElement('p');
    host.appendChild(p);
    await tick();
    assert.ok(fireCount >= 1, 'slotchange should fire at least once');
    assert.equal(p.parentElement, slot, 'the appended node was placed in the slot');
    host.remove();
  });

  test('an external appendChild on a mounted host is LIVE (native slot parity)', async () => {
    // Full shadow-DOM parity: a post-mount appendChild is projected into the
    // slot synchronously (assignment is synchronous, like native), and the
    // slotchange event fires async + coalesced.
    const tag = tagName('append-live');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    let fireCount = 0;
    slot.addEventListener('slotchange', () => { fireCount++; });
    const p = document.createElement('p');
    host.appendChild(p);
    assert.equal(p.parentElement, slot, 'appended child is projected synchronously');
    assert.equal(slot.children.length, 1, 'the appended child was projected');
    assert.equal(fireCount, 0, 'slotchange is async: not yet fired');
    await tick();
    assert.equal(fireCount, 1, 'slotchange fired once (async, coalesced)');
    host.remove();
  });

  test('slotchange fires when the last child is removed, reverting to fallback (native)', async () => {
    const tag = tagName('slotchange-remove');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const p = document.createElement('p');
    host.appendChild(p);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    let fireCount = 0;
    slot.addEventListener('slotchange', () => { fireCount++; });
    host.removeChild(p); // host-receiver removal, caught live by interception
    await tick();
    assert.ok(fireCount >= 1, 'slotchange should fire on clearing to fallback');
    assert.equal(slot.children.length, 0, 'the slot reset to (empty) fallback');
    host.remove();
  });

  test('slotchange does NOT fire when no assignment changed (no-op re-projection)', async () => {
    const tag = tagName('slotchange-noop');
    class C extends WebComponent({ x: Number }) {
      constructor() { super(); this.x = 0; }
      render() { return html`<div data-x=${this.x}><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.appendChild(document.createElement('p'));
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    let fireCount = 0;
    slot.addEventListener('slotchange', () => { fireCount++; });
    // Trigger a re-render via property change. Slot assignment unchanged.
    host.x = 1;
    await tick();
    await tick();
    assert.equal(fireCount, 0, 'slotchange should NOT fire on unchanged assignment');
    host.remove();
  });

  test('a slot= flip re-routes content between named slots (native)', async () => {
    const tag = tagName('child-slot-change');
    class C extends WebComponent {
      render() { return html`<div><slot name="a"></slot><slot name="b"></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const child = document.createElement('span');
    child.setAttribute('slot', 'a');
    host.appendChild(child);
    document.body.appendChild(host);
    await tick();
    const slotA = host.querySelector('slot[name="a"]');
    const slotB = host.querySelector('slot[name="b"]');
    assert.equal(child.parentElement, slotA, 'initially in slot a');
    child.setAttribute('slot', 'b'); // native attribute flip, caught by the flip sensor
    await tick();
    assert.equal(child.parentElement, slotB, 'after the flip, in slot b');
    host.remove();
  });

  test('appendChild of a burst places every node at once, one coalesced slotchange (native)', async () => {
    const tag = tagName('batch');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.assignedNodes().length, 0, 'no default content yet');
    let fireCount = 0;
    slot.addEventListener('slotchange', () => { fireCount++; });
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 10; i++) frag.appendChild(document.createElement('p'));
    host.appendChild(frag);
    // Placement is synchronous; the slotchange event is async + coalesced.
    assert.equal(fireCount, 0, 'slotchange is async: not fired synchronously');
    assert.equal(slot.children.length, 10, 'placement is synchronous');
    await tick();
    assert.equal(fireCount, 1, 'one commit, one coalesced slotchange');
    assert.equal(slot.assignedNodes().length, 10, 'assignedNodes reads the whole burst');
    host.remove();
  });

  test('re-render preserves DOM identity for projected children', async () => {
    const tag = tagName('identity');
    class C extends WebComponent({ mode: String }) {
      constructor() { super(); this.mode = 'a'; }
      render() {
        return html`<div data-mode=${this.mode}><slot></slot></div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const p = document.createElement('p');
    p.textContent = 'persistent';
    host.appendChild(p);
    document.body.appendChild(host);
    await tick();
    host.mode = 'b';
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.children[0], p, 'same Node ref across re-render');
    host.remove();
  });

  test('disconnect + reconnect preserves slot state', async () => {
    const tag = tagName('reconnect');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.appendChild(document.createElement('p'));
    document.body.appendChild(host);
    await tick();
    host.remove();
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.children.length, 1, 'projection survives reconnect');
    host.remove();
  });

  test('multiple instances on the same page are independent', async () => {
    const tag = tagName('multi');
    class C extends WebComponent {
      render() { return html`<div class="i"><slot></slot></div>`; }
    }
    C.register(tag);
    const a = document.createElement(tag);
    a.innerHTML = '<p>A</p>';
    const b = document.createElement(tag);
    b.innerHTML = '<p>B</p>';
    document.body.appendChild(a);
    document.body.appendChild(b);
    await tick();
    const sA = a.querySelector('slot[data-webjs-light]');
    const sB = b.querySelector('slot[data-webjs-light]');
    assert.equal(sA.textContent, 'A');
    assert.equal(sB.textContent, 'B');
    a.remove();
    b.remove();
  });

  test('slot inside conditional that flips false then true preserves children', async () => {
    const tag = tagName('cond');
    class C extends WebComponent({ open: Boolean }) {
      constructor() { super(); this.open = true; }
      render() {
        return html`<div>${this.open ? html`<section><slot></slot></section>` : html`<i>closed</i>`}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const child = document.createElement('p');
    child.textContent = 'will-survive';
    host.appendChild(child);
    document.body.appendChild(host);
    await tick();
    host.open = false;
    await tick();
    host.open = true;
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.ok(slot, 'slot reappears after toggle');
    // Identity is preserved if the framework moved the original Node.
    assert.equal(slot.children[0], child, 'projected child Node identity preserved');
    host.remove();
  });

  test('shadow DOM mode: same render template projects natively', async () => {
    const tag = tagName('shadow');
    class C extends WebComponent {
      static shadow = true;
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.innerHTML = '<p>x</p>';
    document.body.appendChild(host);
    await tick();
    // In shadow DOM, the <slot> is inside the shadow root, not light DOM.
    const shadowSlot = host.shadowRoot && host.shadowRoot.querySelector('slot');
    assert.ok(shadowSlot, 'shadow root has the native slot');
    // assignedNodes returns the host's projected light children.
    const assigned = shadowSlot.assignedNodes();
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].tagName, 'P');
    host.remove();
  });

  test('slot-forwarding with assignedNodes flatten walks through nested slots', async () => {
    const tag = tagName('forward');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick();
    // Build a chain manually inside the slot. The outer slot's child is
    // itself another light slot containing the leaf node.
    const outerSlot = host.querySelector('slot[data-webjs-light]');
    const innerSlot = document.createElement('slot');
    innerSlot.setAttribute('data-webjs-light', '');
    innerSlot.setAttribute('data-projection', 'actual');
    const leaf = document.createElement('strong');
    innerSlot.appendChild(leaf);
    // Clear the outer slot and place inner inside.
    while (outerSlot.firstChild) outerSlot.removeChild(outerSlot.firstChild);
    outerSlot.appendChild(innerSlot);
    outerSlot.setAttribute('data-projection', 'actual');
    const flat = outerSlot.assignedNodes({ flatten: true });
    assert.equal(flat.length, 1);
    assert.equal(flat[0], leaf);
    host.remove();
  });

  test('hydration: SSR-style markup is adopted without re-creating nodes', async () => {
    const tag = tagName('hydrate');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    // Simulate SSR output: hydrate marker + rendered template with slot
    // containing pre-projected children.
    host.innerHTML = '<!--webjs-hydrate--><div><slot data-webjs-light data-projection="actual"><p id="ssr-p">hydrated</p></slot></div>';
    const ssrP = host.querySelector('#ssr-p');
    document.body.appendChild(host);
    await tick();
    // After hydration, the same Node ref should remain.
    const liveP = host.querySelector('#ssr-p');
    assert.equal(liveP, ssrP, 'SSR-placed node identity preserved through hydration');
    host.remove();
  });

  test('events bound on projected children fire correctly', async () => {
    const tag = tagName('events');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const btn = document.createElement('button');
    let clicked = false;
    btn.addEventListener('click', () => { clicked = true; });
    host.appendChild(btn);
    document.body.appendChild(host);
    await tick();
    const projectedBtn = host.querySelector('button');
    assert.equal(projectedBtn, btn, 'button is the same Node');
    projectedBtn.click();
    assert.ok(clicked, 'event handler fires through projection');
    host.remove();
  });

  test('input value (focus, selection) survives projection move', async () => {
    const tag = tagName('input-state');
    class C extends WebComponent({ mode: String }) {
      constructor() { super(); this.mode = 'a'; }
      render() {
        // Conditional swap; slot moves in DOM but children Node identity
        // must persist for input state to survive.
        return html`<div data-mode=${this.mode}>${this.mode === 'a' ? html`<section><slot></slot></section>` : html`<aside><slot></slot></aside>`}</div>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const input = document.createElement('input');
    host.appendChild(input);
    document.body.appendChild(host);
    await tick();
    input.value = 'typed';
    input.focus();
    host.mode = 'b';
    await tick();
    // Wait a microtask for projection to settle.
    await tick();
    assert.equal(input.value, 'typed', 'input value persists');
    host.remove();
  });

  test('an authored child with slot="x" and no matching slot is parked, not rendered', async () => {
    const tag = tagName('unmatched');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const ghost = document.createElement('span');
    ghost.setAttribute('slot', 'ghost');
    ghost.textContent = 'never seen';
    host.appendChild(ghost);
    const real = document.createElement('p');
    real.textContent = 'visible';
    host.appendChild(real);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.children.length, 1);
    assert.equal(slot.children[0], real);
    // Ghost is PARKED (connected but unrendered inside <wj-slot-park>, the
    // native-parity holding element); it renders nowhere.
    assert.ok(!slot.contains(ghost), 'unmatched child not in default slot');
    assert.equal(ghost.parentElement.tagName.toLowerCase(), 'wj-slot-park', 'parked');
    host.remove();
  });

  test('initial children render in authored source order', async () => {
    const tag = tagName('reorder');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const a = document.createElement('p'); a.textContent = 'A';
    const b = document.createElement('p'); b.textContent = 'B';
    host.appendChild(a);
    host.appendChild(b);
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.children[0].textContent, 'A');
    assert.equal(slot.children[1].textContent, 'B');
    assert.equal(slot.children.length, 2);
    host.remove();
  });

  test('polyfilled assignedSlot returns null for element not in any slot', () => {
    const orphan = document.createElement('p');
    document.body.appendChild(orphan);
    assert.equal(orphan.assignedSlot, null);
    orphan.remove();
  });

  test('component lifecycle: connectedCallback runs before slot projection', async () => {
    const tag = tagName('lifecycle');
    let onMountCalled = false;
    class C extends WebComponent {
      connectedCallback() {
        super.connectedCallback();
        onMountCalled = true;
      }
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.innerHTML = '<p>x</p>';
    document.body.appendChild(host);
    await tick();
    assert.ok(onMountCalled, 'connectedCallback ran');
    host.remove();
  });

  test('SLOT_STATE persists across mount/unmount cycles', async () => {
    const tag = tagName('state-persist');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.appendChild(document.createElement('p'));
    document.body.appendChild(host);
    await tick();
    const firstSlot = host.querySelector('slot[data-webjs-light]');
    const firstChild = firstSlot.children[0];
    host.remove();
    document.body.appendChild(host);
    await tick();
    const secondSlot = host.querySelector('slot[data-webjs-light]');
    assert.equal(secondSlot.children[0], firstChild, 'same Node ref after re-mount');
    host.remove();
  });

  // ===========================================================================
  // Slot projection timing vs lifecycle hooks (lit-parity integration)
  //
  // Pins down a subtle webjs-vs-lit divergence. In shadow DOM, slot projection
  // is native and synchronous, so by the time `firstUpdated` runs the slot's
  // assigned-nodes list is populated. In webjs light DOM, projection is
  // microtask-deferred to AFTER the render commit, which means `firstUpdated`
  // and `updated` see the <slot> element in the DOM but its `assignedNodes()`
  // is still empty. Components that need projected children must read them on
  // the next microtask, via `slotchange`, or in `updated()` after a subsequent
  // re-render.
  //
  // Documented as the fourth light-DOM gap (initial-projection timing) on
  // every slot doc surface, and as the "Reading assignedNodes() in
  // firstUpdated" gotcha in the skill's references/muscle-memory-gotchas.md.
  // ===========================================================================

  test('firstUpdated sees the <slot> element but light-DOM projection has NOT yet populated it', async () => {
    const tag = tagName('first-updated-vs-projection');
    const log = {};
    class C extends WebComponent {
      firstUpdated() {
        const slot = this.querySelector('slot[data-webjs-light]');
        log.slotExists = !!slot;
        log.assignedAtFirstUpdated = slot ? slot.assignedNodes().length : -1;
        log.slotChildrenAtFirstUpdated = slot ? slot.children.length : -1;
      }
      updated() {
        // Same render cycle as firstUpdated; same timing.
        const slot = this.querySelector('slot[data-webjs-light]');
        log.assignedAtUpdated = slot ? slot.assignedNodes().length : -1;
      }
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);

    const host = document.createElement(tag);
    host.innerHTML = '<h1>A</h1><p>B</p><span>C</span>';
    document.body.appendChild(host);
    await tick();

    assert.equal(log.slotExists, true,
      'slot element exists in firstUpdated (the render committed before the hook fired)');
    assert.equal(log.assignedAtFirstUpdated, 0,
      'light-DOM projection is deferred to a follow-up microtask, so assignedNodes is empty in firstUpdated');
    assert.equal(log.slotChildrenAtFirstUpdated, 0,
      'the slot has no DOM children yet either (projection populates them)');
    assert.equal(log.assignedAtUpdated, 0,
      'updated() runs in the same render cycle as firstUpdated, same empty-slot observation');

    // After projection has run, the slot reflects the projected children.
    // This is the supported way to read assignedNodes synchronously: wait
    // past the projection microtask, OR use slotchange.
    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.assignedNodes().length, 3,
      'after projection, slot reports the three projected nodes');
    assert.equal(slot.children.length, 3,
      'projection materialised the three children as actual DOM children of the slot');

    host.remove();
  });

  test('updated() on a re-render AFTER projection sees the populated slot', async () => {
    // Authoring pattern: if a component needs to read assignedNodes from a
    // lifecycle hook, trigger a re-render after projection completes (e.g.
    // by calling requestUpdate() from a slotchange listener) and read in
    // `updated()`. The second `updated()` call observes the populated slot.
    const tag = tagName('updated-after-projection');
    const seenAtUpdate = [];
    class C extends WebComponent {
      updated() {
        const slot = this.querySelector('slot[data-webjs-light]');
        seenAtUpdate.push(slot ? slot.assignedNodes().length : -1);
      }
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);

    const host = document.createElement(tag);
    host.innerHTML = '<i>x</i><i>y</i>';
    document.body.appendChild(host);
    await tick();

    // Force a second render. The renderer is idempotent on no-op patches,
    // so seed a state field that the render() body doesn't reference; the
    // second render still commits and fires updated() again.
    host.requestUpdate();
    await tick();

    assert.equal(seenAtUpdate.length >= 2, true,
      'updated() fired for the first and at least one subsequent render');
    assert.equal(seenAtUpdate[0], 0,
      'first updated() observed an empty slot (projection deferred)');
    assert.equal(seenAtUpdate[seenAtUpdate.length - 1], 2,
      'a later updated() (after projection) observes the populated slot');

    host.remove();
  });

  test('shadow-DOM contrast: firstUpdated sees populated assignedNodes (native synchronous projection)', async () => {
    // Counterpoint to the light-DOM tests above. In shadow DOM the browser
    // does slot projection natively and synchronously, so firstUpdated
    // observes the populated assigned-nodes list with no extra ticks.
    const tag = tagName('shadow-first-updated');
    const log = {};
    class C extends WebComponent {
      static shadow = true;
      firstUpdated() {
        const slot = this.shadowRoot.querySelector('slot');
        log.assignedAtFirstUpdated = slot ? slot.assignedNodes().length : -1;
      }
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);

    const host = document.createElement(tag);
    host.innerHTML = '<h1>A</h1><h2>B</h2>';
    document.body.appendChild(host);
    await tick();

    assert.equal(log.assignedAtFirstUpdated, 2,
      'shadow DOM: native projection means firstUpdated already sees assigned nodes');

    host.remove();
  });
});
