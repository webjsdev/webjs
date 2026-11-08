/**
 * Stylesheets owned by a layout boundary (#1669).
 *
 * The server hoists the `<link rel="stylesheet">` at the start of a nested
 * layout's or page's output into `<head>`, tagged `data-wj-style-owner` with
 * the segment of the `wj:children` range it was rendered in. This module is
 * the client half: it switches such a sheet OFF when a soft navigation
 * replaces that range and the incoming page no longer carries the file, and
 * back ON when a later page (or a back / forward restore) carries it again.
 *
 * Why OFF and not removed. Every framework the router takes cues from puts a
 * route's sheet in the head and dedupes by href, but they split on what a
 * departed route's sheet should do: Next, React Float, TanStack and SvelteKit
 * keep it, Remix and Astro remove it, and Turbo removes it only when the link
 * opts in with `data-turbo-track="dynamic"`. Keeping it costs real time here,
 * since a disjoint section's sheet can carry hundreds of `:has()` rules every
 * element insertion is checked against. Removing it would leave a back /
 * forward restore painting before the sheet reloads, because a restore applies
 * synchronously so the browser can replay the scroll offset (#1428). A
 * disabled sheet is in neither bind: the browser skips it in matching and
 * invalidation, and turning it back on is synchronous because it is already
 * parsed. The `data-wj-style-off` marker records the state in the DOM, so a
 * snapshot serializes it and a restore knows which sheets were off.
 *
 * Why it cannot reintroduce #936. A sheet is switched off ONLY when the range
 * that owns it is SWAPPED (replaced, or morphed in place), never because the
 * incoming head lacks it in general: a reduced `X-Webjs-Have` response omits
 * what the client already has, and reading that absence as "no longer needed"
 * is what left the page unstyled there. Everything inside a swapped range was
 * re-rendered by the server, so the incoming head carries every owned sheet
 * that range still needs. A sheet with no owner (the root layout's, or one an
 * app writes into its head) is never touched.
 */
import { PRELOAD_ATTR, relIsStylesheet } from './constants.js';

/** The server's tag naming a hoisted stylesheet's owner segment. */
export const OWNER_ATTR = 'data-wj-style-owner';
/** Marks an owned stylesheet the router has switched off. */
export const OFF_ATTR = 'data-wj-style-off';

/** The query the dev refresh re-requests a sheet under (`dev-styles.js`). */
const DEV_REFRESH_PARAM = '__webjs_dev';

/**
 * Is `el` a `<link>` naming a stylesheet (`rel` has `stylesheet`, not
 * `alternate`) with an href.
 * @param {Element} el
 */
export function isStylesheetLink(el) {
  return el.tagName === 'LINK' && !!el.getAttribute('href') && relIsStylesheet(el);
}

/**
 * The identity of a stylesheet link: its URL resolved against `base`, with the
 * dev refresh's cache-buster stripped (so a sheet the dev refresh re-requested
 * still matches the bare href the next response carries), plus the `media` it
 * applies under (a print copy and a screen copy of one file are two sheets).
 * The server's hoist keys sheets the same way.
 * @param {Element} el
 * @param {string} base
 * @returns {string | null}
 */
function keyFor(el, base) {
  const href = el.getAttribute('href');
  if (!href) return null;
  try {
    const url = new URL(href, base);
    url.searchParams.delete(DEV_REFRESH_PARAM);
    const media = (el.getAttribute('media') || '').trim();
    return media && media !== 'all' ? `${url.href} ${media}` : url.href;
  } catch {
    return null;
  }
}

/**
 * The key of each live link, taken against the URL the document had when the
 * router first saw it. A swap records the new history entry before it merges
 * the head, so by then `document.baseURI` is the NEW page's, and resolving a
 * live relative href against it would name a different file.
 * @type {WeakMap<Element, string>}
 */
const liveKeys = new WeakMap();

/**
 * Record the key of every live head stylesheet the router has not seen yet,
 * against the current `document.baseURI`. Called when the router enables and
 * at the start of every swap, before the history entry moves.
 */
export function primeLiveStylesheetKeys() {
  if (typeof document === 'undefined' || !document.head) return;
  for (const el of document.head.querySelectorAll('link[href]')) {
    if (liveKeys.has(el) || !isStylesheetLink(el)) continue;
    const key = keyFor(el, document.baseURI);
    if (key) liveKeys.set(el, key);
  }
}

/** @param {Element} el */
function liveKey(el) {
  let key = liveKeys.get(el);
  if (!key) {
    key = keyFor(el, document.baseURI) || '';
    if (key) liveKeys.set(el, key);
  }
  return key || null;
}

