/**
 * Real-browser regression for #994 (a #936 residual): a client-router soft nav
 * must keep the outer-layout navbar even when the incoming response's closing
 * `<!--/wj:children-->` marker was lost.
 *
 * The failure: a soft nav to `/blog` randomly dropped the persistent top navbar.
 * The full-body swap only happens when `collectChildrenSlots` cannot pair a slot,
 * and it needed BOTH comments to register one, so a missing close meant no shared
 * path and the full-body `replaceChildren` wiped the outer layout (navbar and
 * all).
 *
 * HISTORICAL NOTE (#1007), because this file previously asserted otherwise: the
 * missing comment was read as the browser's parser "dropping" it under CPU
 * pressure, a parse/timing race inferred from Android Chrome reports (#939/#940
 * saw the OPEN marker survive, `markers:1`, yet still got the destructive swap).
 * That premise did not survive investigation. The real cause was deterministic
 * and ours: `parseHTML` fed every doctype'd response through
 * `Document.parseHTMLUnsafe`, which STRIPS every comment in Chromium 150, so the
 * markers were deleted on the JS-side parse rather than lost mid-parse by the
 * browser. The sweep reproduces on a fully settled desktop page whose live
 * markers are present and correctly paired, which no timing race explains.
 * `parseHTML` now probes for that and routes around it, so the recovery this file
 * covers is DEFENCE IN DEPTH against a genuinely malformed response, not the
 * load-bearing fix it was believed to be.
 *
 * The fix (#994) recovers an orphaned open marker (end=null, "children run to the
 * parent end"), so the correct scoped swap runs and the navbar (which sits BEFORE
 * the open marker) is never in the swap range. This test drives a soft swap whose
 * incoming fragment has NO close marker and asserts the navbar node RETAINS
 * IDENTITY while the children slot swaps.
 *
 * MUST run in a real browser: it asserts DOM node identity after a real parse +
 * swap, which linkedom does not model. Revert the recoverOrphans wiring in
 * `applySwap` and this fails (the counterfactual: the navbar node is replaced).
 */
