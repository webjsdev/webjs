/**
 * Real-browser tests for the client router's enhanced handling of page-action
 * form submissions (#244): a `<form method="POST">` to a page that exports an
 * `action`. The no-JS path is a native form round-trip; the JS path rides the
 * partial-swap pipeline. This pins the two responses the page-action server
 * produces:
 *
 *   - 422 re-render (validation failure): HTML of a 4xx status is applied in
 *     place (NO full-page reload), so the field errors + preserved input show
 *     without losing the rest of the page. This is the same UI the no-JS reload
 *     produces.
 *   - 303 See Other (success / PRG): `fetch` follows it automatically; the
 *     router records the FINAL (redirected) URL in history, not the POST target.
 *
 * MUST run in a real browser: we detect router interception by stubbing fetch
 * (the router's submission path calls it) and inspecting the RequestInit.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { enableClientRouter } from '../../../src/router-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};
const tick = () => new Promise((r) => setTimeout(r, 20));

suite('Client router: page-action form submissions (#244)', () => {
  let container, origFetch, calls;
  // When a test redefines window.location.href (to detect a full-page reload),
  // it records the restore fn here so teardown reverts it even if the body
  // throws. Null when no redefine is active.
  let restoreHref;

  function setup(responder) {
    enableClientRouter(); // idempotent
    container = document.createElement('div');
    document.body.appendChild(container);
    calls = [];
    restoreHref = null;
    origFetch = window.fetch;
    window.fetch = (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve(responder(String(url), init || {}));
    };
  }
  function teardown() {
    window.fetch = origFetch;
    if (restoreHref) { try { restoreHref(); } catch { /* ignore */ } restoreHref = null; }
    container.remove();
  }

  /**
   * Replace window.location.href's setter with a spy so a full-page reload is
   * observable (the router falls back to `location.href = url` only for a
   * non-HTML / error response). Returns a getter for the reload count. The
   * descriptor restore is registered on `restoreHref` so teardown always
   * reverts it. Some browsers forbid redefining the accessor; in that case the
   * spy is a no-op and the test leans on the DOM-applied assertion instead.
   */
  function spyOnReload() {
    let reloads = 0;
    const realDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
      || Object.getOwnPropertyDescriptor(window.location, 'href');
    let installed = false;
    try {
      Object.defineProperty(window.location, 'href', {
        configurable: true,
        get: () => location.toString(),
        set: () => { reloads += 1; },
      });
      installed = true;
    } catch { /* redefining forbidden here; rely on the DOM assertion */ }
    if (installed && realDescriptor) {
      restoreHref = () => Object.defineProperty(window.location, 'href', realDescriptor);
    }
    return { count: () => reloads, installed: () => installed };
  }

  test('a POST form sends FormData as the request body (enhanced path engages)', async () => {
    setup(() => new Response('<p>ok</p>', {
      headers: { 'content-type': 'text/html', 'x-webjs-build': '' },
    }));
    try {
      render(html`
        <form method="POST" action="/signup">
          <input name="email" value="a@b.com">
          <button type="submit">go</button>
        </form>
      `, container);
      container.querySelector('button').click();
      await tick();
      const post = calls.find((c) => c.url.includes('/signup'));
      assert.ok(post, 'router issued the submission fetch');
      assert.equal((post.init.method || 'GET').toUpperCase(), 'POST', 'method is POST');
      assert.ok(post.init.body instanceof FormData, 'body is FormData');
      assert.equal(post.init.body.get('email'), 'a@b.com', 'FormData carries the field');
    } finally { teardown(); }
  });

  test('a 422 HTML response is applied in place, not via a full reload', async () => {
    // A unique marker in the 422 body. The router swaps the body in place, so
    // after the submission the marker must be in the live document. A full
    // reload would instead leave the spy's reload count non-zero AND never
    // place the marker. Asserting both makes "applied in place" robust rather
    // than leaning on a single inline flag.
    const marker = `pa-422-${Math.random().toString(36).slice(2)}`;
    setup(() => new Response(
      `<main><form method="POST" action="/signup"><p class="error" id="${marker}">Enter a valid email</p>` +
      '<input name="email" value="bad"></form></main>',
      { status: 422, headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
    ));
    const reload = spyOnReload();
    try {
      render(html`
        <main>
          <form method="POST" action="/signup">
            <input name="email" value="bad">
            <button type="submit">go</button>
          </form>
        </main>
      `, container);
      container.querySelector('button').click();
      await tick();

      assert.ok(calls.some((c) => c.url.includes('/signup')), 'fetch was issued');
      assert.equal(reload.count(), 0, '422 HTML must be applied in place, never a full reload');
      // The 422 body was actually applied to the live DOM (the field error is
      // now present), which a full reload would never achieve from a fetch stub.
      assert.ok(document.getElementById(marker), 'the 422 re-render body was applied in place');
    } finally { teardown(); }
  });

  test('a 303-redirected success records the FINAL url in history (PRG)', async () => {
    // fetch follows a 303 automatically; the resolved Response reports
    // redirected=true and url=<final>. The router records that, not the POST
    // target. We simulate by returning a redirected-shaped Response.
    setup(() => {
      const r = new Response('<p>welcome</p>', {
        status: 200, headers: { 'content-type': 'text/html', 'x-webjs-build': '' },
      });
      Object.defineProperty(r, 'redirected', { value: true });
      Object.defineProperty(r, 'url', { value: location.origin + '/welcome' });
      return r;
    });
    const before = location.pathname;
    try {
      render(html`
        <form method="POST" action="/signup">
          <button type="submit">go</button>
        </form>
      `, container);
      container.querySelector('button').click();
      await tick();
      assert.ok(calls.some((c) => c.url.includes('/signup')), 'fetch was issued');
      assert.equal(location.pathname, '/welcome', 'history advanced to the redirected URL');
    } finally {
      // Restore history so later tests start clean.
      history.replaceState(null, '', before);
      teardown();
    }
  });
});
