/**
 * Phase 4: the two read-only slot sensors.
 *   - flip sensor: an `el.slot=` flip on a projected child, and a slot `name=`
 *     change, re-project live.
 *   - bypass backstop: a raw `Node.prototype.appendChild.call(host, x)` (and its
 *     removal) that skips the patched methods is still folded into the record.
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

suite('Slot sensors', () => {
  test('flip sensor: el.slot= flip re-projects a child between named slots', async () => {
    const tag = tagName('flip');
    const host = await mount(tag, () => html`<div><slot name="a"></slot><slot name="b"></slot></div>`);
    const slotA = host.querySelector('slot[name="a"]');
    const slotB = host.querySelector('slot[name="b"]');
    const child = document.createElement('x-el');
    child.setAttribute('slot', 'a');
    host.appendChild(child);
    assert.equal(child.parentElement, slotA, 'starts in slot a');
    // A raw attribute flip (not a method call). Only the flip sensor catches it.
    child.setAttribute('slot', 'b');
    await tick();
    assert.equal(child.parentElement, slotB, 'flip re-projected into slot b');
    host.remove();
  });

  test('bypass backstop: Node.prototype.appendChild.call folds into the record', async () => {
    const tag = tagName('bypass-add');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    const p = document.createElement('p');
    // Bypass the patched appendChild entirely.
    Node.prototype.appendChild.call(host, p);
    await tick();
    assert.equal(p.parentElement, slot, 'the bypass-added node was projected by the backstop');
    host.remove();
  });

  test('bypass backstop: a raw direct-child removal un-authors the node', async () => {
    const tag = tagName('bypass-remove');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    const slot = host.querySelector('slot[data-webjs-light]');
    const p = document.createElement('p');
    host.appendChild(p);
    assert.equal(slot.children.length, 1, 'projected');
    // The node lives in the slot; move it out via a raw removal from the slot.
    Node.prototype.removeChild.call(slot, p);
    await tick();
    // A later re-apply must not resurrect it.
    host.appendChild(document.createElement('span'));
    await tick();
    assert.ok(!slot.contains(p), 'the raw-removed node did not resurrect');
    host.remove();
  });

  test('sensors survive a disconnect/reconnect and stay live', async () => {
    const tag = tagName('reconnect');
    const host = await mount(tag, () => html`<div><slot></slot></div>`);
    host.remove();
    await tick();
    document.body.appendChild(host); // reconnect
    await tick();
    const slot = host.querySelector('slot[data-webjs-light]');
    const p = document.createElement('p');
    host.appendChild(p); // patched method still live after reconnect
    assert.equal(p.parentElement, slot, 'append is still live after reconnect');
    host.remove();
  });
});
