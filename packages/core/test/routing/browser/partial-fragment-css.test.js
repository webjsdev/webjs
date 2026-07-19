/**
 * Real-browser regression for #936: a same-layout client-router nav must keep
 * the head stylesheets and the outer layout, not wipe them.
 *
 * The server's X-Webjs-Have partial response for a same-layout nav is an INNER
 * fragment that BEGINS with the `<!--wj:children:/:/-->` marker and carries no
 * `<!doctype>`/`<html>` (see packages/server/src/ssr.js `wrapWithChildrenMarker`
 * + the `have.has(segmentPath)` short-circuit). Parsing that fragment as a
 * DOCUMENT hoists the leading comment OUT of `<body>` (the HTML "before html"
 * insertion mode), so `collectChildrenSlots(doc.body)` finds no slot and the
 * router falls to the destructive full-body swap: `mergeHead` strips the
 * stylesheet the fragment head lacks and the outer layout (navbar) is wiped.
 * On a real Android phone this showed as unstyled pages after every nav that a
 * refresh fixed (css:GONE, nav:GONE, markers o0/c0).
 *
 * MUST run in a real browser: linkedom (the unit DOM) does not reproduce the
 * "before html" comment-hoisting parse, so the bug is invisible there. The
 * router's fetch is stubbed to return the exact marker-first fragment the
 * server sends. The counterfactual is direct: revert the `parseHTML` fragment
 * branch and both the direct-parse assertion and the full-nav assertion fail.
 */
import {
  enableClientRouter,
  navigate,
  _parseHTML,
  _collectChildrenSlots,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

const tick = () => new Promise((r) => setTimeout(r, 25));

/** The inner fragment a same-layout partial nav returns: marker-first, no
 *  <!doctype>/<html>/<head>, no outer layout. Exactly what the server sends. */
const FRAGMENT = '<!--wj:children:/:/--><main id="inner">AFTER</main><!--/wj:children:/-->';

suite('Client router: same-layout nav keeps head CSS + outer layout (#936)', () => {
  test('parseHTML keeps the leading wj:children marker inside <body> for a bare fragment', () => {
    const doc = _parseHTML(FRAGMENT);
    const slots = _collectChildrenSlots(doc.body);
    // The open marker must be IN body (a document-context parse hoists it out,
    // leaving slots empty), so the slot map has the '/' path.
    assert.ok(slots.has('/'), 'the "/" children slot is found in the parsed fragment body');
    assert.ok(doc.querySelector('#inner'), 'the inner content parsed into the body');
    // A full document still parses as before (regression guard).
    const full = _parseHTML('<!doctype html><html><head><link rel="stylesheet" href="/x.css"></head><body><!--wj:children:/:/-->x<!--/wj:children:/--></body></html>');
    assert.ok(_collectChildrenSlots(full.body).has('/'), 'a full document body still yields the slot');
    assert.ok(full.querySelector('link[rel="stylesheet"]'), 'a full document keeps its head stylesheet');
  });

  test('a same-layout nav preserves the head stylesheet and the outer-layout navbar', async () => {
    enableClientRouter(); // idempotent

    // Head: a stylesheet the nav must NOT strip.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/partial-fragment-css-test.css';
    document.head.appendChild(link);
    const hasSheet = () => !!document.head.querySelector('link[href="/partial-fragment-css-test.css"]');

    // Body: an outer-layout element (navbar) OUTSIDE the children markers, plus
    // the children slot the nav should swap. Mirrors the SSR layout structure.
    document.body.innerHTML =
      '<header class="site-top" id="navbar">NAV</header>' +
      '<!--wj:children:/:/--><main id="inner">BEFORE</main><!--/wj:children:/-->';

    const before = location.href;
    const origFetch = window.fetch;
    window.fetch = (url, init) => {
      // The server's same-layout partial: the marker-first inner fragment.
      return Promise.resolve(new Response(FRAGMENT, {
        headers: { 'content-type': 'text/html', 'x-webjs-build': '' },
      }));
    };

    try {
      assert.ok(hasSheet(), 'stylesheet present before nav (sanity)');
      await navigate(location.origin + '/some/same-layout/page');
      // Give the swap a beat to settle.
      await tick();

      // The whole point: a soft nav must not strip the stylesheet...
      assert.ok(hasSheet(), 'head stylesheet survived the soft nav (not stripped by a full-body swap)');
      // ...nor wipe the outer layout...
      assert.ok(document.getElementById('navbar'), 'outer-layout navbar survived the soft nav');
      // ...while the children slot DID swap to the new content.
      const inner = document.getElementById('inner');
      assert.ok(inner && inner.textContent === 'AFTER', 'the children slot swapped to the new content');
      // And the layout markers are still in the body (a scoped swap keeps them).
      assert.ok(_collectChildrenSlots(document.body).has('/'), 'the layout markers are intact after the swap');
    } finally {
      window.fetch = origFetch;
      try { history.replaceState(null, '', before); } catch { /* ignore */ }
      link.remove();
      document.body.innerHTML = '';
    }
  });
});
