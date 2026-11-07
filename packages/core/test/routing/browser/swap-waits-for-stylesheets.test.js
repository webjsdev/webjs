/**
 * A navigation loads the stylesheets the incoming page links before it swaps
 * the page in (#1666).
 *
 * A stylesheet link starts loading only once it is in the live document, and
 * it always loads asynchronously, so a router that swaps in the same task as
 * the parse paints the new content for at least a frame without its styles.
 * On webjs.dev/ui that was a visible flash: a docs page links its kit style
 * inline (only the root layout writes `<head>`, and a soft navigation never
 * re-renders it), and the preview painted unstyled until the file arrived.
 *
 * The sheets are served from `blob:` URLs, which load asynchronously like any
 * other, so the first assertion fails on a router that does not wait.
 */
import { enableClientRouter, disableClientRouter, refreshPage, _setCurrentPageUrl } from '../../../src/router-client.js';
import { loadIncomingStylesheets, releaseIncomingStylesheets, PRELOAD_ATTR } from '../../../src/router-client/stylesheets.js';

import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

const KEY = '/swap-stylesheets-1666';
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

const cssUrl = (css) => URL.createObjectURL(new Blob([css], { type: 'text/css' }));

/** A page whose content links `href` inline in the body, as a section does. */
const docHtml = (href, label) => `<!doctype html><html><head></head><body>`
  + `<!--wj:children:/:${KEY}-->`
  + `<main id="wj-sheet-main">${href ? `<link rel="stylesheet" href="${href}">` : ''}<div id="wj-sheet-probe">${label}</div></main>`
  + `<!--/wj:children:/-->`
  + `</body></html>`;

suite('Client router: a swap waits for the stylesheets the page brings (#1666)', () => {
  let navGuard, origFetch, respond, added;

  setup(() => {
    navGuard = installNavGuard();
    enableClientRouter();
    _setCurrentPageUrl(location.href);
    origFetch = window.fetch;
    window.fetch = () => Promise.resolve(new Response(respond(), { status: 200, headers: { 'content-type': 'text/html' } }));
    added = [];
    const host = document.createElement('div');
    host.innerHTML = docHtml(null, 'before');
    document.body.append(...host.childNodes);
  });

  teardown(() => {
    window.fetch = origFetch;
    document.getElementById('wj-sheet-main')?.remove();
    for (const n of [...document.body.childNodes]) {
      if (n.nodeType === 8 && /^\/?wj:children:/.test(n.data)) n.remove();
    }
    for (const url of added) {
      document.querySelectorAll(`link[href="${url}"]`).forEach((l) => l.remove());
      URL.revokeObjectURL(url);
    }
    _setCurrentPageUrl(null);
    navGuard.remove();
    disableClientRouter();
  });

  test('the incoming content is styled on the first frame it is in the document', async () => {
    const url = cssUrl('#wj-sheet-probe { width: 123px; display: block; }');
    added.push(url);
    respond = () => docHtml(url, 'after');

    // Read the probe's width the moment the new markup lands, before any frame.
    let widthAtSwap = null;
    const observer = new MutationObserver(() => {
      const probe = document.getElementById('wj-sheet-probe');
      if (widthAtSwap === null && probe && probe.textContent === 'after') widthAtSwap = getComputedStyle(probe).width;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    assert.equal(await refreshPage('shell'), true, 'the refresh applied');
    observer.disconnect();

    assert.equal(widthAtSwap, '123px', 'the stylesheet was applied when the content arrived');
    // The router adds no stylesheet state of its own: once the page's own link
    // has loaded, the temporary copy in <head> is gone.
    for (let i = 0; i < 20 && document.querySelector(`[${PRELOAD_ATTR}]`); i++) await frame();
    assert.equal(document.querySelectorAll(`[${PRELOAD_ATTR}]`).length, 0, 'no temporary copy remains');
    assert.equal(document.querySelectorAll(`link[href="${url}"]`).length, 1, 'only the page\'s own link to the sheet is left');
    assert.equal(getComputedStyle(document.getElementById('wj-sheet-probe')).width, '123px', 'and the sheet still applies');
  });

  test('a copy whose file the page does not link is removed at once', () => {
    const url = cssUrl('#wj-sheet-probe { color: red; }');
    added.push(url);
    const doc = new DOMParser().parseFromString(docHtml(url, 'after'), 'text/html');
    const incoming = loadIncomingStylesheets(doc, location.href);
    assert.ok(incoming, 'the new sheet is loaded');
    assert.equal(document.querySelectorAll(`[${PRELOAD_ATTR}]`).length, 1);
    releaseIncomingStylesheets(incoming);
    assert.equal(document.querySelectorAll(`[${PRELOAD_ATTR}]`).length, 0, 'discarded, so nothing is left behind');
  });

  test('a stylesheet that fails to load does not hold the navigation', async () => {
    respond = () => docHtml('/__webjs-missing-stylesheet-1666.css', 'after');
    added.push('/__webjs-missing-stylesheet-1666.css');
    assert.equal(await refreshPage('shell'), true, 'the refresh applied');
    await frame();
    assert.equal(document.getElementById('wj-sheet-probe').textContent, 'after');
  });

  test('a page that brings no new stylesheet adds nothing to wait for', () => {
    const doc = new DOMParser().parseFromString(docHtml(null, 'after'), 'text/html');
    assert.equal(loadIncomingStylesheets(doc, location.href), null, 'nothing new, so the swap stays in its task');

    const url = cssUrl('#wj-sheet-probe { color: red; }');
    added.push(url);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    const again = new DOMParser().parseFromString(docHtml(url, 'after'), 'text/html');
    assert.equal(loadIncomingStylesheets(again, location.href), null, 'a stylesheet the page already links is not waited for');
  });

  test('an alternate, disabled or non-matching stylesheet is not waited for', () => {
    const html = `<!doctype html><html><head></head><body>`
      + `<link rel="alternate stylesheet" href="/alt.css">`
      + `<link rel="stylesheet" disabled href="/off.css">`
      + `<link rel="stylesheet" media="print" href="/print.css">`
      + `</body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    assert.equal(loadIncomingStylesheets(doc, location.href), null);
  });

  test('a frame navigation reads only the frame, not the rest of the page', () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="/head-only.css"></head><body>`
      + `<link rel="stylesheet" href="/outside-frame.css">`
      + `<webjs-frame id="wj-sheet-frame"><p>frame</p></webjs-frame>`
      + `</body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    assert.equal(loadIncomingStylesheets(doc, location.href, 'wj-sheet-frame'), null, 'the sheets outside the frame are not loaded');
  });
});
