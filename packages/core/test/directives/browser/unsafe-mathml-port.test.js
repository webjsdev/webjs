/**
 * Ported from lit-html's `packages/lit-html/src/test/directives/unsafe-mathml_test.ts`
 * (#1686, Lit conformance): types stripped by the TypeScript compiler and the
 * imports swapped to WebJs, otherwise case for case.
 */
/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
import { unsafeMathML } from '../../../src/directives.js';
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing, noChange } from '../../../src/sentinels.js';
const stripExpressionMarkers = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
import { assert } from '../../../../../test/browser-assert.js';
// Lit reaches the text node as `childNodes[1]`, which encodes where Lit puts its
// marker comment; WebJs places its markers differently, so the port finds the
// text node instead. The assertions are unchanged.
const textIn = (el) => [...el.childNodes].find((n) => n.nodeType === 3);

suite('unsafeMathML (lit port)', () => {
    let container;
    setup(() => {
        container = document.createElement('div');
    });
    test('renders MathML', () => {
        render(
        // prettier-ignore
        html `<math>${unsafeMathML('<mi>x</mi>')}</math>`, container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math><mi>x</mi></math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
        ]);
        const miElement = container.querySelector('mi');
        assert.equal(miElement.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
    });
    test('rendering `nothing` renders empty string to content', () => {
        render(html `<math>before${unsafeMathML(nothing)}after</math>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<math>beforeafter</math>');
    });
    test('rendering `noChange` does not change the previous content', () => {
        const template = (v) => html `<math>before${unsafeMathML(v)}after</math>`;
        render(template('<mi>Hi</mi>'), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<math>before<mi>Hi</mi>after</math>');
        render(template(noChange), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<math>before<mi>Hi</mi>after</math>');
    });
    test('rendering `undefined` renders empty string to content', () => {
        render(html `<math>before${unsafeMathML(undefined)}after</math>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<math>beforeafter</math>');
    });
    test('rendering `null` renders empty string to content', () => {
        render(html `<math>before${unsafeMathML(null)}after</math>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<math>beforeafter</math>');
    });
    test('dirty checks primitive values', () => {
        const value = 'aaa';
        const t = () => html `<math>${unsafeMathML(value)}</math>`;
        // Initial render
        render(t(), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math>aaa</math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML">aaa</math>',
        ]);
        // Modify instance directly. Since lit-html doesn't dirty check against
        // actual DOM, but against previous part values, this modification should
        // persist through the next render if dirty checking works.
        const text = textIn(container.querySelector('math'));
        text.textContent = 'bbb';
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math>bbb</math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML">bbb</math>',
        ]);
        // Re-render with the same value
        render(t(), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math>bbb</math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML">bbb</math>',
        ]);
        const text2 = textIn(container.querySelector('math'));
        assert.strictEqual(text, text2);
    });
    test('throws on non-string values', () => {
        const value = ['aaa'];
        const t = () => html `<div>${unsafeMathML(value)}</div>`;
        assert.throws(() => render(t(), container));
    });
    test('renders after other values', () => {
        const value = '<mi>x</mi>';
        const primitive = 'aaa';
        const t = (content) => html `<math>${content}</math>`;
        // Initial unsafeMath render
        render(t(unsafeMathML(value)), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math><mi>x</mi></math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
        ]);
        // Re-render with a non-unsafeMath value
        render(t(primitive), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math>aaa</math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML">aaa</math>',
        ]);
        // Re-render with unsafeMath again
        render(t(unsafeMathML(value)), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<math><mi>x</mi></math>',
            '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
        ]);
    });
});
