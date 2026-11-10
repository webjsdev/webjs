/**
 * Lit's `static styles` shapes in a shadow component: nested arrays, a
 * constructed `CSSStyleSheet`, a shared sheet per `css` result, and the loud
 * error a light-DOM component with `static styles` gets.
 */
import { html } from '../../../src/html.js';
import { css, unsafeCSS } from '../../../src/css.js';
import { WebComponent } from '../../../src/component.js';
import { assert } from '../../../../../test/browser-assert.js';

let n = 0;
const tag = () => `adopt-el-${++n}`;

suite('static styles in the browser', () => {
  test('nested arrays and a CSSStyleSheet all apply, later entries win', async () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('p { font-weight: 700; }');
    class E extends WebComponent {
      static shadow = true;
      static styles = [css`p { color: rgb(255, 0, 0); }`, [sheet, [css`p { color: rgb(0, 128, 0); }`]]];
      render() { return html`<p>x</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    const p = el.shadowRoot.querySelector('p');
    assert.equal(getComputedStyle(p).color, 'rgb(0, 128, 0)');
    assert.equal(getComputedStyle(p).fontWeight, '700');
    assert.equal(el.shadowRoot.adoptedStyleSheets.length, 3);
    assert.equal(E.elementStyles.length, 3);
    el.remove();
  });

  test('two elements share one constructed sheet per css result', async () => {
    const shared = css`p { margin: 0; }`;
    class E extends WebComponent {
      static shadow = true;
      static styles = shared;
      render() { return html`<p></p>`; }
    }
    E.register(tag());
    const a = new E();
    const b = new E();
    document.body.append(a, b);
    await a.updateComplete;
    await b.updateComplete;
    assert.equal(a.shadowRoot.adoptedStyleSheets[0], b.shadowRoot.adoptedStyleSheets[0]);
    assert.equal(a.shadowRoot.adoptedStyleSheets[0], shared.styleSheet);
    a.remove();
    b.remove();
  });

  test('unsafeCSS composes a trusted value into a sheet', async () => {
    class E extends WebComponent {
      static shadow = true;
      static styles = css`p { color: ${unsafeCSS('rgb(0, 0, 255)')}; }`;
      render() { return html`<p>x</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    assert.equal(getComputedStyle(el.shadowRoot.querySelector('p')).color, 'rgb(0, 0, 255)');
    el.remove();
  });

  test('a light-DOM component with static styles reports an error once per class', async () => {
    /** @type {unknown[][]} */
    const errors = [];
    const orig = console.error;
    console.error = (...args) => { errors.push(args); };
    try {
      class E extends WebComponent {
        static styles = css`p { color: red; }`;
        render() { return html`<p>x</p>`; }
      }
      E.register(tag());
      const a = new E();
      const b = new E();
      document.body.append(a, b);
      await a.updateComplete;
      await b.updateComplete;
      a.remove();
      b.remove();
    } finally {
      console.error = orig;
    }
    const hits = errors.filter((e) => String(e[0]).includes('static shadow = true'));
    assert.equal(hits.length, 1);
  });
});
