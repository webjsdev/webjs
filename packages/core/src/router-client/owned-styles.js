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
 * that owns it is REPLACED, never because the incoming head lacks it: a
 * reduced `X-Webjs-Have` response omits what the client already has, and
 * reading that absence as "no longer needed" is what left the page unstyled
 * there. Everything inside a replaced range was re-rendered by the server, so
 * the incoming head carries every owned sheet that range still needs. A sheet
 * with no owner (the root layout's, or one an app writes into its head) is
 * never touched.
 */
import { PRELOAD_ATTR } from './stylesheets.js';

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
  if (el.tagName !== 'LINK' || !el.getAttribute('href')) return false;
  const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\s+/);
  return rel.includes('stylesheet') && !rel.includes('alternate');
}

/**
 * The identity of a stylesheet link: its resolved URL with the dev refresh's
 * cache-buster stripped, so a sheet the dev refresh re-requested still matches
 * the bare href the next response carries.
 * @param {Element} el
 * @param {string} [base]
 * @returns {string | null}
 */
export function stylesheetKey(el, base) {
  const href = el.getAttribute('href');
  if (!href) return null;
  try {
    const url = new URL(href, base || document.baseURI);
    url.searchParams.delete(DEV_REFRESH_PARAM);
    return url.href;
  } catch {
    return null;
  }
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

/** @param {HTMLLinkElement} link @param {boolean} off */
function setOff(link, off) {
  if (off) link.setAttribute(OFF_ATTR, '');
  else link.removeAttribute(OFF_ATTR);
  if (link.sheet) link.sheet.disabled = off;
}

/**
 * The live stylesheet links in `<head>` other than the router's temporary
 * copies, keyed by `stylesheetKey`.
 * @returns {Map<string, HTMLLinkElement>}
 */
function liveStylesheets() {
  /** @type {Map<string, HTMLLinkElement>} */
  const out = new Map();
  for (const el of document.head.querySelectorAll('link[href]')) {
    if (el.hasAttribute(PRELOAD_ATTR) || !isStylesheetLink(el)) continue;
    const key = stylesheetKey(el);
    if (key && !out.has(key)) out.set(key, /** @type {HTMLLinkElement} */ (el));
  }
  return out;
}

/**
 * Merge one incoming head stylesheet into the live head. Returns true when it
 * is handled here, so the caller does not append it.
 *
 * - The live head already links the file: no second copy (two links to one
 *   URL are two active sheets). An owned one that was off is switched back on,
 *   and takes the incoming owner.
 * - The incoming link is one a snapshot recorded as off: nothing to do, since
 *   that page did not use it.
 * - An incoming OWNED sheet the head lacks is inserted root to leaf: after the
 *   last owned sheet of its own boundary or an enclosing one, else before the
 *   first owned sheet, else at the end. That is the order a full load puts
 *   them in, so the cascade does not change with how the page was reached.
 * - Anything else is left to the caller's append.
 *
 * @param {Element} incoming  A `<link rel="stylesheet">` from the parsed page.
 * @param {(el: Element) => Element} clone  Builds the node to insert.
 * @returns {boolean}
 */
export function mergeStylesheet(incoming, clone) {
  if (incoming.hasAttribute(OFF_ATTR)) return true;
  const key = stylesheetKey(incoming);
  if (!key) return false;
  const live = liveStylesheets();
  const existing = live.get(key);
  if (existing) {
    if (existing.hasAttribute(OFF_ATTR)) setOff(existing, false);
    const owner = incoming.getAttribute(OWNER_ATTR);
    if (owner && existing.hasAttribute(OWNER_ATTR)) existing.setAttribute(OWNER_ATTR, owner);
    return true;
  }
  const owner = incoming.getAttribute(OWNER_ATTR);
  if (!owner) return false;
  /** @type {HTMLLinkElement | null} */
  let after = null;
  /** @type {HTMLLinkElement | null} */
  let firstOwned = null;
  for (const el of live.values()) {
    const o = el.getAttribute(OWNER_ATTR);
    if (o === null) continue;
    if (!firstOwned) firstOwned = el;
    if (ownedWithin(owner, o)) after = el;
  }
  const node = clone(incoming);
  if (after) after.after(node);
  else if (firstOwned) firstOwned.before(node);
  else document.head.appendChild(node);
  return true;
}

/**
 * Switch off every owned stylesheet whose boundary sits at or below the
 * REPLACED `segment` and that the incoming head does not carry. Called inside
 * the swap commit of the boundary replace tier only: a morph keeps every
 * boundary, a frame response has no head, and the full-body path's head can
 * be reduced, so none of them can say a sheet is gone.
 *
 * @param {string} segment  The segment of the range being replaced.
 * @param {Element | null} incomingHead
 */
export function switchOffDepartedStylesheets(segment, incomingHead) {
  if (typeof document === 'undefined' || !document.head) return;
  const carried = new Set();
  if (incomingHead) {
    for (const el of incomingHead.querySelectorAll('link[href]')) {
      if (!isStylesheetLink(el) || el.hasAttribute(OFF_ATTR)) continue;
      const key = stylesheetKey(el);
      if (key) carried.add(key);
    }
  }
  for (const el of document.head.querySelectorAll(`link[${OWNER_ATTR}]`)) {
    if (el.hasAttribute(PRELOAD_ATTR) || el.hasAttribute(OFF_ATTR) || !isStylesheetLink(el)) continue;
    const owner = /** @type {string} */ (el.getAttribute(OWNER_ATTR));
    if (!ownedWithin(owner, segment)) continue;
    const key = stylesheetKey(el);
    if (key && carried.has(key)) continue;
    const link = /** @type {HTMLLinkElement} */ (el);
    // A sheet that never loaded has nothing to keep parsed, so it goes.
    if (!link.sheet) { link.remove(); continue; }
    setOff(link, true);
  }
}
