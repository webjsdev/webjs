/**
 * Real-browser test for #610: the `data-navigating` loading-indicator hook is
 * OPT-IN. Toggling an attribute on <html> re-runs global style resolution, and
 * on WebKit that re-resolves oklch() / color-mix() tokens to an oklab
 * representation and repaints them for a frame (a visible nav flash on a
 * token-driven theme). So the router must NOT write `data-navigating` unless the
 * app opted in with `<html data-webjs-nav-progress>`.
 *
 * Chromium does not exhibit the WebKit repaint, so this proves the GATING
 * (attribute written only on opt-in), which is the mechanism that removes the
 * flash, not the paint itself.
 */
import { enableClientRouter, navigate } from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

suite('Client router: data-navigating is opt-in (#610)', () => {
  let origFetch, origScrollTo;

  // A nav slow enough (>150ms) to pass the deferred attribute set, so the
  // default case proves the attribute is withheld even when the timer fires.
  function setup(fetchDelayMs) {
    enableClientRouter();
    document.body.innerHTML = '<!--wj:children:/:/-->before<!--/wj:children:/-->';
    origScrollTo = window.scrollTo;
    window.scrollTo = () => {};
    origFetch = window.fetch;
    window.fetch = () => sleep(fetchDelayMs).then(() => new Response(
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/:/-->after<!--/wj:children:/--></body></html>',
      { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
    ));
  }
  function teardown() {
    window.fetch = origFetch;
    window.scrollTo = origScrollTo;
    document.documentElement.removeAttribute('data-webjs-nav-progress');
    document.documentElement.removeAttribute('data-navigating');
    document.body.innerHTML = '';
  }

  test('without the opt-in, data-navigating is never written (even on a slow nav)', async () => {
    setup(300);
    try {
      let seen = false;
      const nav = navigate(location.origin + '/no-optin-target');
      // Watch across the whole in-flight window, well past the 150ms defer.
      for (let i = 0; i < 10; i++) {
        if (document.documentElement.hasAttribute('data-navigating')) { seen = true; break; }
        await sleep(40);
      }
      await nav;
      assert.equal(seen, false, 'data-navigating must NOT be set without data-webjs-nav-progress');
      assert.equal(document.documentElement.hasAttribute('data-navigating'), false,
        'data-navigating must not remain after the nav');
    } finally { teardown(); }
  });

  test('with the opt-in, data-navigating is set during a slow nav and cleared after', async () => {
    setup(350);
    document.documentElement.setAttribute('data-webjs-nav-progress', '');
    try {
      let seenDuring = false;
      const nav = navigate(location.origin + '/optin-target');
      for (let i = 0; i < 12; i++) {
        if (document.documentElement.hasAttribute('data-navigating')) { seenDuring = true; break; }
        await sleep(40);
      }
      await nav;
      assert.ok(seenDuring, 'data-navigating SHOULD be set mid-nav when opted in');
      assert.equal(document.documentElement.hasAttribute('data-navigating'), false,
        'data-navigating must be cleared after the nav settles');
    } finally { teardown(); }
  });
});
