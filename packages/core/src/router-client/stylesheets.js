// @ts-check
/**
 * Stylesheets a navigation brings with it are loaded BEFORE the swap (#1666).
 *
 * A soft navigation parses the response and applies it in the same task, so a
 * `<link rel="stylesheet">` the incoming page carries starts loading only once
 * it is in the live document, and the new content paints for a frame or more
 * without it: a flash of the page in the wrong styles. Turbo Drive closes the
 * same gap by appending each new head stylesheet and awaiting its `load`
 * before it renders, Remix v2 preloads a route's links and awaits them before
 * it commits the transition, and the Next.js app router holds a commit until
 * new route CSS has loaded.
 *
 * WebJs reads the BODY as well as the head, because a section's stylesheet can
 * only ride the body on a soft navigation: only the root layout may write
 * `<head>`, and the `X-Webjs-Have` short-circuit never re-renders it, so a
 * nested layout or a page that needs a stylesheet emits its link inline. On a
 * frame navigation only the frame's own subtree is read, since nothing else in
 * the response is swapped in.
 *
 * The router adds no stylesheet state of its own; it only bridges the load
 * gap, Remix's preload-then-render shape. Each stylesheet the live document
 * does not already link gets a TEMPORARY copy in `<head>`, marked
 * `data-webjs-preload-style`, and the swap waits for it. Once the swap has
 * committed, `releaseIncomingStylesheets` removes each copy as soon as the
 * page's own link to the same file has loaded (from the HTTP cache by then),
 * so some copy of the sheet applies on every frame and none outlives it. A
 * copy whose file the swapped-in page does not link is removed at once, and
 * so is every copy of a navigation that was superseded or discarded. A sheet
 * that fails or stalls never holds a navigation hostage: an `error` resolves
 * the wait, and so does a timeout, Turbo's 2 seconds.
 */
import { PRELOAD_ATTR, relIsStylesheet } from './constants.js';
import { HELD_MEDIA_ATTR, OWNER_ATTR, holdMedia, placeOwnedLink } from './owned-styles.js';
import { getCspNonce } from './head-merge.js';

/** How long a navigation waits for one stylesheet before it swaps anyway. */
export const STYLESHEET_TIMEOUT_MS = 2000;

/** The attribute that marks the router's temporary copies (defined in the leaf). */
export { PRELOAD_ATTR };

/**
 * Is `el` a stylesheet that applies now: a `<link>` whose `rel` names
 * `stylesheet` but not `alternate` (an alternate sheet is off until chosen),
 * that is not `disabled`, has an `href`, and has no `media` query that does
 * not match.
 * @param {Element} el
 */
