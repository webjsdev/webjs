/**
 * Ported from lit-html's `packages/lit-html/src/test/directives/unsafe-svg_test.ts`
 * (#1686, Lit conformance): types stripped by the TypeScript compiler and the
 * imports swapped to WebJs, otherwise case for case.
 */
/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
import { unsafeSVG } from '../../../src/directives.js';
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing, noChange } from '../../../src/sentinels.js';
const stripExpressionMarkers = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
import { assert } from '../../../../../test/browser-assert.js';
// Lit reaches the text node as `childNodes[1]`, which encodes where Lit puts its
// marker comment; WebJs places its markers differently, so the port finds the
// text node instead. The assertions are unchanged.
const textIn = (el) => [...el.childNodes].find((n) => n.nodeType === 3);

suite('unsafeSVG (lit port)', () => {
    let container;
    setup(() => {
        container = document.createElement('div');
    });
    test('renders SVG', () => {
        render(
        // prettier-ignore
        html `<svg>before${unsafeSVG('<line x1="0" y1="0" x2="10" y2="10" stroke="black"/>')}</svg>`, container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg>before<line x1="0" y1="0" x2="10" y2="10" stroke="black"></line></svg>',
            '<svg>before<line stroke="black" x1="0" y1="0" x2="10" y2="10"></line></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg">before<line stroke="black" x1="0" y1="0" x2="10" y2="10" /></svg>',
        ]);
        const lineElement = container.querySelector('line');
        assert.equal(lineElement.namespaceURI, 'http://www.w3.org/2000/svg');
    });
    test('rendering `nothing` renders empty string to content', () => {
        render(html `<svg>before${unsafeSVG(nothing)}after</svg>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<svg>beforeafter</svg>');
    });
    test('rendering `noChange` does not change the previous content', () => {
        const template = (v) => html `<svg>before${unsafeSVG(v)}after</svg>`;
        render(template('<g>Hi</g>'), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<svg>before<g>Hi</g>after</svg>');
        render(template(noChange), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<svg>before<g>Hi</g>after</svg>');
    });
    test('rendering `undefined` renders empty string to content', () => {
        render(html `<svg>before${unsafeSVG(undefined)}after</svg>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<svg>beforeafter</svg>');
    });
    test('rendering `null` renders empty string to content', () => {
        render(html `<svg>before${unsafeSVG(null)}after</svg>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<svg>beforeafter</svg>');
    });
    test('dirty checks primitive values', () => {
        const value = 'aaa';
        const t = () => html `<svg>${unsafeSVG(value)}</svg>`;
        // Initial render
        render(t(), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg>aaa</svg>',
            '<svg xmlns="http://www.w3.org/2000/svg">aaa</svg>',
        ]);
        // Modify instance directly. Since lit-html doesn't dirty check against
        // actual DOM, but against previous part values, this modification should
        // persist through the next render if dirty checking works.
        const text = textIn(container.querySelector('svg'));
        text.textContent = 'bbb';
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg>bbb</svg>',
            '<svg xmlns="http://www.w3.org/2000/svg">bbb</svg>',
        ]);
        // Re-render with the same value
        render(t(), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg>bbb</svg>',
            '<svg xmlns="http://www.w3.org/2000/svg">bbb</svg>',
        ]);
        const text2 = textIn(container.querySelector('svg'));
        assert.strictEqual(text, text2);
    });
    test('throws on non-string values', () => {
        const value = ['aaa'];
        const t = () => html `<div>${unsafeSVG(value)}</div>`;
        assert.throws(() => render(t(), container));
    });
    test('renders after other values', () => {
        const value = '<text></text>';
        const primitive = 'aaa';
        const t = (content) => html `<svg>${content}</svg>`;
        // Initial unsafeSVG render
        render(t(unsafeSVG(value)), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg><text></text></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><text /></svg>',
        ]);
        // Re-render with a non-unsafeSVG value
        render(t(primitive), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg>aaa</svg>',
            '<svg xmlns="http://www.w3.org/2000/svg">aaa</svg>',
        ]);
        // Re-render with unsafeSVG again
        render(t(unsafeSVG(value)), container);
        assert.oneOf(stripExpressionMarkers(container.innerHTML), [
            '<svg><text></text></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><text /></svg>',
        ]);
    });
});
