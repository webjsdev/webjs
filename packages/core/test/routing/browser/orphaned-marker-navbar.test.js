/**
 * Real-browser coverage for the #1015 integrity gate at the parse boundary.
 *
 * HISTORY: this file used to cover the #994 orphan RECOVERY (an incoming
 * response missing its `<!--/wj:children-->` close was "recovered" by guessing
 * that the children run to the parent end, bounded by the well-formed side's
 * trailing-sibling count). #1015 deleted that machinery: boundaries are now
 * KEYED (open `wj:children:<segment>:<route-key>`, close
 * `/wj:children:<segment>`), pairing is strict id-matching, and ANY truncated,
 * mispaired, or duplicated boundary poisons the scan, degrading the nav to a
 * full page load instead of a guessed swap. The degradation itself (a
 * `location.href` assignment) is asserted in the linkedom unit suite, where
 * location is mockable; a real browser would actually navigate away. What
 * NEEDS the real browser is everything at the parse boundary:
 *
 *  - comments survive the REAL `parseHTML` path (#1007 stripped them all in
 *    Chromium 150; the probe routes around it), so the strict scanner sees
 *    the truncated shape and poisons rather than reading an empty tree
 *  - a WELL-FORMED soft nav still runs the scoped swap with DOM node
 *    identity preserved for the outer chrome (the navbar), which linkedom
 *    does not model faithfully
 *  - `buildHaveHeader` on a poisoned live page reports EMPTY, so the server
 *    sends a full page (never a reduced fragment spliced against a tree we
 *    cannot trust)
 */
import {
  enableClientRouter,
  _applySwap,
  _parseHTML,
  _collectBoundaries,
  _buildHaveHeader,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('Client router: strict boundary integrity after a real parse (#1015)', () => {
  test('a truncated incoming fragment POISONS the scan after a real parse (no guessed pairing)', () => {
    enableClientRouter();
    // The incoming partial-nav fragment lost its trailing close (a malformed
    // response). Parsed in body context, the open comment must SURVIVE the
    // parse (the #1007 regression would strip it and yield a deceptively
    // "valid" empty scan of a tree that actually has content).
    const doc = _parseHTML(
      '<!--wj:children:/:/-->' +
      '<main id="new">new page</main>'
    );
    assert.equal(_collectBoundaries(doc.body), null,
      'the truncated boundary poisons the scan (the degradation trigger)');
  });

  test('a MISPAIRED close (outer close facing an inner open) POISONS the scan after a real parse', () => {
    // The exact silent-corruption shape the old LIFO pairing swallowed: the
    // inner close was dropped, so the outer close faces the inner open.
    const doc = _parseHTML(
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/:/-->' +
        '<!--wj:children:/docs:/docs--><h1>page</h1>' +
      '<!--/wj:children:/-->' +
      '</body></html>'
    );
    assert.equal(_collectBoundaries(doc.body), null,
      'the keyed close detects the mispair the LIFO pairing used to guess through');
  });

  test('a well-formed soft nav runs the scoped swap and preserves navbar node identity', () => {
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

  test('buildHaveHeader reports EMPTY for a poisoned live page (full page requested, never a fragment)', () => {
    enableClientRouter();
    document.body.innerHTML =
      '<nav>navbar</nav>' +
      '<!--wj:children:/:/-->' +
      '<main>orphaned</main>' +
      '<footer>footer</footer>'; // close comment dropped: poisoned
    try {
      assert.equal(_buildHaveHeader(), '',
        'a poisoned page reports an empty have, so the server sends a full page');
    } finally {
      document.body.innerHTML = '';
    }

    document.body.innerHTML =
      '<!--wj:children:/:/-->' +
      '<main>ok</main>' +
      '<!--/wj:children:/-->';
    try {
      assert.equal(_buildHaveHeader(), '/', 'a well-formed page reports its segments normally');
    } finally {
      document.body.innerHTML = '';
    }
  });
});
