/**
 * Regression test for #629: when the app opts out with `webjs.clientRouter:
 * false`, the server emits `window.__WEBJS_CLIENT_ROUTER__ = false` BEFORE the
 * core bundle runs, and the bundle's module-end auto-enable must then SKIP
 * (no document listeners bound). The complement of auto-enable.test.js, which
 * proves the default (no flag) DOES auto-enable, so together they are the
 * counterfactual pair.
 *
 * Runs in its own file so node's per-file process isolation gives a fresh
 * module registry: the flag is set before `index-browser.js` is first
 * evaluated, so the module-end gate observes it.
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
  // Opt out BEFORE the bundle's module-end auto-enable runs (the server emits
  // this inline flag ahead of the deferred boot module).
  window.__WEBJS_CLIENT_ROUTER__ = false;
  const realAdd = window.document.addEventListener.bind(window.document);
  window.document.addEventListener = (type, ...rest) => { bound.add(type); return realAdd(type, ...rest); };
  await import('../../index-browser.js');
});

test('webjs.clientRouter:false flag suppresses the auto-enable', () => {
  assert.ok(!bound.has('click'), 'click handler must NOT be bound when opted out');
  assert.ok(!bound.has('submit'), 'submit handler must NOT be bound when opted out');
});

test('disableClientRouter / enableClientRouter stay exported as the programmatic escape hatch', async () => {
  const core = await import('../../index-browser.js');
  assert.equal(typeof core.disableClientRouter, 'function');
  assert.equal(typeof core.enableClientRouter, 'function');
});
