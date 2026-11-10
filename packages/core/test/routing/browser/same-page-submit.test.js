/**
 * Real-browser test for #1686: a form write that lands back on the page it was
 * submitted from updates that page in place, the way a Next.js server-action
 * form does after `revalidatePath`. An agent expects exactly this from Next.js,
 * and the router used to treat the submission as a navigation instead:
 *
 *   - the `loading.ts` skeleton replaced the page, and the form with it, while
 *     the write ran (so a validation re-render lost what was typed);
 *   - a history entry was pushed for the same url, so Back went nowhere;
 *   - the window scrolled to the top and focus was dropped;
 *   - the form kept the values just submitted;
 *   - a reused component never re-read a server-passed `.prop`, so it showed
 *     the data from before the write.
 *
 * A safe-method form (a search) is still a navigation and keeps the skeleton.
 *
 * Fixture rules carried over from `nav-preserve-scroll.test.js`: the page and
 * the response are both tall, the starting offset is asserted before the
 * submit, every url keeps the session query string, and the response repeats
 * the live boundary key so the router swaps in place.
 *
 * COUNTERFACTUALS, each run and proven to red the case it names (at the commit
 * that added this file): `applyOptimisticLoading()` for every submission reds
 * case 1's mid-flight half; `pushState` for a same-page result reds the history
 * assertion; dropping `!samePage` from the scroll guard reds the scroll one;
 * deleting `restoreFocus` reds the focus one; deleting the `form.reset()` reds
 * the reset one; deleting the `propsChanged` re-read in `dom-differ.js` reds
 * case 3.
 */
import { enableClientRouter, disableClientRouter } from '../../../src/router-client.js';
import { WebComponent } from '../../../src/component.js';
import { html } from '../../../src/html.js';
import { stringifySync } from '../../../src/serialize.js';

import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

const START_Y = 500;
const SPACER = 3000;
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 4; i++) { await tick(); } await frame(); await frame(); }

class PropProbe extends WebComponent {
  static properties = { items: { type: Array } };
  constructor() { super(); this.items = []; }
  render() { return html`<span class="count">${this.items.length}</span>`; }
}
PropProbe.register('wj-prop-probe-1686');

