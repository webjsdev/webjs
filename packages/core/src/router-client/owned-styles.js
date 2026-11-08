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
import { segmentWithin } from './boundaries.js';
import { PRELOAD_ATTR, relIsStylesheet } from './constants.js';

/** The server's tag naming a hoisted stylesheet's owner segment. */
export const OWNER_ATTR = 'data-wj-style-owner';
/** Marks an owned stylesheet the router has switched off. */
export const OFF_ATTR = 'data-wj-style-off';
/**
 * Marks a link loading under `media="not all"` so it is fetched without
 * applying, and holds the author's own media (empty for none) until it is
 * released. The dev refresh (`dev-styles.js`) reads the same attribute.
 */
export const HELD_MEDIA_ATTR = 'data-wj-style-media';

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
 * The media a link applies under: the author's, also while the link is held
 * under `not all`.
 * @param {Element} el
 */
function authoredMedia(el) {
  return ((el.hasAttribute(HELD_MEDIA_ATTR) ? el.getAttribute(HELD_MEDIA_ATTR) : el.getAttribute('media')) || '').trim();
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
    const media = authoredMedia(el);
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
 * Record the key of every live stylesheet the router has not seen yet,
 * against the current `document.baseURI`. Called when the router enables and
 * at the start of every swap, before the history entry moves.
 */
export function primeLiveStylesheetKeys() {
  if (typeof document === 'undefined' || !document.head) return;
  for (const el of document.querySelectorAll('link[href]')) {
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
 * Hold a link under `media="not all"`: it is fetched but does not apply, the
 * standard way to load a stylesheet without applying it (a `disabled` link is
 * never fetched at all). The author's media is kept in `HELD_MEDIA_ATTR`.
 * @param {Element} link
 */
export function holdMedia(link) {
  if (link.hasAttribute(HELD_MEDIA_ATTR)) return;
  link.setAttribute(HELD_MEDIA_ATTR, link.getAttribute('media') || '');
  link.setAttribute('media', 'not all');
}

/**
 * Give a held link its own media back. Firefox and WebKit give the link a new
 * sheet object when its media changes, so a caller that disables the sheet
 * does it after this.
 * @param {Element} link
 */
export function releaseMedia(link) {
  if (!link.hasAttribute(HELD_MEDIA_ATTR)) return;
  const media = link.getAttribute(HELD_MEDIA_ATTR);
  link.removeAttribute(HELD_MEDIA_ATTR);
  if (media) link.setAttribute('media', media);
  else link.removeAttribute('media');
}

/** Links with a settle listener pending, so one is never added twice. */
const settling = new WeakSet();

/**
 * Switch a link off or on.
 *
 * A sheet still loading has no `sheet` yet. It is neither removed (a back /
 * forward restore would then paint before a reload) nor left to apply: a
 * stylesheet takes effect when it loads, a rendering frame can fall before
 * its `load` task, and the departed section's rules would paint for that
 * frame. So it is held (`holdMedia`) and, when it loads, released and then
 * disabled if it is still marked off. Switching it back on releases it at
 * once, so a link that already failed to load never keeps `not all`.
 * @param {HTMLLinkElement} link
 * @param {boolean} off
 */
function setOff(link, off) {
  if (off) link.setAttribute(OFF_ATTR, '');
  else link.removeAttribute(OFF_ATTR);
  if (!off) {
    releaseMedia(link);
    if (link.sheet) link.sheet.disabled = false;
    return;
  }
  if (link.sheet) { link.sheet.disabled = true; return; }
  holdMedia(link);
  if (settling.has(link)) return;
  settling.add(link);
  const settle = () => {
    link.removeEventListener('load', settle);
    link.removeEventListener('error', settle);
    settling.delete(link);
    if (!link.hasAttribute(OFF_ATTR)) return;
    releaseMedia(link);
    if (link.sheet) link.sheet.disabled = true;
  };
  link.addEventListener('load', settle);
  link.addEventListener('error', settle);
}

/**
 * Put an owned stylesheet link where a full load would have it: after the
 * last owned sheet of its own boundary or an enclosing one, else before the
 * first owned sheet, else at the end of the head. Root to leaf, so the
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
    if (segmentWithin(owner, /** @type {string} */ (el.getAttribute(OWNER_ATTR)))) after = el;
  }
  if (after) after.after(node);
  else if (firstOwned) firstOwned.before(node);
  else document.head.appendChild(node);
}

