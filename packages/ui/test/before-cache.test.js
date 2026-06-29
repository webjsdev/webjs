/**
 * #766: transient overlays reset before the client router snapshots the page
 * for back/forward (the `webjs:before-cache` event), so a restored snapshot is
 * clean (e.g. a hover-card does not come back frozen open).
 *
 * This covers the shared `onBeforeCache` helper the overlays use: it runs the
 * reset on the event, the disposer removes the listener (no leak across soft
 * navigations), and it is a safe no-op with no document (SSR).
 */
import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let onBeforeCache;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.CustomEvent = window.CustomEvent;
  ({ onBeforeCache } = await import('../packages/registry/lib/utils.ts'));
});

afterEach(() => {
  // Restore document in case a test deleted it.
  if (!globalThis.document) {
    const { window } = parseHTML('<!doctype html><html><body></body></html>');
    globalThis.document = window.document;
    globalThis.CustomEvent = window.CustomEvent;
  }
});

test('onBeforeCache runs the reset on webjs:before-cache; disposer removes it (#766)', () => {
  let n = 0;
  const dispose = onBeforeCache(() => { n += 1; });

  document.dispatchEvent(new CustomEvent('webjs:before-cache'));
  assert.equal(n, 1, 'reset runs when the event fires');

  document.dispatchEvent(new CustomEvent('webjs:before-cache'));
  assert.equal(n, 2, 'runs again on a second cache');

  dispose();
  document.dispatchEvent(new CustomEvent('webjs:before-cache'));
  assert.equal(n, 2, 'the disposer removes the listener (no leak across soft navs)');
});

test('onBeforeCache is SSR-safe: a no-op disposer when there is no document (#766)', () => {
  const saved = globalThis.document;
  delete globalThis.document;
  let ran = false;
  const dispose = onBeforeCache(() => { ran = true; });
  assert.equal(typeof dispose, 'function', 'returns a disposer even with no document');
  assert.doesNotThrow(() => dispose());
  assert.equal(ran, false);
  globalThis.document = saved;
});
