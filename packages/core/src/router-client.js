// Importing this side-effect-registers <webjs-frame> so apps that
// `import '@webjskit/core/client-router'` get the escape-hatch element
// available without a second import.
import './webjs-frame.js';

/**
 * Client router for webjs — nested-layout-aware partial swap.
 *
 * Intercepts same-origin link clicks and form submissions, fetches the
 * target page's HTML via `fetch()`, finds the deepest layout boundary
 * shared by both the current and incoming pages, and replaces ONLY the
 * children of that boundary. Outer layout DOM (header, sidenav, footer)
 * stays mounted — no re-render, no flicker, scroll positions preserved.
 *
 * To enable, import this module from a layout or boot script:
 *
 *   import '@webjskit/core/client-router';
 *
 * Or call `enableClientRouter()` for programmatic control.
 *
 * Mechanism — auto-derived from folder structure:
 *   1. SSR injects `<!--wj:children:<segment-path>-->...<!--/wj:children-->`
 *      comment markers around each layout's `${children}` interpolation
 *      (one pair per layout in the chain).
 *   2. On link click, walk both the live DOM and the incoming HTML for
 *      these markers and build path → range maps.
 *   3. Find the longest shared marker path. That's the deepest layout
 *      both pages have in common.
 *   4. Replace nodes between that marker pair in the live DOM with the
 *      equivalent range from the incoming HTML, using a keyed reconciler
 *      that preserves input values, scroll, popover state, and the
 *      identity of any matched DOM nodes.
 *   5. Merge head, re-run scripts, upgrade custom elements, pushState.
 *
 * Optimizations bundled into the same response cycle:
 *   - `X-Webjs-Have` request header lists the marker paths the client
 *     already has. Server walks the target's layout chain, skips
 *     layouts at-or-above the deepest match, returns only the
 *     divergent fragment (wrapped in the deepest shared marker). Real
 *     wire-byte savings — the layout chain is never re-serialized for
 *     same-shell navigations.
 *   - URL-keyed snapshot cache (Turbo SnapshotCache pattern). Back/
 *     forward via popstate restores from cache instantly, then
 *     revalidates in the background.
 *   - Per-segment loading templates: SSR emits each segment's
 *     loading.ts content as `<template id="wj-loading:<path>">`. On
 *     nav-start the client clones the deepest matching template into
 *     the swap slot so users see an instant skeleton instead of stale
 *     content.
 *
 * Escape hatch:
 *   `<webjs-frame id="...">` — declarative partial-swap region NOT
 *   tied to a folder layout. If a link's enclosing `closest('webjs-frame')`
 *   matches a frame in the incoming HTML, the frame swap takes
 *   precedence over the layout-marker mechanism. Use for ad-hoc
 *   widgets (tabs, lazy-loaded cards) where the swap region isn't a
 *   folder route segment.
 */

/**
 * Parse HTML into a Document. Prefers Document.parseHTMLUnsafe (processes
 * Declarative Shadow DOM) over DOMParser (does NOT process DSD).
 *
 * @param {string} html
 * @returns {Document | null}
 */
function parseHTML(html) {
  if (typeof Document !== 'undefined' && typeof Document.parseHTMLUnsafe === 'function') {
    return Document.parseHTMLUnsafe(html);
  }
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html');
  }
  return null;
}

let enabled = false;

/**
 * AbortController for the currently in-flight fetch. A new navigation /
 * submission `abort()`s this and replaces it — Turbo Drive's
 * `navigator.stop()` pattern. Aborting in-flight requests on rapid
 * link clicks avoids late responses clobbering newer settled state.
 *
 * @type {AbortController | null}
 */
let activeAbortController = null;

/**
 * Monotonic counter incremented at the start of every navigation. Each
 * async path captures the value at its entry point and compares before
 * applying side effects (swap, restore-optimistic). A mismatch means a
 * newer nav superseded this one — bail out silently. Belt-and-suspenders
 * on top of AbortController: covers paths where a response has already
 * resolved past the await but a newer nav started before applySwap ran.
 */
let currentNavigationToken = 0;

/**
 * Global MutationObserver that upgrades any custom element inserted into
 * the document. Safety net: if our diff / replaceChildren / View
 * Transitions ever leave an un-upgraded element behind, this catches it.
 */
let upgradeObserver = null;
function ensureUpgradeObserver() {
  if (upgradeObserver || typeof MutationObserver === 'undefined' || typeof customElements === 'undefined') return;
  upgradeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const el = /** @type {Element} */ (node);
        if (el.tagName?.includes('-')) customElements.upgrade(el);
        for (const child of el.querySelectorAll('*')) {
          if (child.tagName?.includes('-')) customElements.upgrade(child);
        }
      }
    }
  });
  upgradeObserver.observe(document.body, { childList: true, subtree: true });
}

/** Enable the client router. Idempotent. */
export function enableClientRouter() {
  if (enabled || typeof document === 'undefined') return;
  enabled = true;
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  window.addEventListener('popstate', onPopState);
  ensureUpgradeObserver();
}

/** Disable the client router. */
export function disableClientRouter() {
  if (!enabled) return;
  enabled = false;
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('submit', onSubmit, true);
  window.removeEventListener('popstate', onPopState);
}

/**
 * Programmatic navigation (replaces `location.href = url`).
 * @param {string} url
 * @param {{ replace?: boolean }} [opts]
 */
export async function navigate(url, opts) {
  const target = new URL(url, location.href);
  if (target.origin !== location.origin) {
    location.href = url;
    return;
  }
  await performNavigation(target.href, opts?.replace ?? false, null);
}

/**
 * Invalidate a cached snapshot. Call after a server action mutates data
 * that affects a cached page so the next visit refetches.
 *
 * @param {string} [url]  Specific URL to invalidate, or omit to clear all.
 */
export function revalidate(url) {
  // Falsy `url` (undefined, null, empty string) clears everything.
  // Loose `== null` would have left `revalidate('')` to silently no-op,
  // because `new URL('', location.href)` is a valid relative URL and the
  // resulting cache key rarely matches anything.
  if (!url) { snapshotCache.clear(); return; }
  const u = new URL(url, location.href);
  snapshotCache.delete(u.pathname + u.search);
}