/**
 * Start merging one incoming head's stylesheets into the live document.
 * Returns a `merge(el, clone)` that answers true when it handled `el`, so the
 * caller does not append it. The live links are read once, here, and kept
 * current as the merge inserts. Called inside the swap commit, so whatever it
 * switches on or adds takes effect with the swap and not before it.
 *
 * For each incoming stylesheet:
 * - The live document already links the file, in its head or in a part of
 *   its body this swap keeps (`leaving` says which elements are on their way
 *   out): no second copy, since two links to one URL are two active sheets.
 *   An owned one that was off is switched back on. Its owner is the outermost
 *   boundary still on screen that links it: a sheet a layout and a page under
 *   it both link stays the layout's while the layout is held (a reduced
 *   response re-rendered only the page), and is handed to the incoming owner
 *   once the old one is gone (the swap replaces it, or the sheet was off), so
 *   a later swap of the new owner's range can retire it.
 * - The incoming link is one a snapshot recorded as off, or one of the
 *   router's temporary copies a snapshot captured: nothing to do.
 * - The router's temporary copy of the file is loading (stylesheets.js): it
 *   is adopted as the page's own link, where it already sits.
 * - An incoming OWNED sheet with neither is inserted root to leaf
 *   (`placeOwnedLink`), the order a full load puts them in.
 * - Anything else is left to the caller's append.
 *
 * In `frame` mode (a frame swap whose response turned out to be a whole
 * page) nothing owned is switched on, re-owned, adopted or inserted: the page
 * around the frame decides which sheets apply, and a frame swap never
 * switches one off either.
 *
 * @param {{ base?: string | null, frame?: boolean, segment?: string | null, leaving?: (el: Element) => boolean }} [opts]
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
  for (const el of document.querySelectorAll('link[href]')) {
    if (!isStylesheetLink(el)) continue;
    const inHead = el.parentNode === document.head;
    if (!inHead && opts.leaving && opts.leaving(el)) continue;
    const key = liveKey(el);
    if (!key) continue;
    const into = el.hasAttribute(PRELOAD_ATTR) ? (inHead ? copies : null) : live;
    if (into && !into.has(key)) into.set(key, /** @type {HTMLLinkElement} */ (el));
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
        // The held owner stays only while it is on screen and encloses the
        // incoming one: a layout this response did not re-render. A held
        // owner the swap replaces, one whose sheet was off, or one inside the
        // incoming owner gives way.
        const heldStays = !wasOff
          && !(opts.segment != null && segmentWithin(held, opts.segment))
          && segmentWithin(owner, held);
        if (!heldStays) existing.setAttribute(OWNER_ATTR, owner);
      }
      return true;
    }
    const copy = opts.frame ? null : copies.get(key);
    if (copy) {
      for (const attr of incoming.attributes) {
        if (attr.name === 'href' || attr.name === 'nonce') continue;
        // The copy is still held: its media goes into the held slot, and is
        // put back when the commit releases the incoming sheets.
        if (attr.name === 'media' && copy.hasAttribute(HELD_MEDIA_ATTR)) copy.setAttribute(HELD_MEDIA_ATTR, attr.value);
        else copy.setAttribute(attr.name, attr.value);
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
 * Let the incoming page's sheets apply: release every held link that is not
 * switched off, meaning the router's load-before-swap copies (stylesheets.js)
 * and the ones the merge adopted. Called inside the swap commit, so the
 * outgoing page, and a view transition's capture of it, never paint with the
 * incoming page's CSS.
 */
export function releaseIncomingSheets() {
  if (typeof document === 'undefined' || !document.head) return;
  for (const el of document.head.querySelectorAll(`link[${HELD_MEDIA_ATTR}]`)) {
    if (!el.hasAttribute(OFF_ATTR)) releaseMedia(el);
  }
}

/**
 * Switch off every owned stylesheet whose boundary sits at or below the
 * swapped `segment` and that the incoming page does not link, in its head or
 * its body. Called inside the swap commit of the boundary tiers, a replace or
 * a morph (the server re-rendered everything inside that range, so the
 * incoming page carries every owned sheet the range still uses), and of a
 * full-body swap whose response is known to be complete. Never from a frame
 * swap, nor from a full-body swap whose head can be a reduced one that omits
 * what the client already has (#936).
 *
 * @param {string} segment  The segment of the range being swapped.
 * @param {ParentNode | null} incoming  The incoming document (head and body).
 * @param {string | null} [base]  The URL the incoming document came from.
 */
export function switchOffDepartedStylesheets(segment, incoming, base) {
  if (typeof document === 'undefined' || !document.head) return;
  const from = base || document.baseURI;
  const carried = new Set();
  if (incoming) {
    for (const el of incoming.querySelectorAll('link[href]')) {
      // A snapshot taken mid-navigation can hold the router's temporary copy
      // of the NEXT page's sheet; it does not mean the page used it.
      if (!isStylesheetLink(el) || el.hasAttribute(OFF_ATTR) || el.hasAttribute(PRELOAD_ATTR)) continue;
      const key = keyFor(el, from);
      if (key) carried.add(key);
    }
  }
  for (const el of document.head.querySelectorAll(`link[${OWNER_ATTR}]`)) {
    if (el.hasAttribute(PRELOAD_ATTR) || el.hasAttribute(OFF_ATTR) || el.hasAttribute('disabled') || !isStylesheetLink(el)) continue;
    const owner = /** @type {string} */ (el.getAttribute(OWNER_ATTR));
    if (!segmentWithin(owner, segment)) continue;
    const key = liveKey(el);
    if (key && carried.has(key)) continue;
    setOff(/** @type {HTMLLinkElement} */ (el), true);
  }
}