/**
 * Does the boundary `owner` sit at or below `segment`. Segments are nested
 * path prefixes, the rule `planBoundarySwap` uses.
 * @param {string} owner
 * @param {string} segment
 */
function ownedWithin(owner, segment) {
  return owner === segment || owner.startsWith(segment === '/' ? '/' : segment + '/');
}

/**
 * Switch a link off or on. A sheet still loading has no `sheet` yet. It is
 * neither removed (a back / forward restore would then paint before a reload)
 * nor left to apply: a stylesheet takes effect when it loads, a rendering
 * frame can fall before its `load` task, and the departed section's rules
 * would paint for that frame. So it loads under a media query that matches
 * nothing, the standard way to fetch a sheet without applying it (a
 * `disabled` link is never fetched at all), and on load it is disabled if it
 * is still marked off, then given its own media back.
 * @param {HTMLLinkElement} link
 * @param {boolean} off
 */
function setOff(link, off) {
  if (off) link.setAttribute(OFF_ATTR, '');
  else link.removeAttribute(OFF_ATTR);
  if (link.sheet) { link.sheet.disabled = off; return; }
  if (!off || link.getAttribute('media') === 'not all') return;
  const media = link.getAttribute('media');
  link.setAttribute('media', 'not all');
  const settle = () => {
    link.removeEventListener('load', settle);
    link.removeEventListener('error', settle);
    // Media first: Firefox and WebKit give the link a new sheet object when
    // its media changes, so disabling before would be lost.
    if (media === null) link.removeAttribute('media');
    else link.setAttribute('media', media);
    if (link.sheet && link.hasAttribute(OFF_ATTR)) link.sheet.disabled = true;
  };
  link.addEventListener('load', settle);
  link.addEventListener('error', settle);
}

/**
 * Put an owned stylesheet link where a full load would have it: after the
 * last live owned sheet of its own boundary or an enclosing one, else before
 * the first owned sheet, else at the end of the head. Root to leaf, so the
 * cascade does not depend on how the page was reached. The router's
 * temporary copies are placed the same way, which is what lets the head
 * merge adopt a copy as the real link without moving it.
 * @param {Element} node
 * @param {string} owner
 */
export function placeOwnedLink(node, owner) {
  /** @type {Element | null} */
  let after = null;
  /** @type {Element | null} */
  let firstOwned = null;
  for (const el of document.head.querySelectorAll(`link[${OWNER_ATTR}]`)) {
    // The router's temporary copies count too (they carry their owner), so
    // two sheets one navigation brings keep their relative order.
    if (el === node || !isStylesheetLink(el)) continue;
    if (!firstOwned) firstOwned = el;
    if (ownedWithin(owner, /** @type {string} */ (el.getAttribute(OWNER_ATTR)))) after = el;
  }
  if (after) after.after(node);
  else if (firstOwned) firstOwned.before(node);
  else document.head.appendChild(node);
}

/**
 * Start merging one incoming head's stylesheets into the live head. Returns a
 * `merge(el, clone)` that answers true when it handled `el`, so the caller
 * does not append it. The live head is read once, here, and kept current as
 * the merge inserts.
 *
 * For each incoming stylesheet:
 * - The live head already links the file: no second copy (two links to one
 *   URL are two active sheets). An owned one that was off is switched back
 *   on. Its owner is the outermost boundary still on screen that links it: a
 *   sheet a layout and a page under it both link stays the layout's while the
 *   layout is held (a reduced response re-rendered only the page), and is
 *   handed to the incoming owner once the old one is gone (the swap replaces
 *   it, or the sheet was off), so a later swap of the new owner's range can
 *   retire it.
 * - The incoming link is one a snapshot recorded as off: nothing to do, since
 *   that page did not use it.
 * - An incoming OWNED sheet the head lacks is inserted root to leaf: after the
 *   last owned sheet of its own boundary or an enclosing one, else before the
 *   first owned sheet, else at the end. That is the order a full load puts
 *   them in, so the cascade does not change with how the page was reached.
 * - Anything else is left to the caller's append.
 *
 * In `frame` mode (a frame swap whose response turned out to be a whole
 * page) nothing owned is switched on, re-owned, or inserted: the page around
 * the frame decides which sheets apply, and a frame swap never switches one
 * off either.
 *
 * @param {{ base?: string | null, frame?: boolean, segment?: string | null }} [opts]
 *   `base` is the URL the incoming document came from, which its relative
 *   hrefs resolve against; `segment` is the range this swap replaces (`/` for
 *   a full-body swap), whose owners are on their way out.
 * @returns {(el: Element, clone: (el: Element) => Element) => boolean}
 */
