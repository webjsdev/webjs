/**
 * `observeLazy` is now called by the boot script AND by every served module
 * whose import of a `static lazy` component was deferred to it (#1524), so it
 * must not stack a new MutationObserver per call. Run against stub DOM globals:
 * the loader only touches IntersectionObserver, MutationObserver, document and
 * customElements.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

let mutationObservers = 0;
const observed = [];
globalThis.MutationObserver = class { constructor() { mutationObservers++; } observe() {} };
globalThis.IntersectionObserver = class { observe(el) { observed.push(el); } unobserve() {} };
const defined = new Set(['x-already']);
globalThis.customElements = { get: (t) => (defined.has(t) ? class {} : undefined) };
const els = { 'x-one': [{ tagName: 'X-ONE' }], 'x-two': [{ tagName: 'X-TWO' }], 'x-already': [{ tagName: 'X-ALREADY' }] };
globalThis.document = { body: {}, querySelectorAll: (t) => els[t] ?? [] };

const { observeLazy } = await import('../../src/lazy-loader.js');

test('observeLazy creates one MutationObserver however often it is called', () => {
  observeLazy({ 'x-one': '/one.js' });
  observeLazy({ 'x-two': '/two.js' });
  observeLazy({ 'x-one': '/one.js' });
  assert.equal(mutationObservers, 1);
});

test('a tag already defined some other way is not observed', () => {
  observed.length = 0;
  observeLazy({ 'x-already': '/already.js' });
  assert.ok(!observed.some((el) => el.tagName === 'X-ALREADY'));
});
