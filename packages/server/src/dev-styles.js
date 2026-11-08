/**
 * Stylesheet re-request for the in-place dev refresh (#1398), the BROWSER half.
 * Kept as a standalone browser-safe module (no node imports) so the served
 * reload client inlines the EXACT source a browser test drives, with no drift,
 * the same pattern as `dev-overlay.js` (#264) and `dev-reload-worker.js` (#887).
 *
 * Why it has to exist at all. A swap never re-requests the page's stylesheets
 * on its own: `mergeHead` preserves every stylesheet unconditionally (#936),
 * `addNewHeadElements` is add-only, and the dev href carries no content hash
 * (`asset()` is prod-only), so the link node is kept by identity and the browser
 * never asks the server for it again. A full page reload used to do that
 * asking, which is how `webjs.dev.regenerate` (#967) ever ran, since it rebuilds
 * a stale build output like `public/tailwind.css` ON REQUEST. Without this, an
 * edit that adds a utility class morphs in and the class has no backing rule
 * until a manual reload. Every in-repo app is configured that way, and the plain
 * `tailwindcss --watch` shape has the same problem.
 */

/**
 * Load the rebuilt stylesheets BEFORE the in-place refresh swaps the markup in
 * (#1535), so a new class never paints without its rule.
 *
 * The re-request used to run AFTER the swap, and that order was the flash: the new
 * markup is on screen while its stylesheet is still being rebuilt and fetched
 * (a `webjs.dev.regenerate` compile is 100ms to seconds), so an element that
 * gained a utility class shows with no rule for it until the sheet lands.
 * Measured on a fixture with an 800ms compile: 56 animation frames (about
 * 0.9s) painted the edited element unstyled. A full reload never had the
 * problem, because a `<head>` stylesheet is render-blocking and the browser
 * holds the old page until it loads.
 *
 * So the cache-busted replacements go in first, BESIDE the current links
 * (both apply meanwhile, the same rules twice), and the returned promise
 * resolves once each has loaded or failed, or after `timeoutMs` for one that
 * hangs. The caller swaps the markup in and then calls `commit()`, which drops
 * each old link whose replacement loaded, plus any same-identity copy the head
 * merge appended, keeping the replacement. A replacement that failed is
 * removed and the old link kept (#936, #1400: never take the last working
 * sheet down). One still pending at commit finishes the same way when it
 * settles.
 *
 * @param {ParentNode} [root]  where to scan, defaulting to the whole document.
 * @param {() => number} [now]  cache-buster source, injectable for tests.
 * @param {number} [timeoutMs]  the longest to hold the swap for a stylesheet.
 * @returns {Promise<{ links: Element[], commit: () => void }>}
 */
