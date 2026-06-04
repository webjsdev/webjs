/**
 * Real-browser tests for `<webjs-frame src loading>` self-loading (#253).
 *
 * A frame carrying a `src` self-fetches that URL as a frame nav and applies
 * the matching `<webjs-frame id>` subtree into itself through the SAME router
 * frame-swap path a click-driven frame nav uses. `loading="eager"` (or absent)
 * fetches on connect; `loading="lazy"` fetches on viewport entry. Three triggers
 * (eager connect, the lazy observer, a `src` mutation) must never double-fetch
 * the same URL.
 *
 * These MUST run in a real browser: the headline behaviour (a request issued
 * carrying `x-webjs-frame`, the frame content swapped, the #252 aria-busy
 * lifecycle, the lazy IntersectionObserver gate) is browser-observable and the
 * frame-swap path (parse + querySelector + diffChildren) does not run in
 * linkedom. We import the element + router for their side effects, stub
 * `window.fetch` to capture the request and serve the frame response, and let
 * the real `connectedCallback` / observer / `loadFrame` / `fetchAndApply` /
 * `applySwap` run exactly as in production.
 */
import { enableClientRouter } from '../../../src/router-client.js';
import '../../../src/webjs-frame.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 6; i++) await tick(); }
/** Poll until `cond()` is truthy (or a generous timeout), for a step gated on
 *  an async dynamic import whose timing varies under full-suite concurrency. */
async function waitUntil(cond) { for (let i = 0; i < 100 && !cond(); i++) await tick(); }