export function stylesheetMerge(opts = {}) {
  const base = opts.base || (typeof document !== 'undefined' ? document.baseURI : '');
  /** @type {Map<string, HTMLLinkElement>} */
  const live = new Map();
  /** The router's load-before-swap copies (stylesheets.js), by key. */
  /** @type {Map<string, HTMLLinkElement>} */
  const copies = new Map();
  for (const el of document.head.querySelectorAll('link[href]')) {
    if (!isStylesheetLink(el)) continue;
    const key = liveKey(el);
    if (!key) continue;
    const into = el.hasAttribute(PRELOAD_ATTR) ? copies : live;
    if (!into.has(key)) into.set(key, /** @type {HTMLLinkElement} */ (el));
  }
  return (incoming, clone) => {
    // A link a snapshot recorded as off, or one of the router's temporary
    // load-before-swap copies a snapshot captured mid-navigation: neither is
    // a sheet that page used, so neither is appended or switched on.
    if (incoming.hasAttribute(OFF_ATTR) || incoming.hasAttribute(PRELOAD_ATTR)) return true;
    const key = keyFor(incoming, base);
    if (!key) return false;
    const owner = incoming.getAttribute(OWNER_ATTR);
    const existing = live.get(key);
    if (existing) {
      if (opts.frame) return true;
      const wasOff = existing.hasAttribute(OFF_ATTR);
      if (wasOff) setOff(existing, false);
      const held = existing.getAttribute(OWNER_ATTR);
      if (owner && held !== null && held !== owner) {
        // The owner is the outermost boundary still on screen that links the
        // file. The held owner stays only while it is on screen and encloses
        // the incoming one: a layout this response did not re-render. A held
        // owner the swap replaces, one whose sheet was off, or one inside the
        // incoming owner gives way.
        const heldStays = !wasOff
          && !(opts.segment != null && ownedWithin(held, opts.segment))
          && ownedWithin(owner, held);
        if (!heldStays) existing.setAttribute(OWNER_ATTR, owner);
      }
      return true;
    }
    // The sheet is already loading through the router's temporary copy
    // (stylesheets.js), which sits where this link belongs: adopt it as the
    // page's own link rather than adding a second link to the same file.
    const copy = opts.frame ? null : copies.get(key);
    if (copy) {
      for (const attr of incoming.attributes) {
        if (attr.name !== 'href' && attr.name !== 'nonce') copy.setAttribute(attr.name, attr.value);
      }
      copy.removeAttribute(PRELOAD_ATTR);
      copies.delete(key);
      live.set(key, copy);
      return true;
    }
    if (!owner) return false;
    if (opts.frame) return true;
    const node = /** @type {HTMLLinkElement} */ (clone(incoming));
    // Absolute, so the inserted link names the file the response meant
    // whatever the document's URL is when it is next read.
    try { node.setAttribute('href', new URL(/** @type {string} */ (incoming.getAttribute('href')), base).href); } catch { /* keep as authored */ }
    placeOwnedLink(node, owner);
    liveKeys.set(node, key);
    live.set(key, node);
    return true;
  };
}

/**
 * Switch off every owned stylesheet whose boundary sits at or below the
 * swapped `segment` and that the incoming head does not carry. Called inside
 * the swap commit of the boundary tiers, a replace or a morph: the server
 * re-rendered everything inside that range, so the incoming head carries every
 * owned sheet the range still uses. Never from a frame swap, which has no
 * head of its own, nor from the full-body path, whose head can be a reduced
 * one that omits what the client already has (#936).
 *
 * @param {string} segment  The segment of the range being swapped.
 * @param {Element | null} incomingHead
 * @param {string | null} [base]  The URL the incoming document came from.
 */
export function switchOffDepartedStylesheets(segment, incomingHead, base) {
  if (typeof document === 'undefined' || !document.head) return;
  const from = base || document.baseURI;
  const carried = new Set();
  if (incomingHead) {
    for (const el of incomingHead.querySelectorAll('link[href]')) {
      // A snapshot taken mid-navigation can hold the router's temporary copy
      // of the NEXT page's sheet; it does not mean the page used it.
      if (!isStylesheetLink(el) || el.hasAttribute(OFF_ATTR) || el.hasAttribute(PRELOAD_ATTR)) continue;
      const key = keyFor(el, from);
      if (key) carried.add(key);
    }
  }
  for (const el of document.head.querySelectorAll(`link[${OWNER_ATTR}]`)) {
    if (el.hasAttribute(PRELOAD_ATTR) || el.hasAttribute(OFF_ATTR) || !isStylesheetLink(el)) continue;
    const owner = /** @type {string} */ (el.getAttribute(OWNER_ATTR));
    if (!ownedWithin(owner, segment)) continue;
    const key = liveKey(el);
    if (key && carried.has(key)) continue;
    setOff(/** @type {HTMLLinkElement} */ (el), true);
  }
}
