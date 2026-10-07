/**
 * A mutating form submission refreshes the layout chrome (#1557).
 *
 * A layout's own markup (a header reading the session cookie) sits OUTSIDE
 * every children range, so the boundary tiers cannot reach it, and a form
 * action that sets that cookie used to leave it stale until a reload. The fix
 * has two halves, and each test pins one: the submission sends no
 * `X-Webjs-Have` (so the server re-renders the layouts), and the swap morphs
 * the chrome around the plan's range, preserving what it can.
 *
 * The fetch mock plays the server: given a have-header naming the root layout
 * it answers with the reduced fragment the real short-circuit produces (no
 * header), and without one it answers with the full document. So the first
 * test fails if EITHER half regresses.
 *
 * The fixture is PREPENDED to `<body>`, so the runner's own nodes trail it,
 * which is also the shape of a runtime-appended node (a dev overlay, a dialog
 * portal) that the chrome morph must leave alone.
 */
import { enableClientRouter, disableClientRouter, _setCurrentPageUrl } from '../../../src/router-client.js';
import { planLayoutChrome } from '../../../src/router-client/layout-chrome.js';

import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 8; i++) await tick(); }

/** A counter whose count lives on the INSTANCE, so it survives only if the node does. */
class PmCounter extends HTMLElement {
  constructor() { super(); this.count = 0; }
  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    this.textContent = 'C0';
    this.addEventListener('click', () => { this.count++; this.textContent = 'C' + this.count; });
  }
}
if (!customElements.get('wj-pm-counter-1557')) customElements.define('wj-pm-counter-1557', PmCounter);

/**
 * The rendered body. `signedIn` drives the header; `page` is the page segment,
 * so a changed page remounts inside the root range exactly as the server's
 * keyed boundaries make it.
 */
function bodyHtml({ signedIn, page, inner, banner }) {
  return '<div id="pm-app">'
    + (banner ? '<p id="pm-banner">Welcome back</p>' : '')
    + `<header id="pm-header"><span id="pm-auth">${signedIn ? 'Signed in' : 'Signed out'}</span>`
    + '<wj-pm-counter-1557 id="pm-ctr"></wj-pm-counter-1557></header>'
    + `<main id="pm-main"><!--wj:children:/:/--><!--wj:children:${page}:${page}-->`
    + inner
    + `<!--/wj:children:${page}--><!--/wj:children:/--></main>`
    + '<footer id="pm-footer">F</footer>'
    + '</div>';
}

const FORM = '<form id="pm-form" method="POST" action="/pm-signin"><input id="pm-email" name="email" value="">'
  + '<button id="pm-go" type="submit">go</button></form>';

