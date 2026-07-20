/**
 * Phase 3 robustness hinge: the renderer-write window. A renderer commit into
 * a light slot host (including the ASYNC paths that run outside a render()
 * call) must NOT be folded into the slot record as authored content. If it
 * were, streamed/async renderer output would teleport into the slot, which is
 * the #906-class corruption the whole design prevents.
 *
 * Runs in a REAL browser via WTR + Playwright.
 */
import { WebComponent } from '../../../src/component.js';
import { html } from '../../../src/html.js';
import { asyncAppend, until } from '../../../src/directives.js';

import { assert } from '../../../../../test/browser-assert.js';

function tick(ms = 0) {
  return new Promise((r) => setTimeout(r, ms));
}

let n = 0;
const tagName = (p) => `${p}-${n++}`;

suite('Renderer-write window (async commits are not authored)', () => {
  test('asyncAppend streaming into a slotted light host does not pollute the slot', async () => {
    const tag = tagName('stream-host');

    async function* gen() {
      yield html`<em class="chunk">a</em>`;
      await tick(5);
      yield html`<em class="chunk">b</em>`;
    }

    class C extends WebComponent {
      render() {
        // A top-level <slot> AND a top-level asyncAppend hole: both commit
        // with the HOST as receiver. The stream chunks run in an async loop
        // outside render(), so only the renderer-write window keeps them off
        // the authored record.
        return html`<slot></slot>${asyncAppend(gen())}`;
      }
    }
    C.register(tag);

    const host = document.createElement(tag);
    const authored = document.createElement('p');
    authored.className = 'authored';
    host.appendChild(authored);
    document.body.appendChild(host);

    // Let the first render + both stream chunks land.
    await tick(30);

    const slot = host.querySelector('slot[data-webjs-light]');
    // The slot holds ONLY the authored <p>, never the streamed <em> chunks.
    assert.equal(slot.querySelectorAll('.chunk').length, 0, 'stream chunks did not enter the slot');
    assert.equal(slot.querySelectorAll('.authored').length, 1, 'authored child stayed projected');
    // The stream chunks rendered as the host's own output (siblings of the slot).
    assert.equal(host.querySelectorAll('.chunk').length, 2, 'both chunks rendered as renderer output');

    host.remove();
  });

  test('an until resolution into a slotted host does not pollute the slot', async () => {
    const tag = tagName('until-host');
    let resolve;
    const slow = new Promise((r) => { resolve = r; });

    class C extends WebComponent {
      render() {
        // A top-level <slot> AND a top-level until hole. until commits the
        // resolved value from a promise callback, OUTSIDE render(), so only the
        // renderer-write window (via applyChildInner -> commitInto) keeps it
        // off the authored record.
        return html`<slot></slot>${until(slow, html`<em class="pending">loading</em>`)}`;
      }
    }
    C.register(tag);

    const host = document.createElement(tag);
    const authored = document.createElement('p');
    authored.className = 'authored';
    host.appendChild(authored);
    document.body.appendChild(host);
    await tick(5);

    resolve(html`<em class="resolved">done</em>`);
    await tick(15);

    const slot = host.querySelector('slot[data-webjs-light]');
    assert.equal(slot.querySelectorAll('.resolved').length, 0, 'resolved chunk did not enter the slot');
    assert.equal(slot.querySelectorAll('.authored').length, 1, 'authored child stayed projected');
    assert.equal(host.querySelectorAll('.resolved').length, 1, 'until resolved as renderer output');
    host.remove();
  });

  test('a component whose render() returns a plain string shows its text (not blank)', async () => {
    // Non-template render path: host[INSTANCE] is null and the text nodes are
    // direct host children. The window-close drain must NOT fold them into the
    // slot record (which would park them and render the component blank).
    const tag = tagName('string-render');
    class C extends WebComponent({ n: Number }) {
      constructor() { super(); this.n = 5; }
      render() { return `Count: ${this.n}`; }
    }
    C.register(tag);
    const host = document.createElement(tag);
    document.body.appendChild(host);
    await tick(0);
    assert.equal(host.textContent, 'Count: 5', 'the string render is visible');
    assert.ok(!host.querySelector('wj-slot-park'), 'no park spawned for renderer text');
    host.remove();
  });

  test('a reactive re-render does not fold rendered output into the slot record', async () => {
    const tag = tagName('rerender-host');
    class C extends WebComponent({ count: Number }) {
      constructor() { super(); this.count = 0; }
      render() {
        return html`<div class="body">count:${this.count}</div><slot></slot>`;
      }
    }
    C.register(tag);
    const host = document.createElement(tag);
    const authored = document.createElement('span');
    authored.className = 'authored';
    host.appendChild(authored);
    document.body.appendChild(host);
    await tick(0);
    const slot = host.querySelector('slot[data-webjs-light]');
    // Drive several re-renders.
    host.count = 1;
    await tick(0);
    host.count = 2;
    await tick(0);
    assert.equal(slot.querySelectorAll('.authored').length, 1, 'authored child still projected');
    assert.equal(slot.querySelectorAll('.body').length, 0, 'rendered .body never entered the slot');
    assert.ok(host.querySelector('.body').textContent.includes('count:2'), 're-render committed normally');
    host.remove();
  });
});