import {
  enableClientRouter,
  _applySwap,
  _parseHTML,
  _collectChildrenSlots,
  _buildHaveHeader,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('Client router: soft nav keeps the navbar when the close marker is dropped (#994)', () => {
  test('a dropped incoming close marker takes the scoped swap and preserves the navbar node', () => {
    enableClientRouter();

    // Live page: outer layout with a persistent navbar BEFORE the children
    // marker, then the children region (properly closed on the live side).
    document.body.innerHTML =
      '<nav id="site-top">navbar</nav>' +
      '<!--wj:children:/:/-->' +
      '<main id="old">old page</main>' +
      '<!--/wj:children:/-->';
    const liveNav = document.getElementById('site-top');

    try {
      // The incoming partial-nav fragment lost its trailing `<!--/wj:children-->`
      // (a malformed response). Parsed in body context it is an orphaned open
      // marker, exactly the state that used to force the full-body fallback.
      const doc = _parseHTML(
        '<!--wj:children:/:/-->' +
        '<main id="new">new page</main>'
      );

      // Sanity: the incoming fragment has an unpaired open marker.
      assert.equal(_collectChildrenSlots(doc.body).size, 0,
        'strict pairing finds no slot for the orphaned open (the bug precondition)');
      const recovered = _collectChildrenSlots(doc.body, { recoverOrphans: true });
      assert.ok(recovered.has('/'), 'recovery registers the orphaned open marker');
      assert.equal(recovered.get('/').end, null, 'the recovered slot ends at the parent boundary');

      _applySwap(doc, null, false, location.origin + '/blog');

      assert.equal(document.getElementById('site-top'), liveNav,
        'the navbar node retains identity across the soft nav (not wiped by a full-body swap)');
      assert.equal(document.getElementById('site-top').textContent, 'navbar',
        'the preserved navbar is intact');
      assert.ok(document.getElementById('new'), 'the children slot swapped to the new page');
      assert.ok(!document.getElementById('old'), 'the old children content was replaced');
    } finally {
      document.body.innerHTML = '';
    }
  });

  test('a well-formed soft nav is unaffected (both markers present, scoped swap, navbar kept)', () => {
    enableClientRouter();
    document.body.innerHTML =
      '<nav id="site-top-2">navbar</nav>' +
      '<!--wj:children:/:/-->' +
      '<main id="old2">old</main>' +
      '<!--/wj:children:/-->';
    const liveNav = document.getElementById('site-top-2');

    try {
      const doc = _parseHTML(
        '<!--wj:children:/:/-->' +
        '<main id="new2">new</main>' +
        '<!--/wj:children:/-->'
      );
      _applySwap(doc, null, false, location.origin + '/blog');

      assert.equal(document.getElementById('site-top-2'), liveNav, 'navbar identity preserved');
      assert.ok(document.getElementById('new2'), 'children swapped');
      assert.ok(!document.getElementById('old2'), 'old children replaced');
    } finally {
      document.body.innerHTML = '';
    }
  });

  test('buildHaveHeader reports STRICT pairs, so an orphaned page fetches a full page (not a reduced fragment)', () => {
    // #994: `have` must NOT recover the orphan. A dropped live close means the
    // layout is omitted from `have`, so the server returns the FULL page (with
    // trailing chrome) and the swap bounds against it. Recovering here would send
    // `have=/` and get back a reduced marker-pair-only fragment (no footer), which
    // would sweep an unwrapped layout's footer.
    enableClientRouter();
    document.body.innerHTML =
      '<nav>navbar</nav>' +
      '<!--wj:children:/:/-->' +
      '<main>orphaned</main>' +
      '<footer>footer</footer>'; // close comment dropped: the open is orphaned
    try {
      assert.equal(_buildHaveHeader(), '',
        'an orphaned page reports an empty have, so the server sends a full page');
    } finally {
      document.body.innerHTML = '';
    }

    document.body.innerHTML =
      '<!--wj:children:/:/-->' +
      '<main>ok</main>' +
      '<!--/wj:children:/-->';
    try {
      assert.equal(_buildHaveHeader(), '/', 'a well-formed page reports its layout normally');
    } finally {
      document.body.innerHTML = '';
    }
  });

  test('trailing outer-layout content in the marker parent is preserved when the live close is dropped', () => {
    // An UNWRAPPED layout: nav, open, children, [close dropped], footer, all
    // direct body children. The recovered live range must NOT sweep the footer
    // (it is bounded by the well-formed incoming side's trailing-sibling count).
    enableClientRouter();
    document.body.innerHTML =
      '<nav id="nav-f">navbar</nav>' +
      '<!--wj:children:/:/-->' +
      '<main id="oldf">old</main>' +
      '<footer id="foot-f">footer</footer>';
    const liveNav = document.getElementById('nav-f');
    const liveFooter = document.getElementById('foot-f');

    try {
      // Well-formed incoming full page: nav, open, children, close, footer.
      const doc = _parseHTML(
        '<!doctype html><html><head></head><body>' +
        '<nav id="nav-f">navbar</nav>' +
        '<!--wj:children:/:/-->' +
        '<main id="newf">new</main>' +
        '<!--/wj:children:/-->' +
        '<footer id="foot-f">footer</footer>' +
        '</body></html>'
      );
      _applySwap(doc, null, false, location.origin + '/blog');

      assert.equal(document.getElementById('nav-f'), liveNav, 'navbar identity preserved');
      assert.equal(document.getElementById('foot-f'), liveFooter,
        'the trailing footer was NOT swept by the recovered range (identity preserved)');
      assert.equal(document.querySelectorAll('#foot-f').length, 1, 'exactly one footer (no duplication)');
      assert.ok(document.getElementById('newf'), 'children swapped');
      assert.ok(!document.getElementById('oldf'), 'old children replaced');
    } finally {
      document.body.innerHTML = '';
    }
  });
});
