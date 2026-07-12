/**
 * Real-browser tests for the viewport-prefetch over-fetch gate (#530).
 *
 * The default link prefetch is device-adaptive: `viewport` on touch. To keep
 * that from flooding the network tab on a long, fast-scrolled list, a viewport
 * link must DWELL on-screen before it warms, and the pending warm is cancelled
 * the moment the link scrolls back out. This is the same gate Astro / Next /
 * Nuxt / Remix / TanStack / Turbo all ship.
 *
 * These run in a real browser because the gate lives on an IntersectionObserver
 * + a dwell timer, neither of which linkedom drives. We stub IntersectionObserver
 * so the test drives intersection in/out explicitly (the deterministic pattern
 * the lazy-frame test uses), recreate the router observer so it picks up the
 * stub, and let the real dwell-timer logic run on the wall clock.
 */
import { enableClientRouter, disableClientRouter } from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';
const tick = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle() { for (let i = 0; i < 4; i++) await tick(); }

// Comfortably past the 250ms viewport dwell, so a warm that was going to fire
// has fired by the time we assert.
const PAST_DWELL = 360;

suite('Client router: viewport prefetch over-fetch gate (#530)', () => {
  let container, origFetch, origIO, calls, ioInstances;

  /** Drive the router observer with a controllable IntersectionObserver. */
  function setup() {
    origIO = window.IntersectionObserver;
    ioInstances = [];
    window.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; this.observed = new Set(); ioInstances.push(this); }
      observe(el) { this.observed.add(el); }
      unobserve(el) { this.observed.delete(el); }
      disconnect() { this.observed.clear(); }
      /** Test helper: deliver an intersection entry to the router callback. */
      emit(el, isIntersecting) { this.cb([{ target: el, isIntersecting }], this); }
    };
    // Drop any real observer the router already created, then re-enable so the
    // prefetch observer is rebuilt from the stub above.
    disableClientRouter();
    enableClientRouter();

    container = document.createElement('div');
    document.body.appendChild(container);
    origFetch = window.fetch;
    calls = [];
    window.fetch = (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve(new Response(
        '<!doctype html><body><p>ok</p></body>',
        { status: 200, headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
      ));
    };
  }

  function teardown() {
    window.fetch = origFetch;
    window.IntersectionObserver = origIO;
    container.remove();
    disableClientRouter();
    enableClientRouter();
  }

  /** The router prefetch observer (the only IO instance built on enable). */
  function viewObserver() { return ioInstances[ioInstances.length - 1]; }

  /** Add a viewport-mode anchor and make the router observe it. */
  function addViewportAnchor(href) {
    const a = document.createElement('a');
    a.setAttribute('href', href);
    a.setAttribute('data-prefetch', 'viewport');
    container.appendChild(a);
    // A re-scan (what a soft nav fires) makes refreshPrefetchObservers observe
    // the new anchor through the stub.
    document.dispatchEvent(new Event('webjs:navigate'));
    return a;
  }

  test('a viewport link warms only AFTER it dwells on-screen', async () => {
    setup();
    try {
      const a = addViewportAnchor('/dwell-target');
      await settle();
      const obs = viewObserver();
      assert.ok(obs.observed.has(a), 'the viewport anchor is observed');

      obs.emit(a, true); // enters the viewport: arm the dwell timer
      await sleep(60);
      // The whole point of the gate: nothing is fetched during the dwell.
      assert.equal(calls.length, 0, 'no request while the link is still dwelling');

      await sleep(PAST_DWELL);
      assert.equal(calls.length, 1, 'the link warms once the dwell elapses');
      assert.ok(calls[0].url.includes('/dwell-target'), 'it warmed the right URL');
      assert.equal(calls[0].init.headers['x-webjs-prefetch'], '1', 'tagged as a prefetch');
    } finally { teardown(); }
  });

  test('a fast scroll-through never spends a request (cancel on exit)', async () => {
    setup();
    try {
      const a = addViewportAnchor('/flick-target');
      await settle();
      const obs = viewObserver();

      obs.emit(a, true);   // scrolls in: arm the dwell timer
      await sleep(40);      // ...but well under the 250ms dwell
      obs.emit(a, false);  // scrolls back out before it fires: cancel

      await sleep(PAST_DWELL);
      assert.equal(calls.length, 0, 'a link flicked past the viewport is never fetched');
    } finally { teardown(); }
  });

  test('a soft-nav re-scan cancels a pending dwell timer for a removed link', async () => {
    setup();
    try {
      const a = addViewportAnchor('/rescan-target');
      await settle();
      const obs = viewObserver();

      obs.emit(a, true);  // arm the dwell timer
      await sleep(40);     // still within the 250ms dwell
      // The soft-nav swap removes the link, then the router re-scans. The
      // removed anchor will never get an exit callback, so the re-scan itself
      // must cancel its pending timer (otherwise it warms a stale URL).
      a.remove();
      document.dispatchEvent(new Event('webjs:navigate'));

      await sleep(PAST_DWELL);
      assert.equal(calls.length, 0, 'a pending timer for a removed link is cancelled on re-scan, not fired');
    } finally { teardown(); }
  });

  test('re-entering after a cancel can still warm (the anchor is not poisoned)', async () => {
    setup();
    try {
      const a = addViewportAnchor('/re-enter-target');
      await settle();
      const obs = viewObserver();

      obs.emit(a, true);
      await sleep(40);
      obs.emit(a, false); // cancel
      await sleep(40);

      obs.emit(a, true);  // user scrolls back and settles this time
      await sleep(PAST_DWELL);
      assert.equal(calls.length, 1, 'a settled re-entry warms exactly once');
      assert.ok(calls[0].url.includes('/re-enter-target'));
    } finally { teardown(); }
  });
});
