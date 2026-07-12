/**
 * Real-browser regression for #936: the client router must not do a destructive
 * in-place full-body swap on a foreground nav that has no shared layout marker,
 * and must not speculatively cache an empty-`have` prefetch mid-parse.
 *
 * The device failure: a viewport prefetch (the touch default) fires while the
 * HTML is still streaming into the parser, before the body's closing
 * `<!--/wj:children-->` marker exists, so `buildHaveHeader()` returns "". The
 * server sends a full page, and applying it fell to the path-3 full-body swap
 * which stripped the head stylesheet and wiped the outer layout (navbar), then
 * cascaded to every later nav. Fixed by (1) skipping an empty-`have` prefetch
 * while the document is loading, and (2) falling back to a full-page load
 * instead of the destructive swap for a foreground nav.
 *
 * MUST run in a real browser: `location.assign` is not stubbable in any engine,
 * so the reload goes through the `_setHardNavigate` seam; and this asserts real
 * DOM state after `applySwap`, which linkedom does not model.
 */
import {
  enableClientRouter,
  _applySwap,
  _parseHTML,
  _setHardNavigate,
  _prefetch,
  _buildHaveHeader,
  _resetPrefetch,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

const REAL_HARD_NAVIGATE = (href) => { if (typeof location !== 'undefined') location.assign(href); };

suite('Client router: non-destructive fallback + empty-have prefetch gate (#936)', () => {
  test('a foreground nav with no shared layout marker does a full load, not a destructive swap', () => {
    enableClientRouter();
    const assigns = [];
    _setHardNavigate((href) => assigns.push(href));

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/destructive-fallback-test.css';
    document.head.appendChild(link);
    // Live DOM: outer-layout navbar + a children slot with markers.
    document.body.innerHTML =
      '<header class="site-top" id="df-navbar">NAV</header>' +
      '<!--wj:children:/--><main id="df-main">OLD</main><!--/wj:children-->';

    try {
      // Incoming document has NO wj:children markers, so `there` is empty and
      // longestSharedPath() is null: the old code would full-body-swap here.
      const doc = _parseHTML('<!doctype html><html><head></head><body><main>NEW</main></body></html>');
      _applySwap(doc, null, false, location.origin + '/no/shared/marker');

      assert.ok(assigns.some((u) => String(u).includes('/no/shared/marker')),
        'fell back to a full-page load to the target URL');
      // The destructive swap must NOT have run: stylesheet, navbar, and live
      // content all survive because applySwap returned before touching the DOM.
      assert.ok(document.head.querySelector('link[href="/destructive-fallback-test.css"]'),
        'head stylesheet was not stripped (no destructive mergeHead)');
      assert.ok(document.getElementById('df-navbar'), 'outer-layout navbar was not wiped');
      assert.ok(document.getElementById('df-main'), 'live children content was left in place');
    } finally {
      _setHardNavigate(REAL_HARD_NAVIGATE);
      link.remove();
      document.body.innerHTML = '';
    }
  });

  test('a revalidation / cache restore (href null) still applies in place, never a full load', () => {
    enableClientRouter();
    const assigns = [];
    _setHardNavigate((href) => assigns.push(href));
    document.body.innerHTML = '<!--wj:children:/--><main>OLD</main><!--/wj:children-->';

    try {
      // No shared marker AND href null (a revalidation). Must NOT reload: its doc
      // is a full same-shell snapshot, safe to apply, and a reload would defeat
      // the instant back/forward restore this path serves.
      const doc = _parseHTML('<!doctype html><html><head></head><body><main>RESTORED</main></body></html>');
      _applySwap(doc, null, /* revalidating */ true, /* href */ null);

      assert.equal(assigns.length, 0, 'a revalidation never triggers a full-page load');
      assert.ok(document.body.textContent.includes('RESTORED'), 'the snapshot was applied in place');
    } finally {
      _setHardNavigate(REAL_HARD_NAVIGATE);
      document.body.innerHTML = '';
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
      // Force readyState = 'loading' (an own property shadows the prototype getter).
      Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
      readyStateForced = true;

      _prefetch(location.origin + '/prefetch/mid-parse');
      assert.equal(fetches.length, 0, 'no speculative fetch fired for an empty-have prefetch during parse');

      // Once parsed, an empty-have prefetch is allowed (a page genuinely without
      // a layout slot is rare but valid, and applySwap now full-loads it safely).
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