export function preloadStyles(root, now, timeoutMs) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : 10000;
  if (!scope) return Promise.resolve({ links: [], commit: function () {} });
  const stamp = now || Date.now;
  /** @type {Record<string, { el: Element, url: URL }>} */
  const kept = Object.create(null);
  const current = [].slice.call(scope.querySelectorAll('link[rel~="stylesheet"][href]'));
  for (const el of current) {
    let url;
    try { url = new URL(el.getAttribute('href'), location.href); } catch (_) { continue; }
    if (url.origin !== location.origin) continue;
    const key = identityKey(el, url);
    if (kept[key]) { if (el.parentNode) el.parentNode.removeChild(el); continue; }
    kept[key] = { el, url };
  }
  let committed = false;
  /** @type {Array<{ key: string, file: string, old: Element, next: Element, state: string }>} */
  const pairs = [];
  // Drop every other copy of this sheet (the old link, a copy the head merge
  // re-appended, the client router's temporary preload copy) so exactly the
  // replacement is left. The router marks its copy `data-webjs-preload-style`
  // and gives it only the fetch attributes, so it never shares the identity
  // key. Left in place it waits for a twin link this function has just
  // removed, and lingers until the router's timeout. So a copy goes too when
  // it is the same file (the same URL once the dev cache-buster is ignored,
  // so `?theme=dark` stays when `?theme=light` is rebuilt) AND has already
  // loaded: an unloaded copy is one a navigation is still waiting on, and
  // removing it would stall that navigation for the whole timeout.
  const settleLoaded = function (pair) {
    if (pair.old.parentNode) pair.old.parentNode.removeChild(pair.old);
    const links = [].slice.call(scope.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (const el of links) {
      if (el === pair.next) continue;
      let url;
      try { url = new URL(el.getAttribute('href'), location.href); } catch (_) { continue; }
      if (url.origin !== location.origin || !el.parentNode) continue;
      const routerCopy = el.hasAttribute(ROUTER_PRELOAD_ATTR) && !!el.sheet && withoutBuster(url) === pair.file;
      if (routerCopy || identityKey(el, url) === pair.key) el.parentNode.removeChild(el);
    }
  };
  const waits = [];
  for (const key of Object.keys(kept)) {
    const old = kept[key].el;
    const url = kept[key].url;
    if (!old.parentNode) continue;
    const file = withoutBuster(url);
    url.searchParams.set('__webjs_dev', String(stamp()));
    const next = /** @type {Element} */ (old.cloneNode(false));
    next.setAttribute('href', url.pathname + url.search);
    // The copy loads under a media query that matches nothing, so it never
    // applies before its load handler has decided whether it should: the
    // client router can switch the link off or on (#1669) while this refresh
    // waits, so that state is read at load, not now.
    const media = authoredMedia(old);
    next.removeAttribute('data-wj-style-media');
    next.setAttribute('media', 'not all');
    const pair = { key, file, old, next, state: 'pending' };
    pairs.push(pair);
    waits.push(new Promise(function (resolve) {
      next.addEventListener('load', function () {
        // A section sheet the router switched off is refreshed too, so going
        // back to the section switches on the edited file, but the copy stays
        // off until then, like the link it replaces. Media first: Firefox and
        // WebKit give the link a new sheet object when its media changes, so
        // disabling before would be lost.
        const off = old.parentNode ? old.hasAttribute('data-wj-style-off') : next.hasAttribute('data-wj-style-off');
        if (off) next.setAttribute('data-wj-style-off', ''); else next.removeAttribute('data-wj-style-off');
        if (media) next.setAttribute('media', media); else next.removeAttribute('media');
        if (next.sheet) next.sheet.disabled = off;
        pair.state = 'load';
        if (committed) settleLoaded(pair);
        resolve(undefined);
      });
      next.addEventListener('error', function () {
        pair.state = 'error';
        if (next.parentNode) next.parentNode.removeChild(next);
        resolve(undefined);
      });
    }));
    old.parentNode.insertBefore(next, old.nextSibling);
  }
  const commit = function () {
    committed = true;
    for (const pair of pairs) if (pair.state === 'load') settleLoaded(pair);
  };
  const links = pairs.map(function (p) { return p.next; });
  if (!waits.length) return Promise.resolve({ links, commit });
  return new Promise(function (resolve) {
    let done = false;
    const finish = function () { if (!done) { done = true; resolve({ links, commit }); } };
    Promise.all(waits).then(finish);
    setTimeout(finish, limit);
  });
}

/**
 * The attribute the client router marks its temporary stylesheet copies with
 * (`PRELOAD_ATTR` in core's `router-client/stylesheets.js`). Duplicated rather
 * than imported, since this module is inlined into the reload client as source.
 */
const ROUTER_PRELOAD_ATTR = 'data-webjs-preload-style';

/**
 * A stylesheet URL with the dev cache-buster removed, which is what names the
 * file: two links that differ only by `__webjs_dev` load the same rules.
 * @param {URL} url
 */
function withoutBuster(url) {
  const u = new URL(url.href);
  u.searchParams.delete('__webjs_dev');
  return u.pathname + u.search;
}

/**
 * A link's identity for de-duping: its path plus every attribute except `href`.
 * JSON-encoded over a sorted list so no separator can collide with an attribute
 * value.
 * @param {Element} el
 * @param {URL} url
 */
function identityKey(el, url) {
  const parts = [];
  const attrs = el.attributes;
  for (let a = 0; a < attrs.length; a++) {
    const name = attrs[a].name;
    // The client router's switch-off state (#1669) is not part of which sheet
    // a link is, and neither is a held `not all` media: the author's is.
    if (name === 'href' || name === 'data-wj-style-off' || name === 'data-wj-style-media') continue;
    parts.push([name, name === 'media' ? authoredMedia(el) : attrs[a].value]);
  }
  parts.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return JSON.stringify([url.pathname, parts]);
}

/**
 * The media a link applies under: the author's, also while the client router
 * holds it under `not all` (`data-wj-style-media`, owned-styles.js).
 * @param {Element} el
 */
function authoredMedia(el) {
  return el.hasAttribute('data-wj-style-media') ? el.getAttribute('data-wj-style-media') : el.getAttribute('media');
}
