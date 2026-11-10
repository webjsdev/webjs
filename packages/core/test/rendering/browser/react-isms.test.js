/**
 * React-isms in an `html` template are refused by the CLIENT renderer too, in
 * a real browser, with the WebJs fix in the message: `className=` /
 * `htmlFor=` / a capitalised tag at template compile, and a function in an
 * `on*` attribute at commit (which would otherwise write the function's
 * source into the document as an inline handler).
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';

import { assert } from '../../../../../test/browser-assert.js';

function host() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function threw(fn) {
  try { fn(); } catch (e) { return e; }
  return null;
}

suite('React-isms are refused by the client renderer', () => {
  test('className= throws naming class=', () => {
    const el = host();
    const e = threw(() => render(html`<div className="card">x</div>`, el));
    assert.ok(e, 'render must throw');
    assert.ok(/Write `class=`/.test(e.message), e.message);
    el.remove();
  });

  test('htmlFor= throws naming for=', () => {
    const el = host();
    const e = threw(() => render(html`<label htmlFor=${'name'}>Name</label>`, el));
    assert.ok(e && /Write `for=`/.test(e.message), e && e.message);
    el.remove();
  });

  test('a capitalised tag throws', () => {
    const el = host();
    const e = threw(() => render(html`<Link href="/a">a</Link>`, el));
    assert.ok(e && /JSX component/.test(e.message), e && e.message);
    el.remove();
  });

  test('onClick=${fn} throws and writes no source into the document', () => {
    const el = host();
    const marker = () => 'ON_ATTR_LEAK_MARKER';
    const e = threw(() => render(html`<button onClick=${marker}>x</button>`, el));
    assert.ok(e && /@click/.test(e.message), e && e.message);
    assert.ok(!document.body.innerHTML.includes('ON_ATTR_LEAK_MARKER'), 'no source in the document');
    el.remove();
  });

  test('class= and @click render normally', () => {
    const el = host();
    let clicks = 0;
    render(html`<button class="card" @click=${() => { clicks++; }}>x</button>`, el);
    el.querySelector('button').click();
    assert.equal(clicks, 1);
    assert.equal(el.querySelector('button').className, 'card');
    el.remove();
  });
});
