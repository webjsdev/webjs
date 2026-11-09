/**
 * Unit tests for css`` tagged template + adoptStyles fallbacks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { css, unsafeCSS, CSSResult, isCSS, adoptStyles, stylesToString } from '../../index.js';
import { finalizeStyles } from '../../src/css.js';

test('css`...` returns a CSSResult object with text + sentinel', () => {
  const r = css`a { color: red; }`;
  assert.equal(r._$webjsCss, true);
  assert.equal(r.text, 'a { color: red; }');
});

test('css interpolation: a string in a hole throws naming unsafeCSS', () => {
  const fg = 'red';
  assert.throws(() => css`a { color: ${fg}; }`, /unsafeCSS/);
});

test('css interpolation: null and undefined throw too', () => {
  assert.throws(() => css`a { color: ${null}; }`, /unsafeCSS/);
  assert.throws(() => css`a{}${undefined}`, /unsafeCSS/);
});

test('css interpolation: a nested css result and a number compose as text', () => {
  const brand = css`#e33`;
  const r = css`a { color: ${brand}; padding: ${4}px; }`;
  assert.equal(r.cssText, 'a { color: #e33; padding: 4px; }');
});

test('unsafeCSS wraps a trusted string and composes into css', () => {
  const r = css`a { color: ${unsafeCSS('red')}; }`;
  assert.equal(r.text, 'a { color: red; }');
  assert.ok(unsafeCSS('x') instanceof CSSResult);
  assert.equal(unsafeCSS(3).cssText, '3');
});

test('a CSSResult stringifies to its text and exposes cssText and text', () => {
  const r = css`b{}`;
  assert.equal(String(r), 'b{}');
  assert.equal(`${r}`, 'b{}');
  assert.equal(r.cssText, r.text);
  assert.equal(r.styleSheet, undefined, 'no constructed sheet on the server');
});

test('finalizeStyles flattens nested arrays and keeps the last duplicate', () => {
  const a = css`a{}`;
  const b = css`b{}`;
  const c = css`c{}`;
  assert.deepEqual(finalizeStyles([a, [b, [a, c]]]), [b, a, c]);
  assert.deepEqual(finalizeStyles(a), [a]);
  assert.deepEqual(finalizeStyles(null), []);
  assert.deepEqual(finalizeStyles(undefined), []);
});

test('isCSS: true for css`` results, false for other objects/primitives', () => {
  assert.equal(isCSS(css`x{}`), true);
  assert.equal(isCSS({ text: 'x', _$webjsCss: false }), false);
  assert.equal(isCSS({}), false);
  assert.equal(isCSS(null), false);
  assert.equal(isCSS('a{}'), false);
});

test('stylesToString: empty input returns empty string', () => {
  assert.equal(stylesToString([]), '');
  assert.equal(stylesToString(null), '');
  assert.equal(stylesToString(undefined), '');
});

test('stylesToString: wraps concatenated text in a <style> tag', () => {
  const out = stylesToString([css`a{}`, css`b{}`]);
  assert.equal(out, '<style>a{}\nb{}</style>');
});

test('adoptStyles: no-op on empty/nullish input', () => {
  assert.doesNotThrow(() => adoptStyles(/** @type any */ ({}), []));
  assert.doesNotThrow(() => adoptStyles(/** @type any */ ({}), null));
});

test('adoptStyles: uses adoptedStyleSheets when available on the root', () => {
  // Simulate a ShadowRoot that supports adoptedStyleSheets. Node has no
  // native CSSStyleSheet; shim a minimal one that records replaceSync().
  const replaced = [];
  class FakeSheet {
    replaceSync(text) { replaced.push(text); }
  }
  const prev = /** @type any */ (globalThis).CSSStyleSheet;
  /** @type any */ (globalThis).CSSStyleSheet = FakeSheet;
  try {
    const root = /** @type any */ ({ adoptedStyleSheets: [] });
    adoptStyles(root, [css`a{color:red}`, css`b{display:none}`]);
    assert.equal(root.adoptedStyleSheets.length, 2);
    assert.equal(replaced[0], 'a{color:red}');
    assert.equal(replaced[1], 'b{display:none}');
  } finally {
    /** @type any */ (globalThis).CSSStyleSheet = prev;
  }
});

test('adoptStyles: falls back to <style> tag when adoptedStyleSheets unavailable', () => {
  // Simulate a legacy root without adoptedStyleSheets. In this branch
  // the code calls `document.createElement('style')` and appends it to
  // the root: we shim both.
  const appended = [];
  const el = { textContent: '' };
  const docBefore = globalThis.document;
  globalThis.document = /** @type any */ ({
    createElement: (tag) => { assert.equal(tag, 'style'); return el; },
  });
  try {
    const root = /** @type any */ ({
      // Critically: NO adoptedStyleSheets property, NO CSSStyleSheet
      // constructor reachability is still fine: the guard on line 32
      // is `'adoptedStyleSheets' in root`, which is false here.
      appendChild: (node) => { appended.push(node); },
    });
    adoptStyles(root, [css`a{color:red}`, css`b{display:none}`]);
    assert.equal(appended.length, 1);
    assert.equal(appended[0], el);
    assert.equal(el.textContent, 'a{color:red}\nb{display:none}');
  } finally {
    globalThis.document = docBefore;
  }
});