// Auto-enable on import (standard Turbo-Drive convention).
enableClientRouter();

/* ====================================================================
 * Click + popstate handlers
 * ==================================================================== */

/**
 * Pathnames with these extensions are never HTML pages.
 */
const NON_HTML_EXTENSIONS = /\.(?:pdf|zip|tar|gz|7z|rar|dmg|exe|msi|deb|rpm|apk|ipa|xlsx?|docx?|pptx?|csv|odt|ods|odp|rtf|epub|mobi|xml|json|rss|atom|txt|md|wasm|mp3|mp4|mov|avi|webm|ogg|flac|wav|m4a|m4v|mkv|png|jpe?g|gif|webp|avif|bmp|ico|svg|tiff?|heic)$/i;

/** @param {MouseEvent} e */
function onClick(e) {
  if (!enabled) return;
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const anchor = findAnchorInPath(e);
  if (!anchor) return;
  if (anchor.hasAttribute('download')) return;
  if (anchor.hasAttribute('data-no-router')) return;
  if (anchor.target && anchor.target !== '_self') return;

  const href = anchor.href;
  if (!href) return;

  const url = new URL(href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  if (NON_HTML_EXTENSIONS.test(url.pathname)) return;

  e.preventDefault();
  // Identify the active <webjs-frame> via closest() — null if the click
  // wasn't inside any frame. The frame escape-hatch takes precedence
  // over the auto-derived layout markers when both are present.
  const frameId = activeFrameId(anchor);
  performNavigation(href, false, frameId);
}

/** @param {PopStateEvent} _e */
function onPopState(_e) {
  // popstate has no DOM anchor, so no frame context — restore via cache or
  // refetch the whole document.
  performNavigation(location.href, true, null);
}

/**
 * Intercept form submissions. Capture phase so we run before user
 * `@submit` handlers in component templates — they can call
 * `e.preventDefault()` or `e.stopImmediatePropagation()` first if they
 * want to handle the submission themselves (server-action RPC stubs do
 * this).
 *
 * Filtering mirrors Turbo's `form_submit_observer.js`:
 *   - `data-no-router` on form or submitter → full browser submit.
 *   - `formmethod="dialog"` → native <dialog> dismissal, never routed.
 *   - `target` / `formtarget` that isn't `_self` → iframe / popup target.
 *   - Cross-origin or non-HTML-extension action → let the browser handle.
 *
 * Submitter attributes (`formmethod`, `formaction`, `formenctype`) take
 * precedence over the form's own — HTML5 form-submission algorithm.
 *
 * @param {SubmitEvent} e
 */
function onSubmit(e) {
  if (!enabled) return;
  if (e.defaultPrevented) return;

  const form = /** @type {HTMLFormElement | null} */ (e.target);
  // Duck-type check rather than `instanceof HTMLFormElement` — linkedom
  // and other non-browser DOMs don't always mark form elements as
  // instances of the window's HTMLFormElement class.
  if (!form || form.nodeType !== 1 || form.tagName !== 'FORM') return;
  if (form.hasAttribute('data-no-router')) return;

  const submitter = /** @type {HTMLElement | null} */ (e.submitter ?? null);
  if (submitter && submitter.hasAttribute('data-no-router')) return;

  const target = (submitter && submitter.getAttribute('formtarget'))
    || form.getAttribute('target')
    || '';
  if (target && target !== '_self') return;

  const method = getSubmitMethod(form, submitter);
  if (method === 'dialog') return;

  const action = getSubmitAction(form, submitter);
  /** @type {URL} */ let url;
  try { url = new URL(action, location.href); }
  catch { return; }
  if (url.origin !== location.origin) return;
  if (NON_HTML_EXTENSIONS.test(url.pathname)) return;

  const body = buildSubmitFormData(form, submitter);

  e.preventDefault();
  const frameId = activeFrameId(form);
  performSubmission(url.href, method, body, frameId);
}

/**
 * Method resolution: submitter's `formmethod` wins over form's `method`.
 * Returns lowercase.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLElement | null} submitter
 */
function getSubmitMethod(form, submitter) {
  const v = (submitter && submitter.getAttribute('formmethod'))
    || form.getAttribute('method')
    || 'get';
  return v.toLowerCase();
}

/**
 * Action resolution: submitter's `formaction` wins over form's `action`.
 * Empty string is valid (means submit-to-current-url).
 *
 * @param {HTMLFormElement} form
 * @param {HTMLElement | null} submitter
 */
function getSubmitAction(form, submitter) {
  if (submitter && submitter.hasAttribute('formaction')) {
    return submitter.getAttribute('formaction') || '';
  }
  return form.getAttribute('action') || form.action || location.href;
}

/**
 * Build FormData honoring the submitter's name=value (per HTML5 form
 * submission algorithm). Modern browsers + the `FormData(form, submitter)`
 * ctor handle this automatically; older Safari needs a manual append.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLElement | null} submitter
 * @returns {FormData}
 */
function buildSubmitFormData(form, submitter) {
  try {
    return new FormData(form, /** @type any */ (submitter || undefined));
  } catch {
    const fd = new FormData(form);
    if (submitter && submitter.getAttribute('name')) {
      fd.append(
        /** @type {string} */ (submitter.getAttribute('name')),
        submitter.getAttribute('value') || '',
      );
    }
    return fd;
  }
}

/**
 * Find the nearest <a> in the event's composed path. composedPath() crosses
 * shadow DOM boundaries — essential because nav links typically live inside
 * the layout shell's shadow root.
 *
 * @param {MouseEvent} e
 * @returns {HTMLAnchorElement | null}
 */
function findAnchorInPath(e) {
  for (const el of e.composedPath()) {
    if (el instanceof HTMLAnchorElement) return el;
  }
  return null;
}

/**
 * Find the id of the innermost <webjs-frame> enclosing `el`, walking up
 * through normal DOM and any shadow boundaries it crosses. Returns null
 * if the element is not inside any frame.
 *
 * @param {Element | null} el
 * @returns {string | null}
 */
function activeFrameId(el) {
  /** @type {Element | null} */
  let cur = el;
  while (cur) {
    const frame = cur.closest('webjs-frame');
    if (frame && frame.id) return frame.id;
    // Cross shadow boundary upwards if necessary.
    const root = cur.getRootNode();
    if (root && /** @type any */ (root).host) {
      cur = /** @type any */ (root).host;
    } else {
      break;
    }
  }
  return null;
}

/* ====================================================================
 * Marker discovery (the heart of the partial-swap mechanism)
 * ==================================================================== */

/**
 * Walk a node tree collecting wj:children marker pairs into a Map
 * keyed by segment path.
 *
 * Markers are HTML comments emitted by SSR around each layout's
 * children interpolation:
 *   <!--wj:children:/docs-->
 *     <page content>
 *   <!--/wj:children-->
 *
 * The walk uses a stack to track nested marker pairs — a path can
 * appear multiple times in a document only if a layout transitively
 * includes itself (pathological; we take the outermost).
 *
 * @param {ParentNode} root
 * @returns {Map<string, { start: Comment, end: Comment }>}
 */
export function collectChildrenSlots(root) {
  /** @type {Map<string, { start: Comment, end: Comment }>} */
  const slots = new Map();
  /** @type {{ path: string, start: Comment }[]} */
  const stack = [];

  // Plain recursive comment walk — TreeWalker/NodeFilter aren't available
  // in every DOM polyfill (notably linkedom in tests). Iterative depth-
  // first traversal keeps us portable across linkedom + native + jsdom.
  /** @param {Node} node */
  function visit(node) {
    if (node.nodeType === 8 /* COMMENT_NODE */) {
      const c = /** @type {Comment} */ (node);
      const data = c.data;
      const open = /^wj:children:(.+)$/.exec(data);
      if (open) {
        stack.push({ path: open[1], start: c });
        return;
      }
      if (data.trim() === '/wj:children') {
        const frame = stack.pop();
        if (frame && !slots.has(frame.path)) {
          slots.set(frame.path, { start: frame.start, end: c });
        }
        return;
      }
      return;
    }
    if (node.hasChildNodes && node.hasChildNodes()) {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        visit(child);
      }
    }
  }
  visit(/** @type {Node} */ (root));
  return slots;
}

