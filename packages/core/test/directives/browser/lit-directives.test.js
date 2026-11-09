/**
 * Client twin of `../lit-directives.test.js`: the lit directive surface WebJs
 * gained renders on the client renderer exactly as lit renders it.
 */
import { html, mathml } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { isServer } from '../../../src/is-server.js';
import {
  repeat, when, choose, map, join, range, unsafeSVG, unsafeMathML,
} from '../../../src/directives.js';
import { html as staticHtml, literal, unsafeStatic } from '../../../src/static-html.js';

import { assert } from '../../../../../test/browser-assert.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

suite('lit directive parity (client)', () => {
  let container;
  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  teardown(() => container.remove());

  test('isServer is false in a browser', () => {
    assert.equal(isServer, false);
  });

  test('repeat(items, template) renders and updates positionally', () => {
    const view = (items) => html`<ul>${repeat(items, (x) => html`<li>${x}</li>`)}</ul>`;
    render(view(['a', 'b']), container);
    assert.equal(strip(container.innerHTML), '<ul><li>a</li><li>b</li></ul>');
    const first = container.querySelector('li');
    render(view(['c', 'b', 'd']), container);
    assert.equal(strip(container.innerHTML), '<ul><li>c</li><li>b</li><li>d</li></ul>');
    // Index keys: position 0 keeps its node and takes the new value.
    assert.equal(container.querySelector('li'), first);
  });

  test('a generator child renders and re-renders like an array', () => {
    const view = (n) => html`<ul>${map(range(n), (i) => html`<li>${i}</li>`)}</ul>`;
    render(view(2), container);
    assert.equal(strip(container.innerHTML), '<ul><li>0</li><li>1</li></ul>');
    render(view(3), container);
    assert.equal(strip(container.innerHTML), '<ul><li>0</li><li>1</li><li>2</li></ul>');
  });

  test('a Set and a join() render like arrays', () => {
    render(html`<p>${new Set(['x', 'y'])}</p><p>${join(['a', 'b'], html`<hr>`)}</p>`, container);
    assert.equal(strip(container.innerHTML), '<p>xy</p><p>a<hr>b</p>');
  });

  test('when / choose pick their case on the client too', () => {
    const view = (on, tab) => html`<p>${when(on, () => html`<b>on</b>`, () => html`<i>off</i>`)}</p>${choose(tab, [['a', () => 'A'], ['b', () => 'B']], () => '?')}`;
    render(view(true, 'b'), container);
    assert.equal(strip(container.innerHTML), '<p><b>on</b></p>B');
    render(view(false, 'z'), container);
    assert.equal(strip(container.innerHTML), '<p><i>off</i></p>?');
  });

  test('unsafeSVG parses its markup in the SVG namespace', () => {
    render(html`<svg>${unsafeSVG('<circle r="1"></circle>')}</svg>`, container);
    const circle = container.querySelector('circle');
    assert.ok(circle, 'circle rendered');
    assert.equal(circle.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(circle.parentNode, container.querySelector('svg'));
  });

  test('unsafeMathML parses its markup in the MathML namespace', () => {
    render(html`<math>${unsafeMathML('<mi>x</mi>')}</math>`, container);
    const mi = container.querySelector('mi');
    assert.ok(mi, 'mi rendered');
    assert.equal(mi.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
  });

  test('the mathml tag builds MathML elements', () => {
    render(html`<math>${mathml`<mi>${'y'}</mi>`}</math>`, container);
    const mi = container.querySelector('mi');
    assert.equal(mi.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
    assert.equal(mi.textContent, 'y');
  });

  test('static-html: a literal tag renders and updates in place', () => {
    const tag = literal`h2`;
    const view = (v) => staticHtml`<${tag} class="t">${v}</${tag}>`;
    render(view('one'), container);
    const h2 = container.querySelector('h2.t');
    assert.ok(h2, 'h2 rendered');
    render(view('two'), container);
    assert.equal(container.querySelector('h2.t'), h2, 'same static shape keeps the DOM');
    assert.equal(h2.textContent, 'two');
    render(staticHtml`<${unsafeStatic('h3')}>x</${unsafeStatic('h3')}>`, container);
    assert.ok(container.querySelector('h3'));
  });
});
