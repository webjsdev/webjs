/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/lit-html_test.ts`
 * (suites 'attributes', 'boolean attributes' and 'properties', Lit commit
 * b17fb144, #1686 Lit conformance): TypeScript types stripped and imports
 * swapped to WebJs, otherwise case for case. `assertContent` strips WebJs's
 * own `wjm-` marker comments instead of Lit's. Lit's `isIe` branches take the
 * evergreen-browser path.
 *
 * Lit's own `renders a Symbol to an attribute` and `renders a Symbol in an
 * array to an attribute` are `test.skip` upstream and stay skipped here.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing, noChange } from '../../../src/sentinels.js';
import { assert } from '../../../../../test/browser-assert.js';

const stripExpressionComments = (s) => s.replace(/<!--wjm-[\s\S]*?-->/g, '');

suite('lit-html (lit port): attributes, boolean attributes, properties', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    container.id = 'container';
  });

  const assertRender = (r, expected, options) => {
    const part = render(r, container, options);
    if (Array.isArray(expected)) {
      assert.include(expected, stripExpressionComments(container.innerHTML));
    } else {
      assert.equal(stripExpressionComments(container.innerHTML), expected);
    }
    return part;
  };

  const assertContent = (expected) => {
    assert.equal(stripExpressionComments(container.innerHTML), expected);
  };

  suite('attributes', () => {
    test('renders to a quoted attribute', () => {
      render(html`<div foo="${'bar'}"></div>`, container);
      assertContent('<div foo="bar"></div>');
    });

    test('renders to an unquoted attribute', () => {
      assertRender(html`<div foo=${'bar'}></div>`, '<div foo="bar"></div>');
      assertRender(
        html`<div foo=${'bar'}/baz></div>`,
        '<div foo="bar/baz"></div>'
      );
    });

    test('renders to an unquoted attribute after an unbound unquoted attribute', () => {
      assertRender(
        html`<div foo=bar baz=${'qux'}></div>`,
        '<div foo="bar" baz="qux"></div>'
      );
      assertRender(
        html`<div foo=a/b baz=${'qux'}></div>`,
        '<div foo="a/b" baz="qux"></div>'
      );
    });

    test('renders interpolation to a quoted attribute', () => {
      render(html`<div foo="A${'B'}C"></div>`, container);
      assertContent('<div foo="ABC"></div>');
      render(html`<div foo="${'A'}B${'C'}"></div>`, container);
      assertContent('<div foo="ABC"></div>');
    });

    test('renders interpolation to an unquoted attribute', () => {
      render(html`<div foo=A${'B'}C></div>`, container);
      assertContent('<div foo="ABC"></div>');
      render(html`<div foo=${'A'}B${'C'}></div>`, container);
      assertContent('<div foo="ABC"></div>');
    });

    test('renders interpolation to an unquoted attribute with nbsp character', () => {
      assertRender(
        html`<div a=${'A'} ${'B'}></div>`,
        '<div a="A&nbsp;B"></div>'
      );
    });

    test('renders interpolation to a quoted attribute with nbsp character', () => {
      assertRender(
        html`<div a="${'A'} ${'B'}"></div>`,
        '<div a="A&nbsp;B"></div>'
      );
    });

    test('renders non-latin attribute name and interpolated unquoted non-latin values', () => {
      assertRender(
        html`<div ふ=ふ${'ふ'}ふ フ=フ${'フ'}フ></div>`,
        '<div ふ="ふふふ" フ="フフフ"></div>'
      );
    });

    test('renders multiple bindings in an attribute', () => {
      render(html`<div foo="a${'b'}c${'d'}e"></div>`, container);
      assertContent('<div foo="abcde"></div>');
    });

    test('renders two attributes on one element', () => {
      const result = html`<div a="${1}" b="${2}"></div>`;
      render(result, container);
      assertContent('<div a="1" b="2"></div>');
    });

    test('renders multiple bindings in two attributes', () => {
      render(
        html`<div foo="a${'b'}c${'d'}e" bar="a${'b'}c${'d'}e"></div>`,
        container
      );
      assertContent('<div foo="abcde" bar="abcde"></div>');
    });

    test.skip('renders a Symbol to an attribute', () => {
      render(html`<div foo=${Symbol('A')}></div>`, container);
      assert.include(container.querySelector('div').getAttribute('foo'), '');
    });

    test.skip('renders a Symbol in an array to an attribute', () => {
      render(html`<div foo=${[Symbol('A')]}></div>`, container);
      assert.include(container.querySelector('div').getAttribute('foo'), '');
    });

    test('renders a binding in a style attribute', () => {
      const t = html`<div style="color: ${'red'}"></div>`;
      render(t, container);
      assertContent('<div style="color: red"></div>');
    });

    test('renders multiple bindings in a style attribute', () => {
      const t = html`<div style="${'color'}: ${'red'}"></div>`;
      render(t, container);
      assertContent('<div style="color: red"></div>');
    });

    test('renders a binding in a class attribute', () => {
      render(html`<div class="${'red'}"></div>`, container);
      assertContent('<div class="red"></div>');
    });

    test('renders a binding in an input value attribute', () => {
      render(html`<input value="${'the-value'}" />`, container);
      assertContent('<input value="the-value">');
      assert.equal(container.querySelector('input').value, 'the-value');
    });

    test('renders a case-sensitive attribute', () => {
      const size = 100;
      render(html`<svg viewBox="0 0 ${size} ${size}"></svg>`, container);
      assert.include(
        stripExpressionComments(container.innerHTML),
        'viewBox="0 0 100 100"'
      );

      // Make sure non-alpha valid attribute name characters are handled
      render(html`<svg view_Box="0 0 ${size} ${size}"></svg>`, container);
      assert.include(
        stripExpressionComments(container.innerHTML),
        'view_Box="0 0 100 100"'
      );
    });

    test('renders to an attribute expression after an attribute literal', () => {
      render(html`<div a="b" foo="${'bar'}"></div>`, container);
      // IE and Edge can switch attribute order!
      assert.include(
        ['<div a="b" foo="bar"></div>', '<div foo="bar" a="b"></div>'],
        stripExpressionComments(container.innerHTML)
      );
    });

    test('renders to an attribute expression before an attribute literal', () => {
      render(html`<div foo="${'bar'}" a="b"></div>`, container);
      // IE and Edge can switch attribute order!
      assert.include(
        ['<div a="b" foo="bar"></div>', '<div foo="bar" a="b"></div>'],
        stripExpressionComments(container.innerHTML)
      );
    });

    // Regression test for exception in template parsing caused by attributes
    // reordering when a attribute binding precedes an attribute literal.
    test('renders attribute binding after attribute binding that moved', () => {
      render(
        html`<a href="${'foo'}" class="bar"><div id=${'a'}></div></a>`,
        container
      );
      assertContent(`<a class="bar" href="foo"><div id="a"></div></a>`);
    });

    test('renders a bound attribute without quotes', () => {
      render(html`<div foo=${'bar'}></div>`, container);
      assertContent('<div foo="bar"></div>');
    });

    test('renders multiple bound attributes', () => {
      render(
        html`<div foo="${'Foo'}" bar="${'Bar'}" baz=${'Baz'}></div>`,
        container
      );
      assert.oneOf(stripExpressionComments(container.innerHTML), [
        '<div foo="Foo" bar="Bar" baz="Baz"></div>',
        '<div foo="Foo" baz="Baz" bar="Bar"></div>',
        '<div bar="Bar" foo="Foo" baz="Baz"></div>',
      ]);
    });

    test('renders multiple bound attributes without quotes', () => {
      render(
        html`<div foo=${'Foo'} bar=${'Bar'} baz=${'Baz'}></div>`,
        container
      );
      assert.oneOf(stripExpressionComments(container.innerHTML), [
        '<div foo="Foo" bar="Bar" baz="Baz"></div>',
        '<div foo="Foo" baz="Baz" bar="Bar"></div>',
        '<div bar="Bar" foo="Foo" baz="Baz"></div>',
      ]);
    });

    test('renders multi-expression attribute without quotes', () => {
      render(html`<div foo="${'Foo'}${'Bar'}"></div>`, container);
      assertContent('<div foo="FooBar"></div>');
    });

    test('renders to attributes with attribute-like values', () => {
      render(html`<div foo="bar=${'foo'}"></div>`, container);
      assertContent('<div foo="bar=foo"></div>');
    });

    test('does not call a function bound to an attribute', () => {
      const f = () => {
        throw new Error();
      };
      render(html`<div foo=${f}></div>`, container);
      const div = container.querySelector('div');
      assert.isTrue(div.hasAttribute('foo'));
    });

    test('renders an array to an attribute', () => {
      render(html`<div foo=${['1', '2', '3']}></div>`, container);
      assertContent('<div foo="1,2,3"></div>');
    });

    test('renders to an attribute before a node', () => {
      render(html`<div foo="${'bar'}">${'baz'}</div>`, container);
      assertContent('<div foo="bar">baz</div>');
    });

    test('renders to an attribute after a node', () => {
      render(html`<div>${'baz'}</div><div foo="${'bar'}"></div>`, container);
      assertContent('<div>baz</div><div foo="bar"></div>');
    });

    test('renders undefined in interpolated attributes', () => {
      render(html`<div attribute="it's ${undefined}"></div>`, container);
      assert.equal(
        stripExpressionComments(container.innerHTML),
        '<div attribute="it\'s "></div>'
      );
    });

    test('renders undefined in attributes', () => {
      render(html`<div attribute="${undefined}"></div>`, container);
      assertContent('<div attribute=""></div>');
    });

    test('renders null in attributes', () => {
      render(html`<div attribute="${null}"></div>`, container);
      assertContent('<div attribute=""></div>');
    });

    test('renders empty string in attributes', () => {
      render(html`<div attribute="${''}"></div>`, container);
      assertContent('<div attribute=""></div>');
    });

    test('renders empty string in interpolated attributes', () => {
      render(html`<div attribute="foo${''}"></div>`, container);
      assertContent('<div attribute="foo"></div>');
    });

    test('initial render of noChange in fully-controlled attribute', () => {
      render(html`<div attribute="${noChange}"></div>`, container);
      assertContent('<div></div>');
    });

    test('renders noChange in attributes, preserves outside attribute value', () => {
      const go = (v) => render(html`<div attribute="${v}"></div>`, container);
      go(noChange);
      assertContent('<div></div>');
      const div = container.querySelector('div');
      div?.setAttribute('attribute', 'A');
      go(noChange);
      assertContent('<div attribute="A"></div>');
    });

    test('nothing sentinel removes an attribute', () => {
      const go = (v) => html`<div a=${v}></div>`;
      render(go(nothing), container);
      assertContent('<div></div>');

      render(go('a'), container);
      assertContent('<div a="a"></div>');

      render(go(nothing), container);
      assertContent('<div></div>');
    });

    test('interpolated nothing sentinel removes an attribute', () => {
      const go = (v) => html`<div a="A${v}"></div>`;
      render(go('a'), container);
      assertContent('<div a="Aa"></div>');

      render(go(nothing), container);
      assertContent('<div></div>');
    });

    test('noChange works', () => {
      const go = (v) => render(html`<div foo=${v}></div>`, container);
      go('A');
      assert.equal(
        stripExpressionComments(container.innerHTML),
        '<div foo="A"></div>',
        'A'
      );
      const observer = new MutationObserver(() => {});
      observer.observe(container, { attributes: true, subtree: true });

      go(noChange);
      assert.equal(
        stripExpressionComments(container.innerHTML),
        '<div foo="A"></div>',
        'B'
      );
      assert.isEmpty(observer.takeRecords());
    });

    test('noChange renders as empty string when used in interpolated attributes', () => {
      const go = (a, b) => render(html`<div foo="${a}:${b}"></div>`, container);

      go('A', noChange);
      assert.equal(
        stripExpressionComments(container.innerHTML),
        '<div foo="A:"></div>',
        'A'
      );

      go('A', 'B');
      assert.equal(
        stripExpressionComments(container.innerHTML),
        '<div foo="A:B"></div>',
        'A'
      );
      go(noChange, 'C');
      assert.equal(
        stripExpressionComments(container.innerHTML),
        '<div foo="A:C"></div>',
        'B'
      );
    });
  });

  suite('boolean attributes', () => {
    test('adds attributes for true values', () => {
      render(html`<div ?foo=${true}></div>`, container);
      assertContent('<div foo=""></div>');
    });

    test('removes attributes for false values', () => {
      render(html`<div ?foo=${false}></div>`, container);
      assertContent('<div></div>');
    });

    test('removes attributes for nothing values', () => {
      const go = (v) => render(html`<div ?foo=${v}></div>`, container);

      go(nothing);
      assertContent('<div></div>');

      go(true);
      assertContent('<div foo=""></div>');

      go(nothing);
      assertContent('<div></div>');
    });

    test('noChange works', () => {
      const go = (v) => render(html`<div ?foo=${v}></div>`, container);
      go(true);
      assertContent('<div foo=""></div>');
      const observer = new MutationObserver(() => {});
      observer.observe(container, { attributes: true, subtree: true });
      go(noChange);
      assertContent('<div foo=""></div>');
      assert.isEmpty(observer.takeRecords());
    });

    test('binding undefined removes the attribute', () => {
      const go = (v) => render(html`<div ?foo=${v}></div>`, container);
      go(undefined);
      assertContent('<div></div>');
      // it doesn't toggle the attribute
      go(undefined);
      assertContent('<div></div>');
      // it does remove it
      go(true);
      assertContent('<div foo=""></div>');
      go(undefined);
      assertContent('<div></div>');
    });
  });

  suite('properties', () => {
    test('sets properties', () => {
      render(html`<div .foo=${123} .Bar=${456}></div>`, container);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, 123);
      assert.strictEqual(div.Bar, 456);
    });

    test('nothing becomes undefined', () => {
      const go = (v) => render(html`<div .foo=${v}></div>`, container);

      go(1);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, 1);

      go(nothing);
      assert.strictEqual(div.foo, undefined);
    });

    test('noChange does not set property', () => {
      const go = (v) => render(html`<div id="a" .tabIndex=${v}></div>`, container);

      go(noChange);
      const div = container.querySelector('div');

      // If noChange has been interpreted as undefined, tabIndex would be 0
      assert.strictEqual(div.tabIndex, -1);
    });

    test('null sets null', () => {
      const go = (v) => render(html`<div .foo=${v}></div>`, container);

      go(null);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, null);
    });

    // Deliberate WebJs difference (packages/core/AGENTS.md "Lit JavaScript API
    // compatibility"): a `.property` binding takes exactly one expression, and
    // more than one throws with the fix in the message.
    test.skip('null in multiple part sets empty string', () => {
      const go = (v1, v2) => render(html`<div .foo="${v1}${v2}"></div>`, container);

      go('hi', null);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, 'hi');
    });

    test('undefined sets undefined', () => {
      const go = (v) => render(html`<div .foo=${v}></div>`, container);

      go(undefined);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, undefined);
    });

    // Deliberate WebJs difference, as above: one expression per `.property`.
    test.skip('undefined in multiple part sets empty string', () => {
      const go = (v1, v2) => render(html`<div .foo="${v1}${v2}"></div>`, container);

      go('hi', undefined);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, 'hi');
    });

    test('noChange works', () => {
      const go = (v) => render(html`<div .foo=${v}></div>`, container);
      go(1);
      const div = container.querySelector('div');
      assert.strictEqual(div.foo, 1);

      go(noChange);
      assert.strictEqual(div.foo, 1);
    });
  });
});