/**
 * Pick the longest path that exists in both maps.
 *
 * Path comparison is plain string equality (matches Next.js's
 * `matchSegment`). Longest wins so the swap is as scoped as possible.
 *
 * @param {Map<string, unknown>} here
 * @param {Map<string, unknown>} there
 * @returns {string | null}
 */
export function longestSharedPath(here, there) {
  let best = null;
  for (const p of here.keys()) {
    if (!there.has(p)) continue;
    if (best === null || p.length > best.length) best = p;
  }
  return best;
}

/* ====================================================================
 * Snapshot cache (Turbo SnapshotCache pattern)
 * ==================================================================== */

const SNAPSHOT_CAP = 16;
/** @typedef {{ html: string, scrollX: number, scrollY: number }} Snapshot */
/** @type {Map<string, Snapshot | string>} */
const snapshotCache = new Map();

/**
 * Cache the current document's HTML + window scroll position keyed by
 * URL. Used on back/forward navigation: the cached DOM restores
 * instantly, scroll position restores to whatever the user left it at.
 *
 * Turbo Drive captures `window.pageXOffset/pageYOffset` on every scroll
 * event into history state. Webjs captures lazily at snapshot time —
 * one read per nav rather than one per scroll event. Sufficient because
 * we only need the position at the moment of leaving.
 *
 * @param {string} url
 */
function snapshotCurrent(url) {
  const key = cacheKey(url);
  // Move-to-front for LRU.
  if (snapshotCache.has(key)) snapshotCache.delete(key);
  /** @type {Snapshot} */
  const snap = {
    html: document.documentElement.outerHTML,
    scrollX: typeof window !== 'undefined' ? window.scrollX || 0 : 0,
    scrollY: typeof window !== 'undefined' ? window.scrollY || 0 : 0,
  };
  snapshotCache.set(key, snap);
  while (snapshotCache.size > SNAPSHOT_CAP) {
    const oldest = snapshotCache.keys().next().value;
    snapshotCache.delete(oldest);
  }
}

/**
 * Look up a cached snapshot by URL. Returns a normalized Snapshot or
 * null. Tolerates legacy string entries (e.g. from test fixtures that
 * `_snapshotCache.set('/x', 'snap')`).
 *
 * @param {string} url
 * @returns {Snapshot | null}
 */
function snapshotGet(url) {
  const key = cacheKey(url);
  const v = snapshotCache.get(key);
  if (v == null) return null;
  // Move-to-front.
  snapshotCache.delete(key);
  snapshotCache.set(key, v);
  if (typeof v === 'string') return { html: v, scrollX: 0, scrollY: 0 };
  return v;
}

/** @param {string} url */
function cacheKey(url) {
  const u = new URL(url, location.href);
  return u.pathname + u.search;
}

/* ====================================================================
 * Navigation
 * ==================================================================== */

/**
 * @param {string} href
 * @param {boolean} isPopState
 * @param {string | null} frameId  Active <webjs-frame> id, or null.
 */
