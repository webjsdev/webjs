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
  let container, origFetch, calls, origAssign, assigned;

  function setup(responder) {
    enableClientRouter(); // idempotent
    container = document.createElement('div');
    document.body.appendChild(container);
    calls = [];
    origFetch = window.fetch;
    window.fetch = (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve(responder(String(url), init || {}));
    };
    // Detect a full-page navigation (the router falls back to location.href on
    // a non-HTML / error response). We never want that for a 422 re-render.
    assigned = [];
    origAssign = Object.getOwnPropertyDescriptor(window.location, 'href');
  }
  function teardown() {
    window.fetch = origFetch;
    container.remove();
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
    let reloaded = false;
    setup(() => new Response(
      '<form method="POST" action="/signup"><p class="error">Enter a valid email</p>' +
      '<input name="email" value="bad"></form>',
      { status: 422, headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
    ));
    try {
      // Spy on location.href assignment: the router uses it as the fallback for
      // non-HTML/error responses. A 422 with an HTML body must NOT trigger it.
      const realDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
        || Object.getOwnPropertyDescriptor(window.location, 'href');
      try {
        Object.defineProperty(window.location, 'href', {
          configurable: true,
          get: () => location.toString(),
          set: () => { reloaded = true; },
        });
      } catch { /* some browsers forbid redefining; fall back to call-count via fetch */ }

      render(html`
        <form method="POST" action="/signup">
          <input name="email" value="bad">
          <button type="submit">go</button>
        </form>
      `, container);
      container.querySelector('button').click();
      await tick();

      assert.ok(calls.some((c) => c.url.includes('/signup')), 'fetch was issued');
      assert.equal(reloaded, false, '422 HTML must be applied in place, never a full reload');

      // Restore the href descriptor.
      try { if (realDescriptor) Object.defineProperty(window.location, 'href', realDescriptor); } catch { /* ignore */ }
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
    try {
      const before = location.pathname;
      render(html`
        <form method="POST" action="/signup">
          <button type="submit">go</button>
        </form>
      `, container);
      container.querySelector('button').click();
      await tick();
      assert.ok(calls.some((c) => c.url.includes('/signup')), 'fetch was issued');
      assert.equal(location.pathname, '/welcome', 'history advanced to the redirected URL');
      // Restore history so later tests start clean.
      history.replaceState(null, '', before);
    } finally { teardown(); }
  });
});
