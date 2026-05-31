/**
 * Real-browser tests for the client router's event-phase handling of
 * JS-handled links and forms (#150 submit, #153 click).
 *
 * The router's click + submit listeners are registered in the BUBBLE phase, so
 * a component's per-element `@click` / `@submit` (which runs at-target, before a
 * document-level bubble listener) can `preventDefault` and the router's
 * `if (e.defaultPrevented) return` guard leaves the element alone. A capture
 * listener would fire first, before the component, and wrongly hijack the link
 * (navigate it) or form (submit it).
 *
 * This MUST run in a real browser: linkedom does not model capture-vs-bubble
 * ordering of a document-level vs element-level listener, so the unit env can
 * neither reproduce the bug nor prove the fix. We detect a router interception
 * by stubbing fetch (the router's navigation/submission calls it).
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { enableClientRouter } from '../../../src/router-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};
const tick = () => new Promise((r) => setTimeout(r, 0));

suite('Client router: JS-handled links/forms are not hijacked (#150, #153)', () => {
  let container, origFetch, fetched;

  function setup() {
    enableClientRouter(); // idempotent; ensures the document listeners are attached
    container = document.createElement('div');
    document.body.appendChild(container);
    fetched = [];
    origFetch = window.fetch;
    window.fetch = (url) => {
      fetched.push(String(url));
      return Promise.resolve(new Response('<p>x</p>', {
        headers: { 'content-type': 'text/html', 'x-webjs-build': '' },
      }));
    };
  }
  function teardown() { window.fetch = origFetch; container.remove(); }

  test('a @click=preventDefault link is NOT navigated by the router', async () => {
    setup();
    try {
      let ran = false;
      render(html`<a href="/js-handled-link" @click=${(e) => { e.preventDefault(); ran = true; }}>go</a>`, container);
      container.querySelector('a').click();
      await tick();
      assert.ok(ran, 'the component @click handler ran');
      assert.equal(fetched.filter((u) => u.includes('/js-handled-link')).length, 0,
        'router must NOT navigate a preventDefaulted link');
    } finally { teardown(); }
  });

  test('a @submit=preventDefault form is NOT submitted by the router', async () => {
    setup();
    try {
      let ran = false;
      render(html`<form @submit=${(e) => { e.preventDefault(); ran = true; }}><button type="submit">go</button></form>`, container);
      container.querySelector('button').click();
      await tick();
      assert.ok(ran, 'the component @submit handler ran');
      assert.equal(fetched.length, 0, 'router must NOT submit a preventDefaulted form');
    } finally { teardown(); }
  });

  test('positive control: a plain <a href> link IS still SPA-navigated by the router', async () => {
    setup();
    try {
      render(html`<a href="/plain-link-target">go</a>`, container);
      container.querySelector('a').click();
      await tick();
      assert.ok(fetched.some((u) => u.includes('/plain-link-target')),
        'router must SPA-navigate a plain link (the fix must not break progressive enhancement)');
    } finally { teardown(); }
  });
});
