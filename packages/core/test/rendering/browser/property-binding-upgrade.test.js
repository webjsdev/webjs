/**
 * A `.prop` binding reaches a defined custom element's own setter (#1686,
 * Lit conformance). Lit clones a template with `document.importNode`, so a
 * defined element is upgraded before its parts are set. WebJs cloned with
 * `content.cloneNode`, which leaves the clone un-upgraded: the binding then
 * created an own property that shadowed the class accessor for good, so a
 * custom element not built on WebComponent (a third-party one) never saw the
 * value, the first time or after.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { assert } from '../../../../../test/browser-assert.js';

class VanillaSetter extends HTMLElement {
  _v = undefined;
  sets = 0;
  get v() { return this._v; }
  set v(x) { this._v = x; this.sets++; }
}
if (!customElements.get('vanilla-setter-el')) customElements.define('vanilla-setter-el', VanillaSetter);

const go = (v, c) => render(html`<vanilla-setter-el .v=${v}></vanilla-setter-el>`, c);

suite('property binding on a defined custom element', () => {
  for (const connected of [true, false]) {
    test(`the class setter receives every value (${connected ? 'connected' : 'detached'} container)`, () => {
      const c = document.createElement('div');
      if (connected) document.body.append(c);
      go('a', c);
      const el = c.firstElementChild;
      assert.ok(el instanceof VanillaSetter, 'upgraded before the binding');
      assert.equal(Object.hasOwn(el, 'v'), false, 'no own property shadows the accessor');
      go('b', c);
      assert.equal(c.firstElementChild, el, 'same element reused');
      assert.equal(el.v, 'b');
      assert.equal(el.sets, 2);
      c.remove();
    });
  }
});