const here = () => location.pathname + location.search;
const searchHref = () => { const u = new URL(location.href); u.searchParams.set('wj1686', 'search'); return u.pathname + u.search; };
const attr = (v) => stringifySync(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** The page markup, live and in the response alike, with the server's state. */
function body({ items, message = '' }) {
  return '<!--wj:children:/:/same-page-1686-->'
    + `<div id="wj-spacer-1686" style="height:${SPACER}px">spacer</div>`
    + `<p id="wj-message-1686">${message}</p>`
    + `<wj-prop-probe-1686 id="wj-probe-1686" data-webjs-prop-items="${attr(items)}"></wj-prop-probe-1686>`
    + `<form id="wj-write-1686" method="post" action="${here()}">`
      + '<input id="wj-name-1686" name="name" value="">'
      + '<button id="wj-save-1686" type="submit">save</button>'
    + '</form>'
    + `<form id="wj-search-1686" method="get" action="${searchHref()}">`
      + '<input name="q" value="x"><button id="wj-find-1686" type="submit">find</button>'
    + '</form>'
    + '<!--/wj:children:/-->';
}

function response(state) {
  return '<!doctype html><html><head>' + document.head.innerHTML + '</head><body><div>'
    + body(state) + '</div></body></html>';
}

suite('Client router: a write that lands on the same page updates it in place (#1686)', () => {
  let navGuard, container, skeleton, origFetch, origUrl, release;
  /** What the next fetch answers with. */
  let next;

  setup(async () => {
    navGuard = installNavGuard();
    enableClientRouter();
    origUrl = location.href;
    document.documentElement.style.scrollBehavior = '';
    container = document.createElement('div');
    container.innerHTML = body({ items: [1] });
    document.body.prepend(container);
    // A root loading.ts skeleton, which a navigation shows.
    skeleton = document.createElement('template');
    skeleton.id = 'wj-loading:/';
    skeleton.innerHTML = '<p id="wj-skeleton-1686">loading</p>';
    document.body.append(skeleton);
    origFetch = window.fetch;
    window.fetch = () => new Promise((resolve) => {
      release = () => resolve(new Response(response(next), { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } }));
    });
    await settle();
    window.scrollTo({ left: 0, top: START_Y, behavior: 'instant' });
    assert.equal(window.scrollY, START_Y, 'the fixture scrolls, or the scroll assertion proves nothing');
  });

  teardown(() => {
    if (origFetch) window.fetch = origFetch;
    if (container) container.remove();
    if (skeleton) skeleton.remove();
    for (const id of ['wj-spacer-1686', 'wj-skeleton-1686']) document.getElementById(id)?.remove();
    if (origUrl) history.replaceState(null, '', origUrl);
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    if (navGuard) navGuard.remove();
    disableClientRouter();
    enableClientRouter();
  });

  test('1. a successful same-page write: no skeleton, no new history entry, scroll and focus kept, form reset', async () => {
    const input = /** @type {HTMLInputElement} */ (document.getElementById('wj-name-1686'));
    input.value = 'Ada';
    input.focus({ preventScroll: true });
    assert.equal(window.scrollY, START_Y, 'focusing the field did not move the window');
    const length = history.length;
    next = { items: [1], message: 'Saved Ada' };
    document.getElementById('wj-save-1686').click();
    await tick();
    assert.equal(document.getElementById('wj-skeleton-1686'), null, 'the skeleton is not shown for a write');
    assert.ok(input.isConnected, 'the form stays on the page while the write runs');
    release();
    await settle();
    assert.equal(document.getElementById('wj-message-1686').textContent, 'Saved Ada', 'the page updated in place');
    assert.equal(history.length, length, 'no history entry for the same url');
    assert.equal(here(), new URL(origUrl).pathname + new URL(origUrl).search);
    assert.equal(window.scrollY, START_Y, `the reader stays where they were (at ${window.scrollY}, focus on ${document.activeElement && document.activeElement.id}, len ${history.length - length})`);
    assert.equal(document.activeElement, input, 'the focused input keeps focus');
    assert.equal(input.value, '', 'the form is reset after a successful write');
    assert.deepEqual(navGuard.hardNavigations, [], 'no hard navigation');
  });

  test('2. a search (GET) is a navigation: it shows the skeleton', async () => {
    next = { items: [1] };
    document.getElementById('wj-find-1686').click();
    await tick();
    assert.ok(document.getElementById('wj-skeleton-1686'), 'the skeleton stands in while a navigation loads');
    release();
    await settle();
  });

  test('3. a reused component re-reads a server-passed .prop the write changed, and keeps an unchanged one', async () => {
    const probe = /** @type {any} */ (document.getElementById('wj-probe-1686'));
    assert.deepEqual(probe.items, [1]);
    next = { items: [1, 2, 3] };
    document.getElementById('wj-save-1686').click();
    await tick();
    release();
    await settle();
    assert.equal(document.getElementById('wj-probe-1686'), probe, 'the same instance, morphed');
    assert.deepEqual(probe.items, [1, 2, 3], 'the new server value reached the property');
    await probe.updateComplete;
    assert.equal(probe.querySelector('.count').textContent, '3', 'and the component re-rendered');
    assert.equal(probe.hasAttribute('data-webjs-prop-items'), false, 'the binding attribute is consumed again');

    // A value the component holds locally survives a write that leaves the
    // server's value unchanged, as a Lit binding commits only on a change.
    probe.items = [9];
    next = { items: [1, 2, 3] };
    document.getElementById('wj-save-1686').click();
    await tick();
    release();
    await settle();
    assert.deepEqual(probe.items, [9], 'an unchanged binding does not overwrite local state');
  });
});