async function performNavigation(href, isPopState, frameId) {
  // Cancel any in-flight fetch — Turbo Drive's navigator.stop().
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;
  // Bump nav generation. Captured below + by anything we await into.
  const myToken = ++currentNavigationToken;

  // Snapshot the current page for cache-on-back semantics.
  snapshotCurrent(location.href);

  // Show a subtle loading indicator, but only if the nav takes long
  // enough to be worth showing one. Setting an attribute on <html>
  // invalidates global style computation — which forces CSS like
  // `color-mix(in oklch, …)` to re-resolve. For values that use
  // wide-gamut color spaces the re-resolution can switch between
  // equivalent representations (oklch ↔ oklab) and fire any
  // `transition` rules listening on that property, producing a
  // visible flash on every nav. Defer the attribute set so quick
  // navs (sub-150ms) never set it at all.
  let navigatingFlagTimer = setTimeout(() => {
    document.documentElement.setAttribute('data-navigating', '');
    navigatingFlagTimer = null;
  }, 150);

  // Optimistic loading: clone the per-segment loading.ts template (if
  // any) into the deepest current children-slot so the user sees an
  // instant skeleton instead of stale content. Saved so we can restore
  // it if the fetch fails.
  let optimisticState = null;
  if (!isPopState) optimisticState = applyOptimisticLoading();

  try {
    // popstate: try cache first, then refetch in background. Instant restore.
    if (isPopState) {
      const cached = snapshotGet(href);
      if (cached) {
        const cachedDoc = parseHTML(cached.html);
        if (cachedDoc) {
          applySwap(cachedDoc, frameId, /* revalidating */ true);
          // Restore window scroll to where the user left it.
          if (typeof window !== 'undefined') {
            window.scrollTo(cached.scrollX, cached.scrollY);
          }
          // Fire-and-forget revalidation. Uses a fresh AbortController
          // since this background fetch is allowed to overlap with the
          // next foreground nav (it'll get aborted if a new nav lands).
          fetchAndApply(href, frameId, /* recordHistory */ false, optimisticState, 'GET', null, signal, myToken)
            .catch(() => {});
          return;
        }
      }
    }

    await fetchAndApply(href, frameId, !isPopState, optimisticState, 'GET', null, signal, myToken);
  } finally {
    if (navigatingFlagTimer) clearTimeout(navigatingFlagTimer);
    // Only clear the navigating flag if WE are still the active nav.
    // A newer nav has its own flag lifecycle.
    if (myToken === currentNavigationToken) {
      document.documentElement.removeAttribute('data-navigating');
    }
  }
}

/**
 * Submit a form via the partial-swap pipeline. Mirrors performNavigation
 * but routes the FormData body. GET submissions promote the body to a
 * query string (HTML form-submission algorithm); non-GET submissions
 * send the body as-is.
 *
 * Mutating methods (anything except GET/HEAD) clear the whole snapshot
 * cache after a successful response — Turbo's `clearSnapshotCache()` on
 * `!isSafe` (`navigator.js:71-88`). Other URLs in the cache may have
 * been server-side-mutated by this submission; refusing to clear would
 * serve stale content on subsequent back/forward.
 *
 * @param {string} href     Absolute target URL.
 * @param {string} method   Lowercased HTTP verb.
 * @param {FormData} body
 * @param {string | null} frameId
 */
async function performSubmission(href, method, body, frameId) {
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;
  const myToken = ++currentNavigationToken;

  const isSafe = method === 'get' || method === 'head';
  let url = new URL(href, location.href);
  if (isSafe) {
    // Promote body to query string per the HTML5 form-submission
    // algorithm. The form's own `action` query is replaced — same as
    // a native GET-form submission.
    url.search = '';
    for (const [k, v] of body) {
      url.searchParams.append(k, typeof v === 'string' ? v : v.name);
    }
  }

  snapshotCurrent(location.href);

  let navigatingFlagTimer = setTimeout(() => {
    document.documentElement.setAttribute('data-navigating', '');
    navigatingFlagTimer = null;
  }, 150);

  const optimisticState = applyOptimisticLoading();

  try {
    await fetchAndApply(
      url.href,
      frameId,
      /* recordHistory */ true,
      optimisticState,
      isSafe ? 'GET' : method.toUpperCase(),
      isSafe ? null : body,
      signal,
      myToken,
    );
    // Mutating submissions invalidate cached versions of other URLs —
    // do this *after* the response applies so the new page itself is
    // snapshotted on the next nav, not pre-emptively wiped.
    if (!isSafe && myToken === currentNavigationToken) {
      snapshotCache.clear();
    }
  } finally {
    if (navigatingFlagTimer) clearTimeout(navigatingFlagTimer);
    if (myToken === currentNavigationToken) {
      document.documentElement.removeAttribute('data-navigating');
    }
  }
}

/**
 * Build the X-Webjs-Have header value from the live DOM's marker paths.
 * Comma-separated, in document order (no canonicalization needed; the
 * server intersects with the target's layout chain).
 *
 * @returns {string}
 */
function buildHaveHeader() {
  const slots = collectChildrenSlots(document.body);
  return [...slots.keys()].join(',');
}

/**
 * Fetch the target URL and apply the swap.
 *
 * @param {string} href
 * @param {string | null} frameId
 * @param {boolean} recordHistory
 * @param {{ slot: { start: Comment, end: Comment }, oldChildren: Node[], token: number } | null} optimisticState
 * @param {string} [method]  HTTP verb (uppercase). Default 'GET'.
 * @param {BodyInit | null} [body]  Request body for non-GET methods.
 * @param {AbortSignal | null} [signal]  Abort signal — newer nav cancels this fetch.
 * @param {number} [token]  Nav-token captured at the caller's entry; stale → skip apply.
 */
