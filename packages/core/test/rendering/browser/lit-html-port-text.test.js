/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/lit-html_test.ts`
 * (suites 'text', 'arrays & iterables', 'svg' and 'MathML', Lit commit
 * b17fb144, #1686 Lit conformance): TypeScript types stripped and imports
 * swapped to WebJs, otherwise case for case. `assertContent` strips WebJs's
 * own `wjm-` marker comments instead of Lit's.
 *
 * Not ported: the `SVGTemplateResult` / `MathMLTemplateResult` subtype tests,
 * which are TypeScript compile-time assertions with no runtime body. Lit's
 * own `renders a Symbol` is `test.skip` upstream and stays skipped here.
 */
import { html, svg, mathml } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing, noChange } from '../../../src/sentinels.js';
import { assert } from '../../../../../test/browser-assert.js';

const stripExpressionComments = (s) => s.replace(/<!--wjm-[\s\S]*?-->/g, '');

suite('lit-html (lit port): text, arrays, svg, MathML', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    container.id = 'container';
  });

  const assertContent = (expected) => {
    assert.equal(stripExpressionComments(container.innerHTML), expected);
  };

  suite('text', () => {
    const assertNoRenderedNodes = () => {
      const children = Array.from(container.querySelector('div').childNodes);
      assert.isEmpty(
        children.filter((node) => node.nodeType !== Node.COMMENT_NODE)
      );
    };

    test('renders plain text expression', () => {
      render(html`test`, container);
      assertContent('test');
    });

    test('renders a string', () => {
      render(html`<div>${'foo'}</div>`, container);
      assertContent('<div>foo</div>');
    });

    test('renders a number', () => {
      render(html`<div>${123}</div>`, container);
      assertContent('<div>123</div>');
    });

    [nothing, undefined, null, ''].forEach((value) => {
      test(`renders '${
        value === '' ? 'empty string' : value === nothing ? 'nothing' : value
      }' as nothing`, () => {
        const template = (i) => html`<div>${i}</div>`;
        render(template(value), container);
        assertNoRenderedNodes();
        render(template('foo'), container);
        render(template(value), container);
        assertNoRenderedNodes();
      });
    });

    test('renders noChange', () => {
      const template = (i) => html`<div>${i}</div>`;
      render(template('foo'), container);
      render(template(noChange), container);
      assertContent('<div>foo</div>');
    });

    test.skip('renders a Symbol', () => {
      render(html`<div>${Symbol('A')}</div>`, container);
      assert.include(
        container.querySelector('div').textContent.toLowerCase(),
        'symbol'
      );
    });

    test('does not call a function bound to text', () => {
      const f = () => {
        throw new Error();
      };
      render(html`${f}`, container);
    });

    test('renders nested templates', () => {
      const partial = html`<h1>${'foo'}</h1>`;
      render(html`${partial}${'bar'}`, container);
      assertContent('<h1>foo</h1>bar');
    });

    test('renders a template nested multiple times', () => {
      const partial = html`<h1>${'foo'}</h1>`;
      render(html`${partial}${'bar'}${partial}${'baz'}qux`, container);
      assertContent('<h1>foo</h1>bar<h1>foo</h1>bazqux');
    });

    test('renders value that switches between template and undefined', () => {
      const go = (v) => render(html`${v}`, container);
      go(undefined);
      assertContent('');
      go(html`<h1>Hello</h1>`);
      assertContent('<h1>Hello</h1>');
    });

    test('renders an element', () => {
      const child = document.createElement('p');
      render(html`<div>${child}</div>`, container);
      assertContent('<div><p></p></div>');
    });

    test('renders forms as elements', () => {
      // Forms are both a Node and iterable, so make sure they are rendered as
      // a Node.

      const form = document.createElement('form');
      const inputOne = document.createElement('input');
      inputOne.name = 'one';
      const inputTwo = document.createElement('input');
      inputTwo.name = 'two';

      form.appendChild(inputOne);
      form.appendChild(inputTwo);

      render(html`${form}`, container);

      assertContent('<form><input name="one"><input name="two"></form>');
    });
  });

  suite('arrays & iterables', () => {
    test('renders arrays', () => {
      render(html`<div>${[1, 2, 3]}</div>`, container);
      assertContent('<div>123</div>');
    });

    test('renders arrays of nested templates', () => {
      render(html`<div>${[1, 2, 3].map((i) => html`${i}`)}</div>`, container);
      assertContent('<div>123</div>');
    });

    test('renders an array of elements', () => {
      const children = [
        document.createElement('p'),
        document.createElement('a'),
        document.createElement('span'),
      ];
      render(html`<div>${children}</div>`, container);
      assertContent('<div><p></p><a></a><span></span></div>');
    });

    test('updates when called multiple times with arrays', () => {
      const ul = (list) => {
        const items = list.map((item) => html`<li>${item}</li>`);
        return html`<ul>${items}</ul>`;
      };
      render(ul(['a', 'b', 'c']), container);
      assertContent('<ul><li>a</li><li>b</li><li>c</li></ul>');
      render(ul(['x', 'y']), container);
      assertContent('<ul><li>x</li><li>y</li></ul>');
    });

    test('updates arrays', () => {
      let items = [1, 2, 3];
      const t = () => html`<div>${items}</div>`;
      render(t(), container);
      assertContent('<div>123</div>');

      items = [3, 2, 1];
      render(t(), container);
      assertContent('<div>321</div>');
    });

    test('updates arrays that shrink then grow', () => {
      let items;
      const t = () => html`<div>${items}</div>`;

      items = [1, 2, 3];
      render(t(), container);
      assertContent('<div>123</div>');

      items = [4];
      render(t(), container);
      assertContent('<div>4</div>');

      items = [5, 6, 7];
      render(t(), container);
      assertContent('<div>567</div>');
    });

    test('updates an array of elements', () => {
      let children = [
        document.createElement('p'),
        document.createElement('a'),
        document.createElement('span'),
      ];
      const t = () => html`<div>${children}</div>`;
      render(t(), container);
      assertContent('<div><p></p><a></a><span></span></div>');

      children = null;
      render(t(), container);
      assertContent('<div></div>');

      children = document.createTextNode('foo');
      render(t(), container);
      assertContent('<div>foo</div>');
    });
  });

  suite('svg', () => {
    test('renders SVG', () => {
      const container = document.createElement('svg');
      const t = svg`<line y1="1" y2="1"/>`;
      render(t, container);
      const line = container.firstElementChild;
      assert.equal(line.tagName, 'line');
      assert.equal(line.namespaceURI, 'http://www.w3.org/2000/svg');
    });
  });

  suite('MathML', () => {
    test('renders MathML', () => {
      const container = document.createElement('math');
      const t = mathml`<mi>x</mi>`;
      render(t, container);
      const mi = container.firstElementChild;
      assert.equal(mi.tagName, 'mi');
      assert.equal(mi.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
    });
  });
});
