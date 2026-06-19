/**
 * Regression test for #620: importing the `@webjsdev/core` BROWSER ENTRY
 * (`index-browser.js`, the surface the importmap points the bare specifier at,
 * and what `dist/webjs-core-browser.js` bundles) auto-enables the client
 * router. This is the contract that lets a layout DROP its explicit
 * `import '@webjsdev/core/client-router'`: any page that ships a component
 * loads core, and loading core enables client navigation. A refactor that
 * stops the browser entry from evaluating `router-client.js` (e.g. turning the
 * re-export type-only, or dropping the side-effect import) would silently
 * disable site-wide soft navigation; this test fails loudly if that happens.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const bound = new Set();

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.MutationObserver = window.MutationObserver || class { observe() {} disconnect() {} };
  globalThis.getComputedStyle = window.getComputedStyle || (() => ({}));
  // Record the document-level listeners the router binds on enable, BEFORE the
  // import runs its module-end auto-enable.
  const realAdd = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, ...rest) => { bound.add(type); return realAdd(type, ...rest); };
  await import('../../index-browser.js');
});

test('importing the core browser entry auto-enables the client router', () => {
  // enableClientRouter() binds these document-level handlers.
  assert.ok(bound.has('click'), 'click handler bound (router intercepts link navigation)');
  assert.ok(bound.has('submit'), 'submit handler bound (router intercepts form submission)');
});

test('disableClientRouter is exported so an app can opt out programmatically', async () => {
  const core = await import('../../index-browser.js');
  assert.equal(typeof core.disableClientRouter, 'function');
  assert.equal(typeof core.enableClientRouter, 'function');
});
