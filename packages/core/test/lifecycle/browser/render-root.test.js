/**
 * Lit's `renderRoot`, `createRenderRoot()` and `static shadowRootOptions` on
 * WebComponent.
 */
import { html } from '../../../src/html.js';
import { css } from '../../../src/css.js';
import { WebComponent } from '../../../src/component.js';
import { assert } from '../../../../../test/browser-assert.js';

let n = 0;
const tag = () => `rr-el-${++n}`;

/**
 * Run the connect step directly and return what it throws. A throw from a
 * custom-element reaction during `append()` is reported to `window.onerror`
 * rather than to the caller, so the test drives `connectedCallback()` itself.
 */
function connectCatching(el) {
  try {
    el.connectedCallback();
  } catch (e) {
    return e;
  }
  return null;
}

suite('renderRoot and createRenderRoot()', () => {
  test('renderRoot is undefined before connect, the element for light DOM, the shadow root for shadow DOM', async () => {
    class Light extends WebComponent { render() { return html`<p>l</p>`; } }
    class Shadow extends WebComponent { static shadow = true; render() { return html`<p>s</p>`; } }
    Light.register(tag());
    Shadow.register(tag());
    const l = new Light();
    const s = new Shadow();
    assert.equal(l.renderRoot, undefined);
    document.body.append(l, s);
    await l.updateComplete;
    await s.updateComplete;
    assert.equal(l.renderRoot, l);
    assert.equal(s.renderRoot, s.shadowRoot);
    assert.equal(s.renderRoot.querySelector('p').textContent, 's');
    l.remove();
    s.remove();
  });

  test("Lit's createRenderRoot() { return this; } renders into light DOM", async () => {
    class E extends WebComponent {
      createRenderRoot() { return this; }
      render() { return html`<p>light</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    assert.equal(el.shadowRoot, null);
    assert.equal(el.querySelector('p').textContent, 'light');
    el.remove();
  });

  test('an override that post-processes super.createRenderRoot() keeps shadow DOM', async () => {
    class E extends WebComponent {
      static shadow = true;
      static styles = css`p { color: rgb(1, 2, 3); }`;
      createRenderRoot() {
        const root = super.createRenderRoot();
        /** @type {any} */ (root).__marked = true;
        return root;
      }
      render() { return html`<p>x</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    assert.ok(/** @type {any} */ (el.shadowRoot).__marked);
    assert.equal(getComputedStyle(el.shadowRoot.querySelector('p')).color, 'rgb(1, 2, 3)');
    el.remove();
  });

  test('createRenderRoot runs once per element, not on every reconnect', async () => {
    let calls = 0;
    class E extends WebComponent {
      createRenderRoot() { calls++; return super.createRenderRoot(); }
      render() { return html`<p></p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    assert.equal(calls, 1);
    el.remove();
  });

  test('shadowRootOptions.delegatesFocus reaches attachShadow', async () => {
    class E extends WebComponent {
      static shadow = true;
      static shadowRootOptions = { mode: 'open', delegatesFocus: true };
      render() { return html`<input>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    assert.equal(el.shadowRoot.delegatesFocus, true);
    el.remove();
  });

  test('a closed mode keeps the root reachable as renderRoot only', async () => {
    class E extends WebComponent {
      static shadow = true;
      static shadowRootOptions = { mode: 'closed' };
      render() { return html`<p>closed</p>`; }
    }
    E.register(tag());
    const el = new E();
    document.body.append(el);
    await el.updateComplete;
    assert.equal(el.shadowRoot, null);
    assert.equal(el.renderRoot.querySelector('p').textContent, 'closed');
    el.remove();
  });

  test('a shadow root without static shadow = true throws naming the fix', () => {
    class E extends WebComponent {
      createRenderRoot() { return this.attachShadow({ mode: 'open' }); }
      render() { return html`<p></p>`; }
    }
    E.register(tag());
    const err = connectCatching(new E());
    assert.ok(err, 'connect threw');
    assert.match(String(/** @type {any} */ (err).message), /static shadow = true/);
  });

  test('static shadow = true with a light root throws naming the fix', () => {
    class E extends WebComponent {
      static shadow = true;
      createRenderRoot() { return this; }
      render() { return html`<p></p>`; }
    }
    E.register(tag());
    const err = connectCatching(new E());
    assert.ok(err, 'connect threw');
    assert.match(String(/** @type {any} */ (err).message), /super\.createRenderRoot\(\)/);
  });
});
