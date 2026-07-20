/**
 * Phase 3: native DOM writes on a mounted light-DOM host drive the slot record
 * live, matching shadow-DOM `<slot>` behaviour through the standard API. Runs
 * in a REAL browser via WTR + Playwright.
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

suite('Native-write liveness (light-DOM slot parity)', () => {
  test('insertBefore places a child at a projected reference position', async () => {
    const tag = tagName('insert-before');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    const a = document.createElement('a-el');
    const c = document.createElement('c-el');
    host.appendChild(a);
    host.appendChild(c);
    const b = document.createElement('b-el');
    host.insertBefore(b, c);
    assert.deepEqual(
      Array.from(slot.children).map((e) => e.tagName.toLowerCase()),
      ['a-el', 'b-el', 'c-el'],
      'insertBefore ordered the child at the reference',
    );
    host.remove();
  });

  test('insertBefore with a renderer/non-child ref throws NotFoundError', async () => {
    const tag = tagName('insert-throws');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    let threw = null;
    try {
      host.insertBefore(document.createElement('p'), document.createElement('span'));
    } catch (e) { threw = e; }
    assert.ok(threw, 'insertBefore threw');
    assert.equal(threw.name, 'NotFoundError', 'threw NotFoundError like native');
    host.remove();
  });

  test('appendChild of an already-assigned node MOVES it to the end (reorder)', async () => {
    const tag = tagName('reorder');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    const a = document.createElement('a-el');
    const b = document.createElement('b-el');
    host.appendChild(a);
    host.appendChild(b);
    let fireCount = 0;
    slot.addEventListener('slotchange', () => { fireCount++; });
    host.appendChild(a); // re-append a -> moves to end
    assert.deepEqual(
      Array.from(slot.children).map((e) => e.tagName.toLowerCase()),
      ['b-el', 'a-el'],
      'the re-appended node moved to the end',
    );
    await tick();
    assert.equal(fireCount, 1, 'reorder fired slotchange');
    host.remove();
  });

  test('el.remove() on a projected child sticks (no zombie resurrection)', async () => {
    const tag = tagName('zombie');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    const p = document.createElement('p');
    host.appendChild(p);
    assert.equal(slot.children.length, 1, 'projected');
    p.remove(); // child-receiver removal, bypasses host.removeChild
    assert.equal(p.isConnected, false, 'removed from the DOM');
    // Force a re-render + re-apply; the removed node must NOT come back.
    host.appendChild(document.createElement('span'));
    await tick();
    assert.ok(!slot.contains(p), 'the removed node did not resurrect');
    host.remove();
  });

  test('innerHTML setter replaces authored content and never destroys the render root', async () => {
    const tag = tagName('inner-html');
    const host = await mount(tag, () => html`<div class="shell"><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    host.innerHTML = '<p>one</p><p>two</p>';
    assert.ok(host.querySelector('.shell'), 'the render root (.shell) survived');
    assert.equal(slot.querySelectorAll('p').length, 2, 'both paragraphs projected');
    host.remove();
  });

  test('a DocumentFragment argument is expanded and drained', async () => {
    const tag = tagName('fragment');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createElement('a-el'));
    frag.appendChild(document.createElement('b-el'));
    host.appendChild(frag);
    assert.equal(slot.children.length, 2, 'fragment children projected');
    assert.equal(frag.childNodes.length, 0, 'fragment was drained (native contract)');
    host.remove();
  });

  test('a child whose slot name matches no slot stays connected (parked)', async () => {
    const tag = tagName('park');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const orphan = document.createElement('orphan-el');
    orphan.setAttribute('slot', 'nonexistent');
    host.appendChild(orphan);
    await tick();
    assert.equal(orphan.isConnected, true, 'unmatched-name child stays connected');
    assert.ok(!host.querySelector('slot[data-webjs-light]').contains(orphan), 'not in the default slot');
    host.remove();
  });

  test('name= flip on a projected child is a documented gap without the sensor (phase 4)', async () => {
    // The interception layer alone covers method writes; a raw `slot=` attribute
    // flip is caught by the flip sensor (phase 4). This test asserts the method
    // path; the attribute-flip liveness is verified in the sensors test.
    const tag = tagName('two-slots');
    const host = await mount(tag, () => html`<div><slot name="a"></slot><slot name="b"></slot></div>`);
    const slotA = host.querySelector('slot[name="a"]');
    const slotB = host.querySelector('slot[name="b"]');
    const child = document.createElement('x-el');
    child.setAttribute('slot', 'a');
    host.appendChild(child);
    assert.equal(child.parentElement, slotA, 'placed in slot a by attribute');
    assert.ok(slotB, 'slot b exists');
    host.remove();
  });
});
