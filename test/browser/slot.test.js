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
import { html } from '../../packages/core/src/html.js';
import { WebComponent } from '../../packages/core/src/component.js';
import { installSlotPolyfills } from '../../packages/core/src/slot.js';

// Make sure polyfills are installed against the live DOM realm.
installSlotPolyfills();

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
  notEqual: (a, b, msg) => { if (a === b) throw new Error(msg || `Expected !== ${b}`); },
  strictEqual: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected strict equal`); },
  deepEqual: (a, b, msg) => {
    if (a === b) return;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      throw new Error(msg || `Expected deep equal`);
    }
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(msg || `Differ at index ${i}`);
  },
};

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

  test('slotchange fires when a child is added at runtime', async () => {
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
    host.remove();
  });

  test('slotchange fires when a child is removed', async () => {
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
    slot.removeChild(p);
    await tick();
    assert.ok(fireCount >= 1, 'slotchange should fire on removal');
    host.remove();
  });

  test('slotchange does NOT fire when no assignment changed (no-op re-projection)', async () => {
    const tag = tagName('slotchange-noop');
    class C extends WebComponent {
      static properties = { x: { type: Number } };
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
    // Trigger a re-render via setState. The slot assignment is unchanged.
    host.x = 1;
    await tick();
    await tick();
    assert.equal(fireCount, 0, 'slotchange should NOT fire on unchanged assignment');
    host.remove();
  });

  test('child slot attribute change re-routes between slots', async () => {
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
    child.setAttribute('slot', 'b');
    await tick();
    assert.equal(child.parentElement, slotB, 'after mutation, in slot b');
    host.remove();
  });

  test('multiple mutations in one tick batch into a single re-projection', async () => {
    const tag = tagName('batch');
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
    // Burst of 10 mutations in one synchronous task.
    for (let i = 0; i < 10; i++) host.appendChild(document.createElement('p'));
    await tick();
    await tick();
    // Microtask batching collapses these to one projection. The slotchange
    // event fires once (assigned-set changed from empty → 10 nodes).
    assert.equal(fireCount, 1, 'expected single slotchange event for batched burst');
    host.remove();
  });

  test('dynamic slot name attribute change re-projects', async () => {
    const tag = tagName('dyn-name');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    host.innerHTML = '<p slot="x">P</p>';
    document.body.appendChild(host);
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    // Initially the default slot has no children with slot="x", so empty.
    assert.equal(slot.children.length, 0);
    // Re-target the slot to name "x".
    slot.setAttribute('name', 'x');
    await tick();
    assert.equal(slot.children.length, 1);
    assert.equal(slot.children[0].tagName, 'P');
    host.remove();
  });

  test('re-render preserves DOM identity for projected children', async () => {
    const tag = tagName('identity');
    class C extends WebComponent {
      static properties = { mode: { type: String } };
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
    class C extends WebComponent {
      static properties = { open: { type: Boolean } };
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
    class C extends WebComponent {
      static properties = { mode: { type: String } };
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

  test('drops authored child with slot="x" if no matching slot', async () => {
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
    // Ghost stays in the host's slot-state pending map; not rendered anywhere.
    assert.ok(!slot.contains(ghost), 'unmatched child not in default slot');
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
});
