// @ts-check
/**
 * Stylesheets a navigation brings with it are loaded BEFORE the swap (#1666).
 *
 * A soft navigation parses the response and applies it in the same task, so a
 * `<link rel="stylesheet">` the incoming page carries starts loading only once
 * it is in the live document, and the new content paints for a frame or more
 * without it: a flash of the page in the wrong styles. Turbo Drive closes the
 * same gap by appending each new head stylesheet and awaiting its `load`
 * before it renders (`PageRenderer.copyNewHeadStylesheetElements`), Remix
 * awaits a route's links before the transition commits, and the Next.js app
 * router preloads route CSS before it commits.
 *
 * WebJs reads the BODY as well as the head, because a section's stylesheet can
 * only ride the body on a soft navigation: only the root layout may write
 * `<head>`, and the `X-Webjs-Have` short-circuit never re-renders it, so a
 * nested layout or a page that needs a stylesheet emits its link inline.
 *
 * Each stylesheet the live document does not already link (compared by the
 * resolved URL) gets a copy appended to `<head>`, which the head merge never
 * removes (#936), so a later visit finds it there and waits for nothing. The
 * copy in the incoming markup then lands on a cached file. A stylesheet that
 * fails or stalls never holds a navigation hostage: an `error` resolves the
 * wait, and so does a timeout, Turbo's 2 seconds.
 */

/** How long a navigation waits for one stylesheet before it swaps anyway. */
export const STYLESHEET_TIMEOUT_MS = 2000;

/**
 * Is `el` a stylesheet that applies now: a `<link>` whose `rel` names
 * `stylesheet` but not `alternate` (an alternate sheet is disabled until
 * chosen), with an `href`, and with no `media` query that does not match.
 * @param {Element} el
 */
function isActiveStylesheet(el) {
  const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\s+/);
  if (!rel.includes('stylesheet') || rel.includes('alternate')) return false;
  if (!el.getAttribute('href')) return false;
  const media = el.getAttribute('media');
  if (media && typeof matchMedia === 'function') {
    try { if (!matchMedia(media).matches) return false; } catch { /* an unparseable query applies to nothing */ return false; }
  }
  return true;
}

/**
 * Resolve when `link` has loaded or failed, or after `timeout` ms.
 * @param {HTMLLinkElement} link
 * @param {number} timeout
 * @returns {Promise<void>}
 */
function waitForLoad(link, timeout) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      link.removeEventListener('load', done);
      link.removeEventListener('error', done);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    link.addEventListener('load', done);
    link.addEventListener('error', done);
  });
}

/**
 * Start loading every stylesheet `doc` links that the live document does not,
 * and return a promise that settles when all of them have loaded, failed or
 * timed out. Returns `null` when there is nothing new, so the caller swaps in
 * the same task as before and a navigation that brings no stylesheet costs no
 * extra time.
 *
 * @param {Document} doc  The parsed incoming page.
 * @param {string | null | undefined} baseUrl  The URL `doc` was fetched from,
 *   which a relative `href` in it resolves against.
 * @param {number} [timeout]
 * @returns {Promise<void> | null}
 */
export function loadIncomingStylesheets(doc, baseUrl, timeout = STYLESHEET_TIMEOUT_MS) {
  if (typeof document === 'undefined' || !doc || !document.head) return null;
  const base = baseUrl || document.baseURI;
  /** @param {string} href */
  const resolve = (href) => {
    try { return new URL(href, base).href; } catch { return null; }
  };
  const live = new Set();
  for (const el of document.querySelectorAll('link[href]')) {
    if (!isActiveStylesheet(el)) continue;
    const href = /** @type {HTMLLinkElement} */ (el).href;
    if (href) live.add(href);
  }
  /** @type {Promise<void>[]} */
  const waits = [];
  for (const el of doc.querySelectorAll('link[href]')) {
    if (!isActiveStylesheet(el)) continue;
    const href = resolve(/** @type {string} */ (el.getAttribute('href')));
    if (!href || live.has(href)) continue;
    live.add(href);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // The attributes that change whether or how the file is fetched and
    // applied travel with it, so the copy loads exactly what the page asked
    // for (a nonce under a strict style-src, an integrity hash, CORS mode).
    for (const name of ['media', 'crossorigin', 'integrity', 'referrerpolicy', 'nonce']) {
      const value = name === 'nonce'
        ? (/** @type {HTMLElement} */ (el).nonce || el.getAttribute('nonce'))
        : el.getAttribute(name);
      if (value) link.setAttribute(name, value);
    }
    link.href = href;
    waits.push(waitForLoad(link, timeout));
    document.head.appendChild(link);
  }
  if (!waits.length) return null;
  return Promise.all(waits).then(() => undefined);
}
