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

import { assert } from '../../../../../test/browser-assert.js';
const tick = () => new Promise((r) => setTimeout(r, 20));

suite('Client router: page-action form submissions (#244)', () => {
  // LAST-RESORT navigation backstop for a loaded runner: if the router under
  // pressure fails a boundary scan and degrades to a full page load, the
  // native form submission would navigate the WTR page away and kill the
  // whole file ("Tests were interrupted..."). A BUBBLE-phase listener at the
  // window level fires after the router's document-level handling had its
  // chance (a capture listener here would fire FIRST and break every
  // router-handled submission): when the event is still not
  // default-prevented by the time it bubbles out to the window, cancel it so
  // the ASSERTIONS fail visibly instead of the page dying. Never interferes
  // with router-handled submissions (those are already default-prevented).
  window.addEventListener(
    'submit',
    (e) => {
      if (!e.defaultPrevented) e.preventDefault();
    },
    false,
  );

  let container, origFetch, calls;
  // When a test redefines window.location.href (to detect a full-page reload),
  // it records the restore fn here so teardown reverts it even if the body
  // throws. Null when no redefine is active.
  let restoreHref;

  let bOpen, bClose;
  function setup(responder) {
    enableClientRouter(); // idempotent
    container = document.createElement('div');
    // Bracket the container with a live keyed boundary pair (#1015): the swap
    // needs a shared boundary on both sides, else the router (correctly)
    // degrades to a full page load, which would navigate the test page away.
    bOpen = document.createComment('wj:children:/:/');
    bClose = document.createComment('/wj:children:/');
    document.body.appendChild(bOpen);
    document.body.appendChild(container);
    document.body.appendChild(bClose);
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
    if (bOpen) bOpen.remove();
    if (bClose) bClose.remove();
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
    setup(() => new Response('<!--wj:children:/:/--><p>ok</p><!--/wj:children:/-->', {
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
      `<!--wj:children:/:/--><main><form method="POST" action="/signup"><p class="error" id="${marker}">Enter a valid email</p>` +
      '<input name="email" value="bad"></form></main><!--/wj:children:/-->',
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
      const r = new Response('<!--wj:children:/:/--><p>welcome</p><!--/wj:children:/-->', {
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
