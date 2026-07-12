/**
 * Ported from lit-html's `keyed` directive test suite
 * (packages/lit-html/src/test/directives/keyed_test.ts).
 *
 * Tests the marker-based key tracking on a child part: same key
 * preserves DOM identity via in-place reconciliation, different key
 * tears down and remounts. State stored at `part.__keyedKey`.
 *
 * Lit's test uses `.foo=${k}` on a native <div>. webjs drops native-
 * element property bindings at SSR but the client renderer applies
 * them, so this test exercises the same behaviour. We also assert
 * via the HTML shape rather than the lit stripExpressionMarkers
 * helper (webjs uses different marker comments).
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { keyed } from '../../../src/directives.js';

import { assert } from '../../../../../test/browser-assert.js';

function stripExpressionComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

suite('keyed directive (lit parity port)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    container.remove();
  });

  test('re-renders when the key changes', () => {
    // Note: lit calls `render(keyed(...), container)` directly. webjs's
    // top-level `render()` only handles TemplateResult; raw directive
    // objects at the root are no-ops. Wrap in an outer template so the
    // directive is applied to a child part (the lit-html-internal path
    // they actually want to exercise).
    const go = (k) =>
      render(html`${keyed(k, html`<div .foo=${k}></div>`)}`, container);

    // Initial render.
    go(1);
    const div = container.firstElementChild;
    assert.ok(div, 'div rendered');
    assert.equal(div.tagName, 'DIV');
    assert.equal(div.foo, 1);

    // Rerender with same key should reuse the DOM.
    go(1);
    const div2 = container.firstElementChild;
    assert.equal(div2.tagName, 'DIV');
    assert.equal(div2.foo, 1);
    assert.strictEqual(div, div2);

    // Rerender with a different key should not reuse the DOM.
    go(2);
    const div3 = container.firstElementChild;
    assert.equal(div3.tagName, 'DIV');
    assert.equal(div3.foo, 2);
    assert.notStrictEqual(div, div3);
  });
});
