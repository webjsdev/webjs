/**
 * `refreshPage()` against a dev render error (#1689). The dev server marks a
 * render that reported an error `x-webjs-dev-error: 1`, and the dev overlay is
 * already up describing it. The refresh must leave the page on screen exactly
 * as it was under the overlay (Next's posture) and report it resolved, so the
 * dev client does not reload into the error page. Applying the error page
 * instead shares no boundary with the live page, so it hard-navigates, and the
 * fixing edit's refresh would hard-navigate back.
 *
 * COUNTERFACTUAL: without the early return in `fetchAndApply`, the error page
 * below (no boundaries) degrades to a hard navigation and the DOM changes.
 *
 * The nav guard is installed per suite, as the core package's browser-test rule
 * requires.
 */
import {
  enableClientRouter, disableClientRouter, refreshPage,
  _setCurrentPageUrl,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 6; i++) await tick(); }

const KEY = '/refresh-dev-error-1689';
const live = `<!--wj:children:/:${KEY}--><span id="wj-deverr-inner">GOOD_PAGE</span><!--/wj:children:/-->`;
// The dev 500 page: a bare document with no children boundaries.
const errorPage = '<!doctype html><html><head></head><body><h1>500</h1><pre>render failed</pre></body></html>';

suite('Client router: a refresh answered by a dev render error keeps the page (#1689)', () => {
  let navGuard, container, origFetch, headers;

  function setup() {
    navGuard = installNavGuard();
    enableClientRouter();
    container = document.createElement('div');
    container.innerHTML = live;
    document.body.appendChild(container);
    _setCurrentPageUrl(location.href);
    headers = { 'content-type': 'text/html', 'x-webjs-dev-error': '1' };
    origFetch = window.fetch;
    window.fetch = () => Promise.resolve(new Response(errorPage, { status: 500, headers }));
  }

  function teardown() {
    window.fetch = origFetch;
    container.remove();
    _setCurrentPageUrl(null);
    navGuard.remove();
    disableClientRouter();
  }

  test('the refresh resolves true, applies nothing, and never navigates', async () => {
    setup();
    try {
      const inner = document.getElementById('wj-deverr-inner');
      const ok = await refreshPage();
      await settle();
      assert.equal(ok, true, 'reported resolved, so the dev client does not reload');
      assert.equal(navGuard.hardNavigations.length, 0, 'no hard navigation');
      assert.equal(document.getElementById('wj-deverr-inner'), inner, 'the same node is still on screen');
      assert.equal(inner.textContent, 'GOOD_PAGE', 'with the last good content');
    } finally {
      teardown();
    }
  });

  // The same response WITHOUT the header is the old behaviour: the error page
  // shares no boundary, so the refresh degrades and reports it did not apply.
  test('without the header the error page degrades to a hard navigation, as before', async () => {
    setup();
    try {
      delete headers['x-webjs-dev-error'];
      assert.equal(await refreshPage(), false);
      await settle();
      assert.equal(navGuard.hardNavigations.length, 1);
    } finally {
      teardown();
    }
  });
});
