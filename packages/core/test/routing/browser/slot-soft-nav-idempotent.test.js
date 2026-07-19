/**
 * Real-browser regression for #1006, the CLIENT-ROUTER paths: a slotted
 * light-DOM component must not double its render output when the router
 * re-inserts it on a soft nav or a back/forward snapshot restore.
 *
 * Two independent paths reach the buggy `captureAuthoredChildren` branch, and
 * both are browser-independent (they do not need a comment-stripping parser):
 *
 *   Path 1 (forward soft nav): the incoming SSR host is parsed and grafted in.
 *   Path 2 (snapshot restore): `snapshotCurrent` stores the LIVE, already-
 *     hydrated `documentElement.outerHTML` (whose hosts no longer carry the
 *     `webjs-hydrate` marker, since hydration removed it). On back/forward that
 *     marker-less HTML is parsed and each host imported via
 *     `document.importNode(node, true)` and inserted, firing `connectedCallback`.
 *
 * This test reproduces the snapshot round-trip exactly: render a live component,
 * serialize it (what the snapshot stores), parse it back through the router's
 * own `parseHTML`, `importNode` the host, and connect it. Without the fix the
 * reconnected host shows the render output nested inside its own slot (two
 * buttons); with the fix it projects the authored content exactly once.
 *
 * It runs on the lossless runner Chromium, so it CANNOT pass by accident on a
 * comment-preserving parser: the marker is absent by DESIGN here (the live DOM
 * never had it after hydration), not because a parser stripped it. Counterfactual:
 * revert the `isAlreadyProjected` guard in `slot.js` and both assertions go red.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { _parseHTML } from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

function tick() {
  return new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
}

let counter = 0;

suite('Client router: slotted component survives a snapshot restore without doubling (#1006)', () => {

  test('a re-imported already-hydrated host projects its authored content exactly once', async () => {
    const tag = `snap-copy-${counter++}`;
    class SnapCopy extends WebComponent({ copied: Boolean }) {
      constructor() { super(); this.copied = false; }
      render() {
        return html`<span class="group"
          ><span data-copy-text><slot></slot></span
          ><button @click=${() => { this.copied = true; }}>copy</button></span>`;
      }
    }
    customElements.define(tag, SnapCopy);

    // 1. A live, hydrated component: authored text projected into its slot.
    const live = document.createElement(tag);
    live.innerHTML = 'npm create webjs@latest my-app';
    document.body.appendChild(live);
    await live.updateComplete;
    await tick();
    assert.equal(live.querySelectorAll('button').length, 1, 'live: one button');
    assert.equal(live.querySelector('slot').textContent, 'npm create webjs@latest my-app');

    // 2. The snapshot stores the LIVE, already-hydrated outerHTML. It has NO
    //    webjs-hydrate marker (hydration removed it), but it DOES carry the
    //    durable data-projection="actual" slot.
    const snapshotHTML = live.outerHTML;
    assert.equal(snapshotHTML.includes('webjs-hydrate'), false,
      'the live snapshot never carries the boot-time hydrate marker');
    assert.equal(snapshotHTML.includes('data-projection="actual"'), true,
      'the live snapshot carries the durable projection marker');

    // 3. Back/forward restore: parse that HTML through the router parser and
    //    import + connect the host, exactly as applySwap does.
    const doc = _parseHTML(`<!doctype html><html><body>${snapshotHTML}</body></html>`);
    const parsedHost = doc.body.querySelector(tag);
    assert.ok(parsedHost, 'parsed the host back out of the snapshot');
    const restored = document.importNode(parsedHost, true);
    document.body.appendChild(restored); // fires connectedCallback
    await tick();
    await restored.updateComplete;
    await tick();

    // 4. THE ASSERTIONS THAT FAIL WITHOUT THE FIX: no nested render, one button.
    assert.equal(restored.querySelectorAll('button').length, 1,
      'restored host has exactly one button (render not duplicated inside its slot)');
    assert.equal(restored.querySelector('slot [data-copy-text]'), null,
      'no render output nested inside the restored slot');
    assert.equal(restored.querySelector('slot').textContent, 'npm create webjs@latest my-app',
      'authored content projected once into the restored slot');

    // 5. The restored component is still interactive.
    restored.querySelector('button').click();
    await restored.updateComplete;
    assert.equal(restored.copied, true, 'restored component still reacts to a click');

    live.remove();
    restored.remove();
  });
});