async function fetchAndApply(href, frameId, recordHistory, optimisticState, method, body, signal, token) {
  method = method || 'GET';
  const myToken = typeof token === 'number' ? token : currentNavigationToken;
  let html;
  /** @type {string} */
  let finalUrl = href;
  try {
    const headers = { 'x-webjs-router': '1' };
    const have = buildHaveHeader();
    if (have) headers['x-webjs-have'] = have;
    if (frameId) headers['x-webjs-frame'] = frameId;

    /** @type {RequestInit} */
    const init = { method, headers, credentials: 'same-origin' };
    if (signal) init.signal = signal;
    if (body != null && method !== 'GET' && method !== 'HEAD') init.body = body;

    const resp = await fetch(href, init);
    const ctype = resp.headers.get('content-type') || '';
    const isHTML = /^text\/html\b/i.test(ctype);
    // Server-side redirect (PRG, auth-gate, etc.) — fetch followed it
    // automatically. Record the FINAL URL in history, not the
    // originally-requested one, so back/forward + bookmarking work.
    if (resp.redirected && resp.url) finalUrl = resp.url;

    // Empty-body status codes (204 No Content, 205 Reset Content):
    // server-rendered "stay on current page" pattern. Don't try to
    // swap an empty document over the live one. We DO still record
    // history for the originating URL — same as a normal navigation
    // that decided to short-circuit.
    if (resp.status === 204 || resp.status === 205) {
      if (myToken === currentNavigationToken && recordHistory) {
        history.pushState(null, '', finalUrl);
      }
      return;
    }

    // Non-HTML response (JSON error, file download, opaque) — let the
    // browser handle it. Same for non-OK responses that aren't HTML
    // (a 500 returning `{"error": "..."}` shouldn't be rendered as a
    // page).
    if (!isHTML) {
      if (myToken === currentNavigationToken) location.href = href;
      return;
    }

    // HTML body of ANY status — 2xx, 4xx validation errors, 5xx error
    // pages — is parsed and applied in place. Matches Turbo Drive's
    // `formSubmissionFailedWithResponse` behavior
    // (turbo/src/core/drive/navigator.js:92-107). Critical for the
    // standard server-rendered validation pattern: 422 + re-rendered
    // form with errors keeps the user's typed input and shows context.
    html = await resp.text();
  } catch (err) {
    // Aborted by a newer navigation — let it run, don't fall back.
    if (err && /** @type any */ (err).name === 'AbortError') return;
    // Stale (a newer nav started before we got the network error) —
    // the newer nav owns the page now; don't clobber it.
    if (myToken !== currentNavigationToken) return;
    restoreOptimistic(optimisticState);
    location.href = href;
    return;
  }

  // A newer navigation started while we awaited the response body —
  // bail before we overwrite its work.
  if (myToken !== currentNavigationToken) return;

  const doc = parseHTML(html);
  if (!doc) { location.href = href; return; }

  applySwap(doc, frameId, false);

  if (recordHistory) history.pushState(null, '', finalUrl);

  // Scroll only for foreground (history-recording) navigations. When
  // `recordHistory` is false we're either:
  //   (a) the background revalidation after a cached popstate restore
  //       — performNavigation already set scroll from the cached
  //       position; we must NOT clobber it here.
  //   (b) a cache-miss popstate — modern browsers fire scroll-
  //       restoration themselves before dispatching popstate, so
  //       leaving scroll alone preserves the browser-native UX.
  if (recordHistory) {
    // Use the final URL (after any server-side redirect) so hash
    // anchors point at the document we actually rendered.
    const url = new URL(finalUrl);
    if (url.hash) {
      const t = document.getElementById(url.hash.slice(1));
      if (t) t.scrollIntoView();
      else window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }

  document.dispatchEvent(new CustomEvent('webjs:navigate', { detail: { url: finalUrl, frameId } }));
}

/**
 * Apply the swap from a parsed incoming Document onto the live document.
 * Picks the most-scoped match: explicit webjs-frame > deepest shared
 * layout marker > full body swap.
 *
 * @param {Document} doc
 * @param {string | null} frameId
 * @param {boolean} revalidating  Restore from cache — already-matched markers may stomp inflight state; signal helps loading templates skip.
 */
function applySwap(doc, frameId, revalidating) {
  // 1. webjs-frame escape hatch.
  if (frameId) {
    const target = document.querySelector(`webjs-frame#${CSS.escape(frameId)}`);
    const source = doc.querySelector(`webjs-frame#${CSS.escape(frameId)}`);
    if (target && source) {
      // ADD-ONLY head merge: preserve runtime-generated head content
      // (Tailwind CSS injection, etc.) that the outer layout's scripts
      // already produced.
      addNewHeadElements(doc.head);
      diffChildren(target, source);
      reactivateScripts(target);
      upgradeCustomElements(target);
      forwardSuspenseResolvers(doc.body);
      blurOutgoingFocus();
      return;
    }
  }

  // 2. Auto-derived layout-marker swap.
  const here = collectChildrenSlots(document.body);
  const there = collectChildrenSlots(doc.body);
  const sharedPath = longestSharedPath(here, there);

  if (sharedPath) {
    // ADD-ONLY head merge for the same reason — outer layout stays
    // mounted, its head-bound runtime state must not be invalidated.
    addNewHeadElements(doc.head);
    swapMarkerRange(here.get(sharedPath), there.get(sharedPath), doc);
    forwardSuspenseResolvers(doc.body);
    blurOutgoingFocus();
    return;
  }

  // 3. Full body swap fallback. Use full head merge — different root
  // layout, so stale head elements should be removed.
  mergeHead(doc.head);
  const newChildren = [...doc.body.childNodes];
  const doSwap = () => {
    document.body.replaceChildren(...newChildren);
    reactivateScripts(document.body);
    upgradeCustomElements(document.body);
    blurOutgoingFocus();
  };
  if (/** @type any */ (document).startViewTransition) {
    const t = /** @type any */ (document).startViewTransition(doSwap);
    t.finished.then(() => upgradeCustomElements(document.body)).catch(() => {});
  } else {
    doSwap();
  }
}

/**
 * After a swap, blur whatever element the user activated to trigger the
 * navigation (the clicked sidenav link, the submitted form button, etc.).
 *
 * Why: browsers paint `:focus-visible` rings when the window regains
 * focus on whatever has focus at that moment. A click leaves focus on
 * the clicked element, so without this blur the user sees a stuck focus
 * ring on the sidenav link every time they switch workspaces and come
 * back — even though they navigated minutes ago.
 *
 * We do NOT programmatically move focus to the new page's h1/h2.
 * That'd just relocate the same problem (focus ring on the heading
 * after a workspace switch) and steals focus from sighted users.
 * Screen-reader users navigate by heading via their own shortcuts
 * (`h` in NVDA/JAWS), so they don't need us to do it for them.
 *
 * No-op when focus is on `<body>` (browser default after `removeChild`
 * of a focused node) or when the active element survived the swap and
 * was inside the new content (means the swap was internal to a region
 * the user was already interacting with — don't fight them).
 */
function blurOutgoingFocus() {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return;
  if (typeof (/** @type any */ (a).blur) !== 'function') return;
  /** @type any */ (a).blur();
}

/**
 * Replace nodes between `target.start` and `target.end` (exclusive) in the
 * live document with the nodes between `source.start` and `source.end` in
 * the parsed Document. Uses a keyed reconciler that preserves DOM
 * identity for matched elements + their live attributes (scroll, value,
 * etc.).
 *
 * @param {{ start: Comment, end: Comment } | undefined} target
 * @param {{ start: Comment, end: Comment } | undefined} source
 * @param {Document} _doc
 */
function swapMarkerRange(target, source, _doc) {
  if (!target || !source) return;

  // Build a parent-with-matching-children pair for the keyed differ.
  // The differ wants two parents — synthesize a transient parent for
  // the slice of `source` so we can diff in-place against `target.start`
  // / `target.end` siblings on the live document.
  const liveParent = target.start.parentNode;
  if (!liveParent) return;

  // Collect current children (nodes between start and end, exclusive).
  /** @type {Node[]} */
  const liveSlice = [];
  for (let n = target.start.nextSibling; n && n !== target.end; n = n.nextSibling) {
    liveSlice.push(n);
  }

  // Collect incoming children, importing into the live document.
  /** @type {Node[]} */
  const incomingSlice = [];
  for (let n = source.start.nextSibling; n && n !== source.end; n = n.nextSibling) {
    incomingSlice.push(document.importNode(n, true));
  }

  // Run the keyed diff.
  reconcileSiblings(liveParent, target.start, target.end, liveSlice, incomingSlice);

  // Upgrade + activate scripts in the just-swapped range.
  for (let n = target.start.nextSibling; n && n !== target.end; n = n.nextSibling) {
    if (n.nodeType === 1) {
      reactivateScripts(/** @type {Element} */ (n));
      upgradeCustomElements(/** @type {Element} */ (n));
    }
  }
}

/**
 * Coarse keyed reconciliation between liveSlice and incomingSlice,
 * positioned in liveParent between `startMarker` and `endMarker`.
 *
 * Algorithm (Remix v3 inspired, pared down):
 *   - Match elements by (tagName + key) where key = data-key || id.
 *   - For each pair: diff attributes, recurse into children.
 *   - Unmatched live elements: remove.
 *   - Unmatched incoming elements: insert in the right slot.
 *   - Live attributes (value, checked, open, scroll-position) are
 *     preserved on matched elements regardless of server HTML.
 *
 * This is intentionally simple — when no keys are present, the diff
 * matches by position only and falls back to replaceChildren-like
 * semantics for the unkeyed range. Apps that want stronger
 * preservation add `data-key` to elements they care about.
 *
 * @param {Node} parent
 * @param {Comment} startMarker
 * @param {Comment} endMarker
 * @param {Node[]} live
 * @param {Node[]} incoming
 */
function reconcileSiblings(parent, startMarker, endMarker, live, incoming) {
  // Index live elements by (tag + key) for keyed match.
  /** @type {Map<string, Element>} */
  const keyedLive = new Map();
  for (const n of live) {
    if (n.nodeType !== 1) continue;
    const k = keyOf(/** @type {Element} */ (n));
    if (k) keyedLive.set(k, /** @type {Element} */ (n));
  }

  // Walk incoming, placing nodes in order between markers.
  /** @type {Node} */
  let insertBefore = endMarker;
  // First pass: build the final ordered list of nodes (reusing matched live).
  /** @type {Node[]} */
  const finalNodes = [];
  for (const inc of incoming) {
    if (inc.nodeType === 1) {
      const k = keyOf(/** @type {Element} */ (inc));
      if (k && keyedLive.has(k)) {
        const reused = keyedLive.get(k);
        diffElementInPlace(reused, /** @type {Element} */ (inc));
        finalNodes.push(reused);
        keyedLive.delete(k);
        continue;
      }
    }
    finalNodes.push(inc);
  }

  // Remove live nodes that weren't reused.
  for (const n of live) {
    if (n.parentNode === parent) {
      if (n.nodeType === 1 && finalNodes.includes(n)) continue;
      parent.removeChild(n);
    }
  }

  // Insert final nodes in order before the end marker.
  for (const n of finalNodes) {
    parent.insertBefore(n, insertBefore);
  }
}

/**
 * Diff one matched element in place: copy attributes from `src` to `dst`,
 * preserve live attributes, recurse into children.
 *
 * @param {Element} dst  The element to update (live DOM).
 * @param {Element} src  The element to copy from (incoming HTML).
 */
function diffElementInPlace(dst, src) {
  if (dst.tagName !== src.tagName) {
    dst.replaceWith(src);
    return;
  }
  // Update attributes from src; remove ones not in src.
  const srcAttrs = new Set();
  for (const attr of src.attributes) {
    srcAttrs.add(attr.name);
    if (LIVE_ATTRS.has(attr.name)) continue;
    if (dst.getAttribute(attr.name) !== attr.value) {
      dst.setAttribute(attr.name, attr.value);
    }
  }
  for (const attr of [...dst.attributes]) {
    if (LIVE_ATTRS.has(attr.name)) continue;
    if (!srcAttrs.has(attr.name)) dst.removeAttribute(attr.name);
  }
  // For form-control-like elements, preserve live IDL state.
  // (`value`, `checked`, `open`, etc. — see LIVE_ATTRS below for full list.)
  // The attribute version is skipped above; we deliberately do nothing
  // here so the user's typing / checking is never blown away.

  // Recurse into children: collect both sides, run reconcileSiblings on
  // them with synthetic boundary markers. Cheap implementation: use
  // virtual ranges instead of inserting real comment markers.
  reconcileChildren(dst, src);
}

/**
 * Reconcile dst's children to match src's children, in-place.
 *
 * @param {Element} dst
 * @param {Element} src
 */
function reconcileChildren(dst, src) {
  const liveChildren = [...dst.childNodes];
  const incomingChildren = [...src.childNodes].map((n) => document.importNode(n, true));

  // Build keyed map of live children for reuse.
  /** @type {Map<string, Element>} */
  const keyedLive = new Map();
  for (const n of liveChildren) {
    if (n.nodeType !== 1) continue;
    const k = keyOf(/** @type {Element} */ (n));
    if (k) keyedLive.set(k, /** @type {Element} */ (n));
  }

  /** @type {Node[]} */
  const finalNodes = [];
  for (let i = 0; i < incomingChildren.length; i++) {
    const inc = incomingChildren[i];
    if (inc.nodeType === 1) {
      const k = keyOf(/** @type {Element} */ (inc));
      if (k && keyedLive.has(k)) {
        const reused = keyedLive.get(k);
        diffElementInPlace(reused, /** @type {Element} */ (inc));
        finalNodes.push(reused);
        keyedLive.delete(k);
        continue;
      }
      // Positional match: same tag, same index, neither has a key.
      const livePeer = liveChildren[i];
      if (livePeer && livePeer.nodeType === 1 &&
          !keyOf(/** @type {Element} */ (livePeer)) &&
          /** @type {Element} */ (livePeer).tagName === /** @type {Element} */ (inc).tagName) {
        diffElementInPlace(/** @type {Element} */ (livePeer), /** @type {Element} */ (inc));
        finalNodes.push(livePeer);
        continue;
      }
    } else if (inc.nodeType === 3) {
      // Text node: positional reuse for stable identity.
      const livePeer = liveChildren[i];
      if (livePeer && livePeer.nodeType === 3) {
        if (livePeer.nodeValue !== inc.nodeValue) livePeer.nodeValue = inc.nodeValue;
        finalNodes.push(livePeer);
        continue;
      }
    } else if (inc.nodeType === 8) {
      // Comment: positional reuse.
      const livePeer = liveChildren[i];
      if (livePeer && livePeer.nodeType === 8) {
        if (livePeer.nodeValue !== inc.nodeValue) livePeer.nodeValue = inc.nodeValue;
        finalNodes.push(livePeer);
        continue;
      }
    }
    finalNodes.push(inc);
  }

  // Mutate dst to contain finalNodes in order, preserving reused references.
  // Walk forward, inserting each node before the (potentially moved) next sibling.
  const finalSet = new Set(finalNodes);
  for (const n of liveChildren) {
    if (!finalSet.has(n) && n.parentNode === dst) dst.removeChild(n);
  }
  for (let i = 0; i < finalNodes.length; i++) {
    const n = finalNodes[i];
    if (n.parentNode !== dst || dst.childNodes[i] !== n) {
      dst.insertBefore(n, dst.childNodes[i] || null);
    }
  }
}

/**
 * Get the diff key for an element: `data-key` if present, else `id`.
 * Returns null for elements with no stable key.
 *
 * @param {Element} el
 * @returns {string | null}
 */
function keyOf(el) {
  const k = el.getAttribute('data-key');
  if (k) return `${el.tagName}:k:${k}`;
  if (el.id) return `${el.tagName}:i:${el.id}`;
  return null;
}

/**
 * Attribute names whose live DOM state must NEVER be overwritten by
 * incoming server HTML during a partial swap. The server emits these
 * with their initial-render value; the user may have typed/clicked
 * between renders. Preserving them keeps focus, typing, open state,
 * and popover state intact across navigation.
 */
const LIVE_ATTRS = new Set([
  // Form controls
  'value', 'checked', 'selected', 'indeterminate', 'disabled',
  // Disclosure / popover
  'open', 'popover',
]);

/* ====================================================================
 * Optimistic loading (per-segment loading.ts templates)
 * ==================================================================== */

/**
 * Look for `<template id="wj-loading:<deepest-current-path>">` in the
 * document; if present, clone its content into the deepest current
 * children-slot. Returns state needed to restore on fetch failure.
 *
 * The returned state carries the nav-token in effect at swap time;
 * `restoreOptimistic` verifies the token still matches before reverting,
 * so a slow nav A's late failure cannot revert a faster nav B's
 * already-settled state.
 *
 * @returns {{ slot: { start: Comment, end: Comment }, oldChildren: Node[], token: number } | null}
 */
function applyOptimisticLoading() {
  const slots = collectChildrenSlots(document.body);
  if (slots.size === 0) return null;
  // Pick the deepest current slot (longest path).
  let deepest = null;
  for (const p of slots.keys()) {
    if (deepest === null || p.length > deepest.length) deepest = p;
  }
  if (deepest === null) return null;
  const tpl = document.getElementById(`wj-loading:${deepest}`);
  if (!(tpl instanceof HTMLTemplateElement)) return null;

  const slot = slots.get(deepest);
  /** @type {Node[]} */
  const oldChildren = [];
  for (let n = slot.start.nextSibling; n && n !== slot.end; n = n.nextSibling) {
    oldChildren.push(n);
  }
  // Replace slot contents with the loading template.
  const range = document.createRange();
  range.setStartAfter(slot.start);
  range.setEndBefore(slot.end);
  range.deleteContents();
  slot.start.parentNode.insertBefore(tpl.content.cloneNode(true), slot.end);
  return { slot, oldChildren, token: currentNavigationToken };
}

/** @param {{ slot: { start: Comment, end: Comment }, oldChildren: Node[], token: number } | null} state */
function restoreOptimistic(state) {
  if (!state) return;
  // A newer nav superseded the one that captured this state — don't
  // revert; that newer nav owns the page now.
  if (state.token !== currentNavigationToken) return;
  const { slot, oldChildren } = state;
  if (slot.start.parentNode !== slot.end.parentNode) return;
  const range = document.createRange();
  range.setStartAfter(slot.start);
  range.setEndBefore(slot.end);
  range.deleteContents();
  for (const n of oldChildren) slot.start.parentNode.insertBefore(n, slot.end);
}

/* ====================================================================
 * Diff helper for the webjs-frame escape hatch
 * ==================================================================== */

/**
 * Diff children of two elements (used by the webjs-frame swap path).
 *
 * @param {Element} dst
 * @param {Element} src
 */
function diffChildren(dst, src) {
  reconcileChildren(dst, src);
}

/* ====================================================================
 * Head merge
 * ==================================================================== */

/**
 * Add-only head merge for partial (marker + frame) swaps. Updates the
 * title and adds new elements (modulepreloads, scripts) without
 * removing existing ones — runtime-generated content like Tailwind's
 * injected CSS must survive across navigations that keep the outer
 * layout mounted.
 *
 * @param {HTMLHeadElement} newHead
 */
function addNewHeadElements(newHead) {
  const newTitle = newHead.querySelector('title');
  if (newTitle) document.title = newTitle.textContent || '';

  const currentSet = new Set();
  for (const el of document.head.children) currentSet.add(el.outerHTML);

  for (const el of newHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') {
      // Skip — partial swaps keep the outer layout mounted, so the
      // existing importmap stays authoritative. Warn if the incoming
      // map differs: importmaps are immutable once a script has run
      // (modern browsers ignore subsequent <script type=importmap>),
      // so a mismatch means module resolution on this page won't match
      // what SSR rendered against.
      const incoming = (el.textContent || '').trim();
      if (incoming) {
        const current = document.querySelector('script[type="importmap"]');
        const currentText = current ? (current.textContent || '').trim() : '';
        if (currentText && currentText !== incoming && typeof console !== 'undefined') {
          console.warn('[webjs] incoming page has a different importmap; keeping the current page\'s map. Cross-layout module aliasing may be inconsistent.');
        }
      }
      continue;
    }
    if (el.tagName === 'BASE') continue;
    if (el.tagName === 'TITLE') continue;
    if (!currentSet.has(el.outerHTML)) {
      if (el.tagName === 'SCRIPT') {
        const script = document.createElement('script');
        for (const attr of el.attributes) script.setAttribute(attr.name, attr.value);
        script.textContent = el.textContent;
        document.head.appendChild(script);
      } else {
        document.head.appendChild(el.cloneNode(true));
      }
    }
  }
}

