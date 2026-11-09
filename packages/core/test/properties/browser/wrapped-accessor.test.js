/**
 * A declared reactive property whose class defines its own get/set is wrapped
 * the way Lit wraps it: the author's accessor owns the storage (a private
 * field included), and every write still records the change, reflects, and
 * re-renders.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { assert } from '../../../../../test/browser-assert.js';

let n = 0;
const tag = () => `wrapped-acc-${++n}`;

suite('wrapped author accessors', () => {
  test('a private-field accessor renders, reflects, and reads attributes through the setter', async () => {
    class E extends WebComponent {
      static properties = { level: { type: Number, reflect: true } };
      #level = 1;
      get level() { return this.#level; }
      set level(v) { this.#level = Math.max(0, Math.min(5, v)); }
      render() { return html`<p>${this.level}</p>`; }
    }
    const t = tag();
    E.register(t);
    const el = /** @type {any} */ (document.createElement(t));
    document.body.append(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '1');
    el.level = 9;
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '5', 'the author setter clamped it');
    assert.equal(el.getAttribute('level'), '5', 'reflected the clamped value');
    el.setAttribute('level', '-3');
    await el.updateComplete;
    assert.equal(el.level, 0, 'the attribute went through the author setter');
    el.remove();
  });

  test('a value set before upgrade reaches the author setter on connect', async () => {
    const t = tag();
    const el = /** @type {any} */ (document.createElement(t));
    el.level = 4;
    class E extends WebComponent {
      static properties = { level: { type: Number } };
      #level = 0;
      get level() { return this.#level; }
      set level(v) { this.#level = v * 10; }
      render() { return html`<p>${this.level}</p>`; }
    }
    E.register(t);
    document.body.append(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '40');
    el.remove();
  });
});
