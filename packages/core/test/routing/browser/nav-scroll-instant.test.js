/**
 * Real-browser test for #601: the client router's nav scroll restoration must
 * be INSTANT, not animated, even when the app sets `html { scroll-behavior:
 * smooth }`.
 *
 * The router restores scroll programmatically AFTER swapping the DOM. With the
 * 2-arg `scrollTo(x, y)` form it used, a page-level `scroll-behavior: smooth`
 * animates that scroll, so the user watches the page slide on every nav. The
 * fix passes `behavior: 'instant'`, which the CSSOM spec guarantees overrides
 * `scroll-behavior`. This MUST run in a real browser: linkedom implements
 * neither `scroll-behavior` nor real scrolling, so only Chromium can prove the
 * override actually happens.
 */
import { enableClientRouter, navigate } from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('Client router: nav scroll is instant under scroll-behavior:smooth (#601)', () => {
  let origFetch, origScrollTo, calls;

  function setup() {
    enableClientRouter(); // idempotent; ensures the document listeners are attached
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.innerHTML = '<!--wj:children:/:/-->before<!--/wj:children:/-->';
    calls = [];
    origScrollTo = window.scrollTo;
    // Record every scroll the router issues (and skip the real scroll so the
    // assertion is about the call shape, not animation timing).
    window.scrollTo = (...args) => { calls.push(args); };
    origFetch = window.fetch;
    window.fetch = () => Promise.resolve(new Response(
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/:/-->after<!--/wj:children:/--></body></html>',
      { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
    ));
  }
  function teardown() {
    window.fetch = origFetch;
    window.scrollTo = origScrollTo;
    document.documentElement.style.scrollBehavior = '';
    document.body.innerHTML = '';
  }

  test('forward nav scroll-to-top uses the instant options form', async () => {
    setup();
    try {
      await navigate(location.origin + '/forward-nav-scroll-target');
      const optionCalls = calls.filter((c) => c.length === 1 && c[0] && typeof c[0] === 'object');
      assert.ok(optionCalls.length > 0,
        'router scrolled via the scrollTo(options) form, not the 2-arg (0, 0) form');
      assert.ok(optionCalls.every((c) => c[0].behavior === 'instant'),
        "every nav scroll uses behavior:'instant'");
    } finally { teardown(); }
  });

  test("behavior:'instant' actually overrides scroll-behavior:smooth in this browser", async () => {
    // The spec guarantee the fix relies on, proven live: an instant scroll
    // lands synchronously (no animation ramp) even while the document is in
    // smooth mode. This is the difference that made the old 2-arg form animate.
    document.documentElement.style.scrollBehavior = 'smooth';
    const filler = document.createElement('div');
    filler.style.height = '5000px';
    document.body.appendChild(filler);
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.scrollTo({ top: 1500, left: 0, behavior: 'instant' });
      assert.equal(Math.round(window.scrollY), 1500,
        'instant scroll lands synchronously despite scroll-behavior:smooth');
    } finally {
      filler.remove();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.style.scrollBehavior = '';
    }
  });
});