/** @param {HTMLHeadElement} newHead */
function mergeHead(newHead) {
  const currentHead = document.head;

  const newTitle = newHead.querySelector('title');
  if (newTitle) document.title = newTitle.textContent || '';

  const currentSet = new Set();
  for (const el of currentHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    currentSet.add(el.outerHTML);
  }

  const newSet = new Set();
  for (const el of newHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    newSet.add(el.outerHTML);
  }

  for (const el of [...currentHead.children]) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    if (el.tagName === 'TITLE') continue;
    if (!newSet.has(el.outerHTML)) el.remove();
  }

  for (const el of newHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    if (el.tagName === 'TITLE') continue;
    if (!currentSet.has(el.outerHTML)) {
      if (el.tagName === 'SCRIPT') {
        const script = document.createElement('script');
        for (const attr of el.attributes) script.setAttribute(attr.name, attr.value);
        script.textContent = el.textContent;
        currentHead.appendChild(script);
      } else {
        currentHead.appendChild(el.cloneNode(true));
      }
    }
  }
}

/* ====================================================================
 * Custom-element upgrade + script reactivation
 * ==================================================================== */

/** @param {Element} container */
function upgradeCustomElements(container) {
  if (typeof customElements === 'undefined') return;
  upgradeTree(container);
}

/** @param {Element | DocumentFragment} root */
function upgradeTree(root) {
  const els = root instanceof Element
    ? [root, ...root.querySelectorAll('*')]
    : [...root.querySelectorAll('*')];
  for (const el of els) {
    if (el.tagName && el.tagName.includes('-')) {
      customElements.upgrade(el);
      if (el.shadowRoot) upgradeTree(el.shadowRoot);
    }
  }
}