function isActiveStylesheet(el) {
  if (!relIsStylesheet(el)) return false;
  if (el.hasAttribute('disabled') || !el.getAttribute('href')) return false;
  // A held link (owned-styles.js) applies under its author's media once released.
  const media = el.hasAttribute(HELD_MEDIA_ATTR) ? el.getAttribute(HELD_MEDIA_ATTR) : el.getAttribute('media');
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
 * @typedef {{ ready: Promise<void>, copies: HTMLLinkElement[] }} IncomingStylesheets
 */

/**
 * Start loading every stylesheet the incoming page links that the live
 * document does not, through a temporary copy in `<head>`. Returns `null` when
 * there is nothing new, so the caller swaps in the same task as before and a
 * navigation that brings no stylesheet costs no extra time. Otherwise returns
 * the copies and a promise that settles when all of them have loaded, failed
 * or timed out; pass the result to `releaseIncomingStylesheets` once the swap
 * has committed, or once the navigation is abandoned.
 *
 * @param {Document} doc  The parsed incoming page.
 * @param {string | null | undefined} baseUrl  The URL `doc` was fetched from,
 *   which a relative `href` in it resolves against.
 * @param {string | null} [frameId]  On a frame navigation, the frame being
 *   swapped: only its subtree in `doc` is read.
 * @param {number} [timeout]
 * @returns {IncomingStylesheets | null}
 */
export function loadIncomingStylesheets(doc, baseUrl, frameId, timeout = STYLESHEET_TIMEOUT_MS) {
  if (typeof document === 'undefined' || !doc || !document.head) return null;
  /** @type {ParentNode | null} */
  let scope = doc;
  if (frameId) {
    try { scope = doc.querySelector(`webjs-frame#${CSS.escape(frameId)}`); } catch { scope = null; }
  }
  if (!scope) return null;
  const base = baseUrl || document.baseURI;
  /** @param {string} href */
  const resolve = (href) => {
    try { return new URL(href, base).href; } catch { return null; }
  };
  // What the page already links. Another navigation's temporary copies do
  // not count: they are released on that navigation's own schedule.
  const live = new Set();
  for (const el of document.querySelectorAll('link[href]')) {
    if (el.hasAttribute(PRELOAD_ATTR) || !isActiveStylesheet(el)) continue;
    const href = /** @type {HTMLLinkElement} */ (el).href;
    if (href) live.add(href);
  }
  const nonce = getCspNonce();
  /** @type {HTMLLinkElement[]} */
  const copies = [];
  /** @type {Promise<void>[]} */
  const waits = [];
  for (const el of scope.querySelectorAll('link[href]')) {
    if (!isActiveStylesheet(el)) continue;
    const href = resolve(/** @type {string} */ (el.getAttribute('href')));
    if (!href || live.has(href)) continue;
    live.add(href);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(PRELOAD_ATTR, '');
    // The attributes that change how the file is fetched and applied travel
    // with it, so the copy loads exactly what the page asked for. The nonce is
    // the LIVE page's: the browser checks CSP against the nonce of the original
    // page load, never a later response's (#1050).
    for (const name of ['media', 'crossorigin', 'integrity', 'referrerpolicy']) {
      const value = el.getAttribute(name);
      if (value) link.setAttribute(name, value);
    }
    if (nonce) link.setAttribute('nonce', nonce);
    link.href = href;
    // Loaded without applying: the outgoing page, and a view transition's
    // capture of it, must not paint with the incoming CSS. The swap commit
    // releases it (owned-styles.js `releaseIncomingSheets`).
    holdMedia(link);
    copies.push(link);
    waits.push(waitForLoad(link, timeout));
    // A sheet a layout owns (#1669) goes where the page's own link belongs,
    // so the head merge can adopt this copy as that link instead of adding a
    // second one; any other copy goes at the end of the head.
    const owner = el.getAttribute(OWNER_ATTR);
    if (owner) {
      link.setAttribute(OWNER_ATTR, owner);
      placeOwnedLink(link, owner);
    } else {
      document.head.appendChild(link);
    }
  }
  if (!copies.length) return null;
  return { ready: Promise.all(waits).then(() => undefined), copies };
}

/**
 * Remove the temporary copies `loadIncomingStylesheets` made. Each one stays
 * until the live document's own link to the same file has loaded (or failed,
 * or the timeout passes), so the sheet applies on every frame of the handoff;
 * a copy with no such link (a discarded response, a frame swap that did not
 * bring the file, a superseded navigation) goes at once.
 *
 * @param {IncomingStylesheets | null} incoming
 * @param {number} [timeout]
 */
export function releaseIncomingStylesheets(incoming, timeout = STYLESHEET_TIMEOUT_MS) {
  if (!incoming || typeof document === 'undefined') return;
  for (const copy of incoming.copies) {
    // Gone already, or adopted by the head merge as the page's own link.
    if (!copy.isConnected || !copy.hasAttribute(PRELOAD_ATTR)) continue;
    /** @type {HTMLLinkElement | null} */
    let twin = null;
    for (const el of document.querySelectorAll('link[href]')) {
      if (el === copy || el.hasAttribute(PRELOAD_ATTR) || !isActiveStylesheet(el)) continue;
      if (/** @type {HTMLLinkElement} */ (el).href === copy.href) { twin = /** @type {HTMLLinkElement} */ (el); break; }
    }
    if (!twin || twin.sheet) { copy.remove(); continue; }
    waitForLoad(twin, timeout).then(() => copy.remove());
  }
}
