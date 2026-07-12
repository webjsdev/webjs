/**
 * Real-browser regression for #936: a client-router soft nav must never leave
 * the page unstyled, and a mid-parse prefetch must not send an empty `have`.
 *
 * The device failure: a viewport prefetch (the touch default) fires while the
 * HTML is still streaming into the parser, before the body's closing
 * `<!--/wj:children-->` marker exists, so `buildHaveHeader()` returns "". The
 * server sends a full page whose head-merge on apply stripped the live
 * stylesheet, leaving the page unstyled until a manual refresh. Fixed by
 * (1) skipping an empty-`have` prefetch while the document is loading, and
 * (2) never removing a stylesheet / `<style>` during a head merge (Turbo's
 * persistent-CSS model), so no swap path can lose the CSS.
 *
 * MUST run in a real browser: this asserts real DOM state after the head merge
 * + swap, which linkedom does not model.
 */
import {
  enableClientRouter,
  _applySwap,
  _parseHTML,
  _mergeHead,
  _prefetch,
  _buildHaveHeader,
  _resetPrefetch,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('Client router: soft nav keeps CSS + empty-have prefetch gate (#936)', () => {
  test('a full-body-swap fallback whose incoming head lacks the stylesheet keeps the live CSS', () => {
    enableClientRouter();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/destructive-fallback-test.css';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.id = 'df-inline-style';
    style.textContent = ':root{--df:1}';
    document.head.appendChild(style);

    // Live DOM has a layout; incoming document has a DIFFERENT layout marker
    // (so no shared path -> the full-body-swap fallback runs) AND an empty head
    // that lacks the stylesheet, exactly the shape that used to strip the CSS.
    document.body.innerHTML = '<!--wj:children:/docs-->old<!--/wj:children-->';

    try {
      const doc = _parseHTML('<!doctype html><html><head></head><body><!--wj:children:/admin--><main>new</main><!--/wj:children--></body></html>');
      _applySwap(doc, null, false, location.origin + '/admin/y');

      // The swap ran (cross-layout), but the head merge preserved the CSS.
      assert.ok(document.head.querySelector('link[href="/destructive-fallback-test.css"]'),
        'the live stylesheet link was NOT stripped by the head merge');
      assert.ok(document.getElementById('df-inline-style'),
        'the live <style> was NOT stripped by the head merge');
      assert.ok(document.body.textContent.includes('new'), 'the body swap did apply');
    } finally {
      link.remove();
      const s = document.getElementById('df-inline-style');
      if (s) s.remove();
      document.body.innerHTML = '';
    }
  });

  test('mergeHead removes a genuinely stale non-style head element but keeps stylesheets', () => {
    enableClientRouter();
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = '/df-keep.css';
    document.head.appendChild(sheet);
    const staleMeta = document.createElement('meta');
    staleMeta.name = 'df-stale';
    staleMeta.content = 'x';
    document.head.appendChild(staleMeta);

    try {
      // Incoming head has neither the stylesheet nor the meta.
      const doc = _parseHTML('<!doctype html><html><head><meta name="df-fresh" content="y"></head><body></body></html>');
      _mergeHead(doc.head);

      assert.ok(document.head.querySelector('link[href="/df-keep.css"]'), 'stylesheet preserved');
      assert.ok(!document.head.querySelector('meta[name="df-stale"]'), 'a stale non-style head element is still removed');
      assert.ok(document.head.querySelector('meta[name="df-fresh"]'), 'a new head element from the incoming doc is added');
    } finally {
      const s = document.head.querySelector('link[href="/df-keep.css"]'); if (s) s.remove();
      const m1 = document.head.querySelector('meta[name="df-stale"]'); if (m1) m1.remove();
      const m2 = document.head.querySelector('meta[name="df-fresh"]'); if (m2) m2.remove();
    }
  });

  test('a stylesheet tagged data-webjs-track="dynamic" IS removed when absent from the new head (Turbo parity)', () => {
    enableClientRouter();
    const dyn = document.createElement('link');
    dyn.rel = 'stylesheet';
    dyn.href = '/df-dynamic.css';
    dyn.setAttribute('data-webjs-track', 'dynamic');
    document.head.appendChild(dyn);

    try {
      const doc = _parseHTML('<!doctype html><html><head></head><body></body></html>');
      _mergeHead(doc.head);
      // Mirrors Turbo's data-turbo-track="dynamic": an opted-in stylesheet not in
      // the new head IS removed (the explicit escape hatch from the default).
      assert.ok(!document.head.querySelector('link[href="/df-dynamic.css"]'),
        'a data-webjs-track="dynamic" stylesheet absent from the new head is removed');
    } finally {
      const s = document.head.querySelector('link[href="/df-dynamic.css"]'); if (s) s.remove();
    }
  });

  test('an empty-have prefetch is skipped while the document is still parsing', () => {
    enableClientRouter();
    _resetPrefetch();
    // Live body has NO layout markers, so buildHaveHeader() is empty (this is
    // exactly the mid-parse state on the device: close marker not parsed yet).
    document.body.innerHTML = '<main>no markers yet</main>';
    assert.equal(_buildHaveHeader(), '', 'sanity: no markers means an empty have header');

    const fetches = [];
    const origFetch = window.fetch;
    window.fetch = (u) => { fetches.push(String(u)); return Promise.resolve(new Response('', { headers: { 'content-type': 'text/html' } })); };

    let readyStateForced = false;
    try {
      Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
      readyStateForced = true;

      _prefetch(location.origin + '/prefetch/mid-parse');
      assert.equal(fetches.length, 0, 'no speculative fetch fired for an empty-have prefetch during parse');

      Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
      _resetPrefetch();
      _prefetch(location.origin + '/prefetch/after-parse');
      assert.ok(fetches.some((u) => u.includes('/prefetch/after-parse')),
        'once the document is parsed, the prefetch is no longer suppressed');
    } finally {
      window.fetch = origFetch;
      if (readyStateForced) { try { delete document.readyState; } catch { /* ignore */ } }
      document.body.innerHTML = '';
      _resetPrefetch();
    }
  });
});