/**
 * Forward streamed Suspense resolver templates from the fetched body to
 * the live body. Needed when the new page emits a Suspense boundary that
 * resolves later.
 *
 * @param {HTMLElement} fetchedBody
 */
function forwardSuspenseResolvers(fetchedBody) {
  for (const tpl of fetchedBody.querySelectorAll('template[data-webjs-resolve]')) {
    document.body.appendChild(tpl.cloneNode(true));
  }
}

/** @param {Element} container */
function reactivateScripts(container) {
  for (const old of container.querySelectorAll('script')) {
    const script = document.createElement('script');
    for (const attr of old.attributes) script.setAttribute(attr.name, attr.value);
    script.textContent = old.textContent;
    old.replaceWith(script);
  }
}

/* ====================================================================
 * Internal exports for unit testing
 * ==================================================================== */

export {
  addNewHeadElements as _addNewHeadElements,
  mergeHead as _mergeHead,
  reactivateScripts as _reactivateScripts,
  findAnchorInPath as _findAnchorInPath,
  activeFrameId as _activeFrameId,
  collectChildrenSlots as _collectChildrenSlots,
  longestSharedPath as _longestSharedPath,
  keyOf as _keyOf,
  diffElementInPlace as _diffElementInPlace,
  reconcileChildren as _reconcileChildren,
  onPopState as _onPopState,
  snapshotCache as _snapshotCache,
  LIVE_ATTRS as _LIVE_ATTRS,
  blurOutgoingFocus as _blurOutgoingFocus,
  onSubmit as _onSubmit,
  getSubmitMethod as _getSubmitMethod,
  getSubmitAction as _getSubmitAction,
  buildSubmitFormData as _buildSubmitFormData,
  restoreOptimistic as _restoreOptimistic,
};

/** Test-only: read the monotonic navigation-token counter. */
export function _navToken() { return currentNavigationToken; }
/** Test-only: bump the navigation-token counter (simulates a fresh nav). */
export function _bumpNavToken() { return ++currentNavigationToken; }

/**
 * Predicate used by the onClick handler to decide whether a same-origin
 * href should bypass the router. Exposed for unit testing.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function _isNonHtmlPath(pathname) {
  return NON_HTML_EXTENSIONS.test(pathname);
}