suite('Client router: a mutating submission refreshes the layout chrome (#1557)', () => {
  let navGuard, origFetch, calls, server, app;

  function mount(parts) {
    const holder = document.createElement('div');
    holder.innerHTML = bodyHtml(parts);
    app = holder.firstChild;
    document.body.prepend(app);
  }

  function setup() {
    navGuard = installNavGuard();
    enableClientRouter();
    _setCurrentPageUrl(location.href);
    calls = [];
    // What the server renders for the NEXT request. A test sets it before submitting.
    server = { signedIn: true, page: '/recipes', inner: '<h1 id="pm-page">Recipes</h1>', status: 200, banner: false };
    origFetch = window.fetch;
    window.fetch = (url, init) => {
      const headers = (init && init.headers) || {};
      calls.push({ url: String(url), method: (init && init.method) || 'GET', have: headers['x-webjs-have'] ?? null });
      const have = headers['x-webjs-have'] || '';
      // The real server short-circuits at a layout the client already holds:
      // the root layout's header is simply not in the response.
      const body = /(^|,)\/:\//.test(have)
        ? `<!--wj:children:/:/--><!--wj:children:${server.page}:${server.page}-->${server.inner}<!--/wj:children:${server.page}--><!--/wj:children:/-->`
        : bodyHtml(server);
      return Promise.resolve(new Response(`<!doctype html><html><head><title>pm</title></head><body>${body}</body></html>`, {
        status: server.status,
        headers: { 'content-type': 'text/html', 'x-webjs-build': '' },
      }));
    };
  }

  function teardown() {
    window.fetch = origFetch;
    for (const id of ['pm-app', 'pm-runtime']) document.querySelectorAll('#' + id).forEach((el) => el.remove());
    for (const n of [...document.body.childNodes]) {
      if (n.nodeType === 8 && /^\/?wj:children:/.test(n.data)) n.remove();
    }
    _setCurrentPageUrl(null);
    navGuard.remove();
    disableClientRouter();
  }

  async function submit() {
    document.getElementById('pm-go').click();
    await settle();
  }

  test('the header updates after a cookie-setting submission, and the layout counter keeps its state', async () => {
    setup();
    try {
      mount({ signedIn: false, page: '/signin', inner: FORM });
      const ctr = document.getElementById('pm-ctr');
      const header = document.getElementById('pm-header');
      ctr.click(); ctr.click();

      await submit();

      const post = calls.find((c) => c.method === 'POST');
      assert.ok(post, 'the submission went through the router');
      assert.equal(post.have, null, 'a mutating submission sends no X-Webjs-Have');
      assert.equal(document.getElementById('pm-page').textContent, 'Recipes', 'the page swapped');
      assert.equal(document.getElementById('pm-auth').textContent, 'Signed in',
        'the layout header outside every range was refreshed');
      assert.equal(document.getElementById('pm-header'), header, 'by a morph: the header is the same node');
      assert.equal(document.getElementById('pm-ctr'), ctr, 'the layout component is the same node');
      assert.equal(ctr.count, 2, 'so its hydrated state survived');
      assert.equal(navGuard.hardNavigations.length, 0, 'and nothing degraded to a full load');
    } finally {
      teardown();
    }
  });

  test('a chrome sibling that appears or disappears is inserted or removed, never duplicated', async () => {
    setup();
    try {
      mount({ signedIn: false, page: '/signin', inner: FORM });
      server.banner = true;
      await submit();
      assert.equal(document.querySelectorAll('#pm-banner').length, 1, 'the signed-in banner appeared once');
      assert.equal(document.querySelectorAll('#pm-header').length, 1, 'the header was not duplicated');
      assert.equal(document.querySelectorAll('#pm-footer').length, 1, 'nor the footer');

      server.banner = false;
      server.signedIn = false;
      server.page = '/signin';
      server.inner = FORM;
      // The recipes page has no form, so submit through a fresh one in the page range.
      document.getElementById('pm-page').insertAdjacentHTML('afterend', FORM);
      await submit();
      assert.equal(document.querySelectorAll('#pm-banner').length, 0, 'the banner went away');
      assert.equal(document.getElementById('pm-auth').textContent, 'Signed out', 'and the header flipped back');
      assert.equal(document.querySelectorAll('#pm-header').length, 1, 'with exactly one header');
    } finally {
      teardown();
    }
  });

  test('a node appended to <body> at runtime survives the chrome morph', async () => {
    setup();
    try {
      mount({ signedIn: false, page: '/signin', inner: FORM });
      const runtime = document.createElement('div');
      runtime.id = 'pm-runtime';
      document.body.appendChild(runtime);
      await submit();
      assert.equal(document.getElementById('pm-auth').textContent, 'Signed in', 'the chrome refreshed');
      assert.equal(document.getElementById('pm-runtime'), runtime, 'and the runtime-appended node is untouched');
    } finally {
      teardown();
    }
  });

  test('a 422 re-render keeps what the reader typed and still refreshes the chrome', async () => {
    setup();
    try {
      mount({ signedIn: false, page: '/signin', inner: FORM });
      document.getElementById('pm-email').value = 'typed@example.com';
      server.status = 422;
      server.signedIn = false;
      server.page = '/signin';
      server.inner = FORM + '<p id="pm-error">bad password</p>';
      await submit();
      assert.ok(document.getElementById('pm-error'), 'the validation re-render applied');
      assert.equal(document.getElementById('pm-email').value, 'typed@example.com',
        'the morph kept the typed value');
    } finally {
      teardown();
    }
  });

  test('a GET link navigation still sends X-Webjs-Have and leaves the chrome alone', async () => {
    setup();
    try {
      mount({ signedIn: false, page: '/signin', inner: '<a id="pm-link" href="/pm-recipes">r</a>' });
      document.getElementById('pm-link').click();
      await settle();
      const get = calls.find((c) => c.method === 'GET');
      assert.ok(get && get.have && /(^|,)\/:\//.test(get.have), 'the link nav sent the have-header');
      assert.equal(document.getElementById('pm-page').textContent, 'Recipes', 'the page swapped');
      assert.equal(document.getElementById('pm-auth').textContent, 'Signed out',
        'and the layout markup was not re-rendered: the fast path is unchanged');
    } finally {
      teardown();
    }
  });

  // The refusal is what keeps the morph honest: a hydrated component on the
  // chain owns its subtree (#906), so the caller must take the full-body tier.
  test('the chrome plan refuses a chain through a hydrated component, and a mismatched chain', () => {
    const live = new DOMParser().parseFromString(
      '<body><x-shell><main><!--wj:children:/:/-->a<!--/wj:children:/--></main></x-shell></body>', 'text/html');
    const inc = new DOMParser().parseFromString(
      '<body><x-shell><main><!--wj:children:/:/-->b<!--/wj:children:/--></main></x-shell></body>', 'text/html');
    const range = (doc) => {
      const main = doc.querySelector('main');
      return { start: main.firstChild, end: main.lastChild };
    };
    assert.ok(planLayoutChrome(range(live), range(inc), live.body, inc.body), 'a plain matching chain plans');
    live.querySelector('x-shell')[Symbol.for('webjs.instance')] = {};
    assert.equal(planLayoutChrome(range(live), range(inc), live.body, inc.body), null,
      'a hydrated component on the chain refuses');
    const flat = new DOMParser().parseFromString(
      '<body><main><!--wj:children:/:/-->b<!--/wj:children:/--></main></body>', 'text/html');
    assert.equal(planLayoutChrome(range(inc), range(flat), inc.body, flat.body), null,
      'a chain of a different depth refuses');
  });
});
