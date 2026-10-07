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
  /** @type {Array<{ key: string, old: Element, next: Element, state: string }>} */
  const pairs = [];
  // Drop every other copy of this sheet (the old link, a copy the head merge
  // re-appended) so exactly the replacement is left.
  const settleLoaded = function (pair) {
    const links = [].slice.call(scope.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (const el of links) {
      if (el === pair.next) continue;
      let url;
      try { url = new URL(el.getAttribute('href'), location.href); } catch (_) { continue; }
      if (url.origin === location.origin && identityKey(el, url) === pair.key && el.parentNode) el.parentNode.removeChild(el);
    }
  };
  const waits = [];
  for (const key of Object.keys(kept)) {
    const old = kept[key].el;
    const url = kept[key].url;
    if (!old.parentNode) continue;
    url.searchParams.set('__webjs_dev', String(stamp()));
    const next = /** @type {Element} */ (old.cloneNode(false));
    next.setAttribute('href', url.pathname + url.search);
    const pair = { key, old, next, state: 'pending' };
    pairs.push(pair);
    waits.push(new Promise(function (resolve) {
      next.addEventListener('load', function () {
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
    if (attrs[a].name === 'href') continue;
    parts.push([attrs[a].name, attrs[a].value]);
  }
  parts.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return JSON.stringify([url.pathname, parts]);
}
