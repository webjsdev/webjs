/**
 * Ported from lit-html's `packages/lit-html/src/test/directives/unsafe-html_test.ts`
 * (#1686, Lit conformance): types stripped by the TypeScript compiler and the
 * imports swapped to WebJs, otherwise case for case.
 */
/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
import { unsafeHTML } from '../../../src/directives.js';
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing, noChange } from '../../../src/sentinels.js';
const stripExpressionMarkers = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
import { assert } from '../../../../../test/browser-assert.js';
// Lit reaches the text node as `childNodes[1]`, which encodes where Lit puts its
// marker comment; WebJs places its markers differently, so the port finds the
// text node instead. The assertions are unchanged.
const textIn = (el) => [...el.childNodes].find((n) => n.nodeType === 3);

suite('unsafeHTML directive (lit port)', () => {
    let container;
    setup(() => {
        container = document.createElement('div');
    });
    test('renders HTML', () => {
        render(html `<div>before${unsafeHTML('<span>inner</span>after')}</div>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>before<span>inner</span>after</div>');
    });
    test('rendering `nothing` renders empty string to content', () => {
        render(html `<div>before${unsafeHTML(nothing)}after</div>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>beforeafter</div>');
    });
    test('rendering `noChange` does not change the previous content', () => {
        const template = (v) => html `<div>before${unsafeHTML(v)}after</div>`;
        render(template('<p>Hi</p>'), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>before<p>Hi</p>after</div>');
        render(template(noChange), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>before<p>Hi</p>after</div>');
    });
    test('rendering `undefined` renders empty string to content', () => {
        render(html `<div>before${unsafeHTML(undefined)}after</div>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>beforeafter</div>');
    });
    test('rendering `null` renders empty string to content', () => {
        render(html `<div>before${unsafeHTML(null)}after</div>`, container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>beforeafter</div>');
    });
    test('dirty checks primitive values', () => {
        const value = 'aaa';
        const t = () => html `<div>${unsafeHTML(value)}</div>`;
        // Initial render
        render(t(), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>aaa</div>');
        // Modify instance directly. Since lit-html doesn't dirty check against
        // actual DOM, but against previous part values, this modification should
        // persist through the next render if dirty checking works.
        const text = textIn(container.querySelector('div'));
        text.textContent = 'bbb';
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>bbb</div>', 'A');
        // Re-render with the same value
        render(t(), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>bbb</div>', 'B');
        const text2 = textIn(container.querySelector('div'));
        assert.strictEqual(text, text2);
    });
    test('throws on non-string values', () => {
        const value = ['aaa'];
        const t = () => html `<div>${unsafeHTML(value)}</div>`;
        assert.throws(() => render(t(), container));
    });
    test('renders after other values', () => {
        const value = '<span></span>';
        const primitive = 'aaa';
        const t = (content) => html `<div>${content}</div>`;
        // Initial unsafeHTML render
        render(t(unsafeHTML(value)), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div><span></span></div>');
        // Re-render with a non-unsafeHTML value
        render(t(primitive), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div>aaa</div>');
        // Re-render with unsafeHTML again
        render(t(unsafeHTML(value)), container);
        assert.equal(stripExpressionMarkers(container.innerHTML), '<div><span></span></div>');
    });
});