/** A frame-bearing HTML response carrying the matched frame subtree. */
const frameResponse = (id, inner) => Promise.resolve(new Response(
  '<!doctype html><html><head></head><body>' +
  `<webjs-frame id="${id}">${inner}</webjs-frame>` +
  '</body></html>',
  { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
));

suite('Client router: <webjs-frame src loading> self-load (#253)', () => {
  let container, origFetch, calls;

  function setup() {
    enableClientRouter(); // idempotent
    container = document.createElement('div');
    document.body.appendChild(container);
    origFetch = window.fetch;
    calls = [];
    window.fetch = (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      // Serve whatever frame the request asked for, with fresh content.
      const id = (init && init.headers && init.headers['x-webjs-frame']) || 'self';
      return frameResponse(id, '<span class="loaded">LOADED</span>');
    };
  }
  function teardown() {
    window.fetch = origFetch;
    container.remove();
  }

  test('an eager src frame fetches on connect with the x-webjs-frame header and swaps in the content', async () => {
    setup();
    try {
      container.innerHTML =
        '<webjs-frame id="self" src="/frames/widget" loading="eager">' +
          '<span class="placeholder">PLACEHOLDER</span>' +
        '</webjs-frame>';
      await settle();

      assert.equal(calls.length, 1, 'exactly one fetch fired on connect');
      assert.ok(calls[0].url.includes('/frames/widget'), 'the fetch requested the src URL');
      assert.equal(calls[0].init.headers['x-webjs-frame'], 'self',
        'the request carried x-webjs-frame: <id>, the frame-nav header');

      const frame = container.querySelector('webjs-frame#self');
      assert.ok(frame.querySelector('.loaded'), 'the loaded content swapped into the frame');
      assert.ok(!frame.querySelector('.placeholder'),
        'the server-rendered placeholder children were replaced by the self-load');
    } finally { teardown(); }
  });

  test('loading defaults to eager when the attribute is absent', async () => {
    setup();
    try {
      container.innerHTML = '<webjs-frame id="self" src="/frames/default"></webjs-frame>';
      await settle();
      assert.equal(calls.length, 1, 'an absent loading attribute fetches eagerly on connect');
      assert.ok(calls[0].url.includes('/frames/default'));
    } finally { teardown(); }
  });

  test('a frame with NO src never self-fetches', async () => {
    setup();
    try {
      container.innerHTML = '<webjs-frame id="self"><span>STATIC</span></webjs-frame>';
      await settle();
      assert.equal(calls.length, 0, 'a swap-anchor frame without src issues no request');
    } finally { teardown(); }
  });

  test('aria-busy toggles around the self-load (reuses the #252 busy lifecycle)', async () => {
    setup();
    try {
      // Hold the response open so we can observe the busy state mid-flight.
      let release;
      const gate = new Promise((r) => { release = r; });
      window.fetch = (url, init) => {
        calls.push({ url: String(url), init: init || {} });
        return gate.then(() => new Response(
          '<webjs-frame id="self"><span class="loaded">LOADED</span></webjs-frame>',
          { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
        ));
      };

      const busyEvents = [];
      document.addEventListener('webjs:frame-busy', (e) => busyEvents.push(e.detail.busy));

      container.innerHTML = '<webjs-frame id="self" src="/frames/slow"></webjs-frame>';
      await settle();
      const frame = container.querySelector('webjs-frame#self');
      assert.equal(frame.getAttribute('aria-busy'), 'true',
        'aria-busy is "true" while the self-load fetch is in flight');

      release();
      await settle();
      assert.equal(frame.getAttribute('aria-busy'), 'false',
        'aria-busy clears to "false" once the self-load settles');
      assert.ok(busyEvents.includes(true) && busyEvents.includes(false),
        'webjs:frame-busy fired at both the start and finish edges');
    } finally { teardown(); }
  });

  test('a lazy frame does NOT fetch until it enters the viewport, then self-loads', async () => {
    setup();
    // Stub IntersectionObserver so the test drives the intersection explicitly.
    const origIO = window.IntersectionObserver;
    let ioCallback = null;
    let observed = null;
    window.IntersectionObserver = class {
      constructor(cb) { ioCallback = cb; }
      observe(el) { observed = el; }
      unobserve() {}
      disconnect() {}
    };
    try {
      container.innerHTML =
        '<webjs-frame id="self" src="/frames/lazy" loading="lazy">' +
          '<span class="placeholder">PLACEHOLDER</span>' +
        '</webjs-frame>';
      // The lazy observe registers via a dynamic import('./lazy-loader.js'), so
      // wait until the frame is actually observed rather than a fixed tick count
      // (the import can resolve slower than `settle()` under full-suite load).
      await waitUntil(() => observed != null);

      assert.equal(calls.length, 0, 'a lazy frame issues NO request before entering the viewport');
      assert.ok(observed, 'the frame was registered with the IntersectionObserver');

      // Simulate the frame scrolling into view.
      ioCallback([{ isIntersecting: true, target: observed }]);
      await settle();

      assert.equal(calls.length, 1, 'entering the viewport triggers exactly one fetch');
      assert.ok(calls[0].url.includes('/frames/lazy'));
      assert.equal(calls[0].init.headers['x-webjs-frame'], 'self');
      const frame = container.querySelector('webjs-frame#self');
      assert.ok(frame.querySelector('.loaded'), 'the lazy frame self-loaded its content');
    } finally {
      window.IntersectionObserver = origIO;
      teardown();
    }
  });

  test('no double-load: eager connect plus a redundant src re-set of the SAME url fetches once', async () => {
    setup();
    try {
      container.innerHTML = '<webjs-frame id="self" src="/frames/once"></webjs-frame>';
      await settle();
      assert.equal(calls.length, 1, 'connect fetched once');

      // Re-setting the SAME src must NOT re-fetch (the loaded-src guard).
      const frame = container.querySelector('webjs-frame#self');
      frame.setAttribute('src', '/frames/once');
      await settle();
      assert.equal(calls.length, 1, 'a no-op src re-set does not double-load');
    } finally { teardown(); }
  });

  test('changing src after connect re-loads the frame', async () => {
    setup();
    try {
      container.innerHTML = '<webjs-frame id="self" src="/frames/a"></webjs-frame>';
      await settle();
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes('/frames/a'));

      const frame = container.querySelector('webjs-frame#self');
      frame.setAttribute('src', '/frames/b');
      await settle();
      assert.equal(calls.length, 2, 'a DIFFERENT src re-loads');
      assert.ok(calls[1].url.includes('/frames/b'), 'the new src was fetched');
    } finally { teardown(); }
  });
});
