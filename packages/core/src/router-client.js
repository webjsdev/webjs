// Importing this side-effect-registers <webjs-frame> so apps that
// `import '@webjsdev/core/client-router'` get the escape-hatch element
// available without a second import.
import './webjs-frame.js';

/**
 * Client router for webjs: nested-layout-aware partial swap.
 *
 * Intercepts same-origin link clicks and form submissions, fetches the
 * target page's HTML via `fetch()`, finds the deepest layout boundary
 * shared by both the current and incoming pages, and replaces ONLY the
 * children of that boundary. Outer layout DOM (header, sidenav, footer)
 * stays mounted: no re-render, no flicker, scroll positions preserved.
 *
 * To enable, import this module from a layout or boot script:
 *
 *   import '@webjsdev/core/client-router';
 *
 * Or call `enableClientRouter()` for programmatic control.
 *
 * Mechanism: auto-derived from folder structure:
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
 *     wire-byte savings: the layout chain is never re-serialized for
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
 *   `<webjs-frame id="...">`: declarative partial-swap region NOT
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
 * submission `abort()`s this and replaces it: Turbo Drive's
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
 * newer nav superseded this one: bail out silently. Belt-and-suspenders
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

/**
 * The URL the user is currently viewing: tracked separately from
 * `location.href` because on `popstate` the browser updates
 * `location.href` to the destination URL BEFORE firing the event,
 * which means snapshotting "the current page" naively keys against
 * the wrong URL (the page being arrived at, not the page being left).
 *
 * Updated after every successful navigation completes. Used by
 * `snapshotCurrent` to key the snapshot under the URL the user is
 * actually leaving.
 *
 * @type {string | null}
 */
let currentPageUrl = null;

/**
 * Previous value of `history.scrollRestoration` (so we can restore it
 * when the router is disabled). The browser's default behavior of
 * auto-restoring scroll on popstate races with the SPA's own scroll
 * restoration: disabled here so webjs is the sole authority on scroll
 * during navigation. Same pattern as Turbo Drive's
 * `assumeControlOfScrollRestoration()` (turbo/src/core/drive/history.js).
 *
 * @type {ScrollRestoration | null}
 */
let prevScrollRestoration = null;

/** Enable the client router. Idempotent. */
export function enableClientRouter() {
  if (enabled || typeof document === 'undefined') return;
  enabled = true;
  // Both `click` and `submit` are BUBBLE phase, not capture. A component's
  // per-element `@click` / `@submit` handler (render-client.js) runs in the
  // at-target phase, BEFORE a document-level bubble listener. So onClick /
  // onSubmit run AFTER the component, and their `if (e.defaultPrevented) return`
  // guard sees the component's `preventDefault` and leaves the element alone.
  // A capture listener would run FIRST, before the component, so the guard
  // would always see `false` and the router would wrongly hijack a JS-handled
  // link or form: navigate a `<a @click=${e => e.preventDefault()}>` away, or
  // submit a `<form @submit=${e => e.preventDefault()}>` (the live chat /
  // comments forms, which preventDefault and send over WebSocket / fetch),
  // navigating the page out from under it. All the phase-independent filtering
  // (modifier / middle clicks, downloads, cross-origin, hash links, GET-vs-POST)
  // happens inside onClick / onSubmit regardless of phase. Mirrors
  // hotwired/turbo, which does its interception work in bubble listeners.
  document.addEventListener('click', onClick, false);
  document.addEventListener('submit', onSubmit, false);
  window.addEventListener('popstate', onPopState);
  // Intent prefetch: warm the next page on hover / focus / touch-start.
  // pointerover + focusin bubble, so one delegated listener each covers
  // the whole document, including links added by later navigations.
  document.addEventListener('pointerover', onPrefetchIntent, true);
  document.addEventListener('focusin', onPrefetchIntent, true);
  document.addEventListener('touchstart', onPrefetchIntent, { capture: true, passive: true });
  document.addEventListener('pointerout', onPrefetchOut, true);
  // After every client navigation the swapped-in DOM may carry new
  // anchors, so re-scan for render/viewport modes. webjs:navigate fires
  // at the end of fetchAndApply for both link and frame swaps.
  document.addEventListener('webjs:navigate', refreshPrefetchObservers);
  ensureUpgradeObserver();
  // Apply render/viewport prefetch modes to the initial document.
  refreshPrefetchObservers();
  // Take control of scroll restoration so the browser doesn't fight
  // the SPA's own snapshot-based restore on popstate.
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    prevScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
  }
  // Seed the "current page" tracker so the first navigation can
  // snapshot the page the user is leaving.
  if (typeof location !== 'undefined') currentPageUrl = location.href;
}

/** Disable the client router. */
export function disableClientRouter() {
  if (!enabled) return;
  enabled = false;
  document.removeEventListener('click', onClick, false);
  document.removeEventListener('submit', onSubmit, false);
  window.removeEventListener('popstate', onPopState);
  document.removeEventListener('pointerover', onPrefetchIntent, true);
  document.removeEventListener('focusin', onPrefetchIntent, true);
  document.removeEventListener('touchstart', onPrefetchIntent, /** @type any */ ({ capture: true }));
  document.removeEventListener('pointerout', onPrefetchOut, true);
  document.removeEventListener('webjs:navigate', refreshPrefetchObservers);
  clearPrefetchHover();
  if (prefetchViewObserver) { prefetchViewObserver.disconnect(); prefetchViewObserver = null; }
  if (typeof history !== 'undefined' && prevScrollRestoration !== null) {
    history.scrollRestoration = prevScrollRestoration;
    prevScrollRestoration = null;
  }
  currentPageUrl = null;
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
 * Evicts BOTH the back/forward snapshot cache and the speculative
 * prefetch cache. A prefetched fragment captured before a mutation would
 * otherwise be served stale on the next forward click, the same staleness
 * the snapshot eviction prevents for back/forward.
 *
 * @param {string} [url]  Specific URL to invalidate, or omit to clear all.
 */
export function revalidate(url) {
  // Falsy `url` (undefined, null, empty string) clears everything.
  // Loose `== null` would have left `revalidate('')` to silently no-op,
  // because `new URL('', location.href)` is a valid relative URL and the
  // resulting cache key rarely matches anything.
  if (!url) { snapshotCache.clear(); prefetchCache.clear(); return; }
  const u = new URL(url, location.href);
  const key = u.pathname + u.search;
  snapshotCache.delete(key);
  prefetchCache.delete(key);
}

// Auto-enable on import: deferred to the END of this module (see the
// call after the test-only exports). enableClientRouter() transitively
// reads the prefetch state (prefetchViewObserver and the caches), which
// are `const`/`let` declared lower in the file and therefore in the
// temporal dead zone here. Calling enable at module-end, after every
// top-level binding is initialised, avoids a ReferenceError in the
// bundled browser build.

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
  // Identify the active <webjs-frame> via closest(), returning null if the
  // click wasn't inside any frame. The frame escape-hatch takes precedence
  // over the auto-derived layout markers when both are present.
  const frameId = activeFrameId(anchor);
  performNavigation(href, false, frameId);
}

/** @param {PopStateEvent} _e */
function onPopState(_e) {
  // popstate has no DOM anchor, so no frame context: restore via cache or
  // refetch the whole document.
  performNavigation(location.href, true, null);
}

/**
 * Intercept form submissions. BUBBLE phase (see enableClientRouter) so we run
 * AFTER a component's per-element `@submit` handler, which is bound at-target.
 * That ordering is what makes the `if (e.defaultPrevented) return` guard below
 * work: a component that calls `e.preventDefault()` (the chat / comments forms,
 * or any JS-handled form) has already run, so we see the prevented default and
 * leave the form alone. A capture listener would fire us first, before the
 * component, defeating the guard and wrongly navigating the page out from under
 * a JS-handled form.
 *
 * Filtering mirrors Turbo's `form_submit_observer.js`:
 *   - `data-no-router` on form or submitter → full browser submit.
 *   - `formmethod="dialog"` → native <dialog> dismissal, never routed.
 *   - `target` / `formtarget` that isn't `_self` → iframe / popup target.
 *   - Cross-origin or non-HTML-extension action → let the browser handle.
 *
 * Submitter attributes (`formmethod`, `formaction`, `formenctype`) take
 * precedence over the form's own: HTML5 form-submission algorithm.
 *
 * @param {SubmitEvent} e
 */
function onSubmit(e) {
  if (!enabled) return;
  if (e.defaultPrevented) return;

  const form = /** @type {HTMLFormElement | null} */ (e.target);
  // Duck-type check rather than `instanceof HTMLFormElement`: linkedom
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
 * shadow DOM boundaries: essential because nav links typically live inside
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
 * The walk uses a stack to track nested marker pairs: a path can
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

  // Plain recursive comment walk: TreeWalker/NodeFilter aren't available
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
 * event into history state. Webjs captures lazily at snapshot time -
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
  // Cancel any in-flight fetch: Turbo Drive's navigator.stop().
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;
  // Bump nav generation. Captured below + by anything we await into.
  const myToken = ++currentNavigationToken;

  // Snapshot the page the user is LEAVING (with its scroll position)
  // so back/forward navigation can restore it. We key under
  // `currentPageUrl` rather than `location.href` because on popstate
  // the browser has already updated `location.href` to the destination
  // URL: using it as the key would clobber the cached snapshot we're
  // about to read in the popstate-restore branch below.
  if (currentPageUrl) snapshotCurrent(currentPageUrl);

  // Show a subtle loading indicator, but only if the nav takes long
  // enough to be worth showing one. Setting an attribute on <html>
  // invalidates global style computation: which forces CSS like
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
          applySwap(cachedDoc, frameId, /* revalidating */ true, /* href */ null);
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
      // Cache-miss popstate. Browser-native scroll restoration is
      // disabled (we set scrollRestoration='manual'): so without
      // explicit handling, scroll would just stay where the user was
      // on the page they popped FROM. Scroll to top as the reasonable
      // default; fetchAndApply skips its own scroll handling when
      // recordHistory=false (which is the case here).
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }

    await fetchAndApply(href, frameId, !isPopState, optimisticState, 'GET', null, signal, myToken);
  } finally {
    if (navigatingFlagTimer) clearTimeout(navigatingFlagTimer);
    // Only clear the navigating flag if WE are still the active nav.
    // A newer nav has its own flag lifecycle.
    if (myToken === currentNavigationToken) {
      document.documentElement.removeAttribute('data-navigating');
      // Record where the user is NOW so the next navigation can
      // snapshot under the right URL key.
      if (typeof location !== 'undefined') currentPageUrl = location.href;
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
 * cache after a successful response: Turbo's `clearSnapshotCache()` on
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
    // algorithm. The form's own `action` query is replaced: same as
    // a native GET-form submission.
    url.search = '';
    for (const [k, v] of body) {
      url.searchParams.append(k, typeof v === 'string' ? v : v.name);
    }
  }

  // Snapshot the page being submitted from (form submissions are
  // always foreground / never popstate, so `currentPageUrl` already
  // matches `location.href`: but use the tracker for consistency
  // with performNavigation).
  if (currentPageUrl) snapshotCurrent(currentPageUrl);

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
    // Mutating submissions invalidate cached versions of other URLs -
    // do this *after* the response applies so the new page itself is
    // snapshotted on the next nav, not pre-emptively wiped. Clear the
    // speculative prefetch cache too: a fragment prefetched before this
    // mutation would otherwise be served stale on a later forward click.
    if (!isSafe && myToken === currentNavigationToken) {
      snapshotCache.clear();
      prefetchCache.clear();
    }
  } finally {
    if (navigatingFlagTimer) clearTimeout(navigatingFlagTimer);
    if (myToken === currentNavigationToken) {
      document.documentElement.removeAttribute('data-navigating');
      if (typeof location !== 'undefined') currentPageUrl = location.href;
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

/* ====================================================================
 * Link prefetch (Remix-style strategies, fast-by-default)
 *
 * A link click already resolves through fetchAndApply, but the fetch
 * only STARTS on click, so the user waits a full round-trip. Prefetch
 * warms a dedicated cache speculatively so the click reads it instantly.
 *
 * Strategy per anchor via a `data-prefetch` attribute (valid-HTML data-*,
 * like SvelteKit / Astro), defaulting to `intent` so the common case is
 * fast without per-link opt-in, the way Next / Nuxt / SvelteKit ship
 * auto-prefetch. Value vocabulary borrows Next's true/false/auto aliases:
 *   - intent    (default)    : hover / focus / touch, after a short dwell
 *   - true / render          : eager, as soon as a document scan sees it
 *   - auto / viewport        : on viewport entry (IntersectionObserver, 0.5)
 *   - false / none           : never (also data-no-prefetch / rel="external")
 *
 * Why a separate cache, not snapshotCache: snapshotCache is keyed to the
 * back/forward restore path (popstate), which holds the FULL serialized
 * document of pages the user already visited. A prefetch holds the
 * SERVER FRAGMENT for a page not yet visited (the same X-Webjs-Have
 * partial body a real nav would receive). fetchAndApply consumes it via
 * prefetchTake() before falling back to the network.
 *
 * Only same-origin in-app links are prefetched (the same eligibility as
 * a click), and never under Save-Data / prefers-reduced-data. There is no
 * logout-style heuristic: prefetch issues a real GET, so as everywhere in
 * the ecosystem (Next / Nuxt / Remix), a non-idempotent action must be a
 * POST or a `<form>`, and `data-no-prefetch` / `rel="external"` opt out.
 *
 * What we do NOT touch: a native `<link rel="prefetch">` in the document
 * head is the browser's own mechanism and warms the HTTP cache; we never
 * interfere with it.
 * ==================================================================== */

/** Max speculative responses held at once (LRU). */
const PREFETCH_CAP = 8;
/** Speculative entries expire after this long (ms): avoid serving stale. */
const PREFETCH_TTL = 30_000;
/** Max concurrent in-flight prefetch requests. */
const PREFETCH_CONCURRENCY = 3;
/** Max prefetches waiting for a free slot (bounds a huge link list). */
const PREFETCH_QUEUE_CAP = 24;
/** Hover dwell before a prefetch fires (ms): filter drive-by pointer moves. Matches Remix's intent timeout. */
const PREFETCH_HOVER_DELAY = 100;

/** @typedef {{ html: string, build: string | null, finalUrl: string, at: number }} PrefetchEntry */
/** @type {Map<string, PrefetchEntry>} */
const prefetchCache = new Map();
/** Keys with a fetch currently in flight (dedupe + concurrency gate). */
const prefetchInflight = new Set();
/** hrefs waiting for a free concurrency slot (FIFO), and their keys. */
const prefetchQueue = [];
const prefetchQueued = new Set();
/** Pending hover-dwell timer, cleared on pointerout / blur. */
let prefetchHoverTimer = null;
/** Last anchor a hover timer was armed for (so pointerout can match). */
let prefetchHoverAnchor = null;
/** IntersectionObserver for data-prefetch="viewport" anchors, or null. */
let prefetchViewObserver = null;

/**
 * True when the user or platform has asked us to conserve data. Both the
 * Save-Data client hint and the prefers-reduced-data media query disable
 * speculative fetching. Guarded for non-browser / partial DOM.
 *
 * @returns {boolean}
 */
function prefetchSaysSaveData() {
  try {
    const c = typeof navigator !== 'undefined' ? /** @type any */ (navigator).connection : null;
    if (c && c.saveData === true) return true;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-data: reduce)').matches) {
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Lowercased whitespace-separated rel tokens of an anchor.
 * @param {Element} anchor
 * @returns {string[]}
 */
function relTokens(anchor) {
  const rel = anchor.getAttribute('rel');
  return rel ? rel.toLowerCase().split(/\s+/).filter(Boolean) : [];
}

/**
 * Decide whether an anchor is a same-origin in-app target the router can
 * navigate, returning its absolute href or null. Shared by onClick and
 * the prefetch listeners so eligibility never drifts between them.
 *
 * @param {Element | null} anchor
 * @returns {string | null}
 */
function eligibleAnchorHref(anchor) {
  if (!anchor || !(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.hasAttribute('download')) return null;
  if (anchor.hasAttribute('data-no-router')) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  const href = anchor.href;
  if (!href) return null;
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.origin !== location.origin) return null;
  // A pure same-page hash jump is not a navigation we fetch.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return null;
  if (NON_HTML_EXTENSIONS.test(url.pathname)) return null;
  return href;
}

/**
 * Whether prefetching this anchor is suppressed by author intent. The
 * `external` rel marks a link leaving the app, `no-prefetch` and
 * `data-no-prefetch` are explicit opt-outs, and `data-no-router` already
 * disables routing entirely (so it is caught upstream too).
 *
 * @param {Element} anchor
 * @returns {boolean}
 */
function prefetchSuppressed(anchor) {
  if (anchor.hasAttribute('data-no-prefetch')) return true;
  const rel = relTokens(anchor);
  return rel.includes('external') || rel.includes('no-prefetch');
}

/**
 * Resolve the prefetch strategy for an anchor from a `data-prefetch`
 * attribute. webjs has no Link component (links are plain `<a href>`), so
 * the knob is a valid-HTML `data-*` attribute, the same shape SvelteKit
 * (`data-sveltekit-preload-data`) and Astro (`data-astro-prefetch`) use.
 * Next.js / Nuxt / Remix express the same choice as a component PROP
 * (`<Link prefetch>`) that never reaches the DOM, so there is nothing to
 * mirror attribute-wise; we reuse their value vocabulary (true/false/auto)
 * as aliases. Default is `intent` (fast-by-default) when the attribute is
 * absent or unrecognised.
 *
 * Value mapping (case-insensitive):
 *   - absent / unknown   : `intent`  (the default)
 *   - `intent`           : hover / focus / touch, after a short dwell
 *   - `true` / `render`  : eager, as soon as a document scan sees the link
 *   - `auto` / `viewport`: on viewport entry (IntersectionObserver)
 *   - `false` / `none`   : never (also via data-no-prefetch / rel="external")
 *
 * Returns `none` for suppressed anchors so callers have a single check.
 *
 * @param {Element} anchor
 * @returns {'intent' | 'render' | 'viewport' | 'none'}
 */
function prefetchMode(anchor) {
  if (prefetchSuppressed(anchor)) return 'none';
  const raw = (anchor.getAttribute('data-prefetch') || '').toLowerCase().trim();
  switch (raw) {
    case 'false':
    case 'none':
      return 'none';
    case 'true':
    case 'render':
      return 'render';
    case 'auto':
    case 'viewport':
      return 'viewport';
    case 'intent':
      return 'intent';
    default:
      // Unset or unrecognised value: the fast default.
      return 'intent';
  }
}

/**
 * Speculatively fetch `href` and stash the server fragment so a later
 * click resolves instantly. No-op when data-saving is on or the entry is
 * already cached or in flight. When the concurrency gate is full the
 * request is QUEUED (not dropped) and drains as in-flight slots free, so
 * a burst of `render` / `viewport` links all eventually prefetch rather
 * than silently losing everything past the cap.
 *
 * @param {string} href
 */
function prefetch(href) {
  if (typeof fetch !== 'function') return;
  if (prefetchSaysSaveData()) return;
  const key = cacheKey(href);
  if (prefetchInflight.has(key)) return;
  if (prefetchQueued.has(key)) return;
  const existing = prefetchCache.get(key);
  if (existing && (nowMs() - existing.at) < PREFETCH_TTL) return;
  if (prefetchInflight.size >= PREFETCH_CONCURRENCY) {
    // Gate full: queue rather than drop, bounded so a huge link list
    // cannot grow the queue without limit (oldest queued entry is shed).
    prefetchQueued.add(key);
    prefetchQueue.push(href);
    while (prefetchQueue.length > PREFETCH_QUEUE_CAP) {
      const dropped = prefetchQueue.shift();
      prefetchQueued.delete(cacheKey(dropped));
    }
    return;
  }

  prefetchInflight.add(key);
  const headers = { 'x-webjs-router': '1', 'x-webjs-prefetch': '1' };
  const have = buildHaveHeader();
  if (have) headers['x-webjs-have'] = have;

  fetch(href, { method: 'GET', headers, credentials: 'same-origin' })
    .then(async (resp) => {
      const ctype = resp.headers.get('content-type') || '';
      if (!/^text\/html\b/i.test(ctype)) return;
      if (resp.status >= 400) return;
      const build = resp.headers.get('x-webjs-build');
      const finalUrl = resp.redirected && resp.url ? resp.url : href;
      const html = await resp.text();
      prefetchStore(key, { html, build, finalUrl, at: nowMs() });
    })
    .catch(() => { /* speculative: swallow */ })
    .finally(() => {
      prefetchInflight.delete(key);
      drainPrefetchQueue();
    });
}

/** Start the next queued prefetch if a concurrency slot is free. */
function drainPrefetchQueue() {
  while (prefetchQueue.length && prefetchInflight.size < PREFETCH_CONCURRENCY) {
    const href = prefetchQueue.shift();
    prefetchQueued.delete(cacheKey(href));
    prefetch(href);
  }
}

/**
 * Store a speculative entry under LRU + cap, then announce that the
 * fragment is cached and consumable.
 *
 * The `webjs:prefetch` event fires the instant a speculative fragment
 * becomes consumable (after the response body has been read), which is
 * strictly later than the prefetch request going out. App code can
 * listen to instrument prefetch hit rate, and tests can await it to know
 * a subsequent click will consume the cache rather than refetch. The
 * detail carries the cached URL and a `from: 'prefetch'` tag so a single
 * listener can disambiguate it from `webjs:navigate`.
 *
 * @param {string} key
 * @param {PrefetchEntry} entry
 */
function prefetchStore(key, entry) {
  if (prefetchCache.has(key)) prefetchCache.delete(key);
  prefetchCache.set(key, entry);
  while (prefetchCache.size > PREFETCH_CAP) {
    const oldest = prefetchCache.keys().next().value;
    prefetchCache.delete(oldest);
  }
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('webjs:prefetch', {
      detail: { url: entry.finalUrl, key, from: 'prefetch' },
    }));
  }
}

/**
 * Consume a fresh speculative entry for `href`, removing it (a fragment
 * is single-use: once applied it becomes a real snapshot). Returns null
 * on miss or when the entry has aged past the TTL.
 *
 * @param {string} href
 * @returns {PrefetchEntry | null}
 */
function prefetchTake(href) {
  const key = cacheKey(href);
  const entry = prefetchCache.get(key);
  if (!entry) return null;
  prefetchCache.delete(key);
  if ((nowMs() - entry.at) >= PREFETCH_TTL) return null;
  return entry;
}

/** Monotonic-ish clock guarded for environments without performance. */
function nowMs() {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch { /* ignore */ }
  return 0;
}

/** @param {Event} e */
function onPrefetchIntent(e) {
  if (!enabled) return;
  const anchor = closestAnchor(/** @type any */ (e.target));
  if (!anchor) return;
  // Only `intent` links prefetch on hover/focus/touch. `render` and
  // `viewport` links are handled by the document scan / observer, and
  // `none` is suppressed.
  if (prefetchMode(anchor) !== 'intent') return;
  const href = eligibleAnchorHref(anchor);
  if (!href) return;
  // pointerover/focusin bubble, so re-entering a child of the same anchor
  // would re-arm; collapse to one timer per anchor.
  if (prefetchHoverAnchor === anchor && prefetchHoverTimer) return;
  clearPrefetchHover();
  prefetchHoverAnchor = anchor;
  prefetchHoverTimer = setTimeout(() => {
    prefetchHoverTimer = null;
    prefetchHoverAnchor = null;
    prefetch(href);
  }, PREFETCH_HOVER_DELAY);
}

/** @param {Event} e */
function onPrefetchOut(e) {
  const anchor = closestAnchor(/** @type any */ (e.target));
  if (anchor && anchor === prefetchHoverAnchor) clearPrefetchHover();
}

function clearPrefetchHover() {
  if (prefetchHoverTimer) { clearTimeout(prefetchHoverTimer); prefetchHoverTimer = null; }
  prefetchHoverAnchor = null;
}

/**
 * Nearest enclosing <a>, crossing shadow boundaries, from an event
 * target. composedPath is click-only, so walk getRootNode().host here.
 *
 * @param {EventTarget | null} target
 * @returns {HTMLAnchorElement | null}
 */
function closestAnchor(target) {
  let node = /** @type {Node | null} */ (target);
  while (node) {
    if (node instanceof HTMLAnchorElement) return node;
    const el = node.nodeType === 1 ? /** @type {Element} */ (node) : null;
    if (el) {
      const a = el.closest && el.closest('a');
      if (a instanceof HTMLAnchorElement) return a;
    }
    const root = node.getRootNode ? node.getRootNode() : null;
    node = root && /** @type any */ (root).host ? /** @type any */ (root).host : null;
  }
  return null;
}

/**
 * (Re)scan the document and apply the non-hover prefetch modes:
 *   - `render`   anchors prefetch immediately (they are now in the DOM).
 *   - `viewport` anchors are observed and prefetch on intersection.
 * `intent` (the default) is handled by the hover/focus/touch listeners,
 * and `none` is skipped. Called on enable and after each navigation,
 * since the swapped-in DOM may carry new links.
 *
 * The viewport threshold (0.5) matches Remix's IntersectionObserver.
 */
function refreshPrefetchObservers() {
  if (typeof document === 'undefined') return;
  if (prefetchSaysSaveData()) return;
  const hasIO = typeof IntersectionObserver !== 'undefined';
  if (hasIO) {
    if (!prefetchViewObserver) {
      prefetchViewObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const anchor = /** @type {Element} */ (entry.target);
          prefetchViewObserver.unobserve(anchor);
          const href = eligibleAnchorHref(anchor);
          if (href && prefetchMode(anchor) === 'viewport') prefetch(href);
        }
      }, { threshold: 0.5 });
    } else {
      prefetchViewObserver.disconnect();
    }
  }
  for (const anchor of document.querySelectorAll('a[href]')) {
    const mode = prefetchMode(anchor);
    if (mode === 'render') {
      const href = eligibleAnchorHref(anchor);
      if (href) prefetch(href);
    } else if (mode === 'viewport' && hasIO) {
      prefetchViewObserver.observe(anchor);
    }
  }
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
 * @param {AbortSignal | null} [signal]  Abort signal - newer nav cancels this fetch.
 * @param {number} [token]  Nav-token captured at the caller's entry; stale → skip apply.
 */
async function fetchAndApply(href, frameId, recordHistory, optimisticState, method, body, signal, token) {
  method = method || 'GET';
  const myToken = typeof token === 'number' ? token : currentNavigationToken;
  let html;
  let incomingBuild = null;
  /** @type {string} */
  let finalUrl = href;
  try {
    // Warm-cache fast path: a hover/focus/viewport prefetch may have
    // already fetched this exact page (same X-Webjs-Have shell). Consume
    // it instead of going to the network, so the click resolves with no
    // round-trip. Only for plain GET navs without a frame target; form
    // submissions and frame swaps always hit the server. The entry is
    // single-use (prefetchTake removes it) and TTL-guarded inside take.
    const prefetched = (method === 'GET' && !body && !frameId) ? prefetchTake(href) : null;
    if (prefetched) {
      html = prefetched.html;
      incomingBuild = prefetched.build;
      finalUrl = prefetched.finalUrl;
    } else {
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
    // Server-side redirect (PRG, auth-gate, etc.): fetch followed it
    // automatically. Record the FINAL URL in history, not the
    // originally-requested one, so back/forward + bookmarking work.
    if (resp.redirected && resp.url) finalUrl = resp.url;

    // Empty-body status codes (204 No Content, 205 Reset Content):
    // server-rendered "stay on current page" pattern. Don't try to
    // swap an empty document over the live one. We DO still record
    // history for the originating URL: same as a normal navigation
    // that decided to short-circuit.
    if (resp.status === 204 || resp.status === 205) {
      if (myToken === currentNavigationToken && recordHistory) {
        history.pushState(null, '', finalUrl);
      }
      return;
    }

    // Non-HTML response (JSON error, file download, opaque): let the
    // browser handle it. Same for non-OK responses that aren't HTML
    // (a 500 returning `{"error": "..."}` shouldn't be rendered as a
    // page).
    if (!isHTML) {
      if (myToken === currentNavigationToken) location.href = href;
      return;
    }

    // HTML body of ANY status: 2xx, 4xx validation errors, 5xx error
    // pages: is parsed and applied in place. Matches Turbo Drive's
    // `formSubmissionFailedWithResponse` behavior
    // (turbo/src/core/drive/navigator.js:92-107). Critical for the
    // standard server-rendered validation pattern: 422 + re-rendered
    // form with errors keeps the user's typed input and shows context.
    // Capture the server's build hash header BEFORE reading the body.
    // The header is set on every SSR response, including X-Webjs-Have
    // partial responses where the body has no head and no importmap
    // tag to compare. The applySwap importmap-mismatch guard reads
    // this to detect deploys that bumped the vendor pin.
    incomingBuild = resp.headers.get('x-webjs-build');
    html = await resp.text();
    }
  } catch (err) {
    // Aborted by a newer navigation: let it run, don't fall back.
    if (err && /** @type any */ (err).name === 'AbortError') return;
    // Stale (a newer nav started before we got the network error) -
    // the newer nav owns the page now; don't clobber it.
    if (myToken !== currentNavigationToken) return;
    restoreOptimistic(optimisticState);
    location.href = href;
    return;
  }

  // A newer navigation started while we awaited the response body -
  // bail before we overwrite its work.
  if (myToken !== currentNavigationToken) return;

  const doc = parseHTML(html);
  if (!doc) { location.href = href; return; }

  applySwap(doc, frameId, false, finalUrl, incomingBuild);

  if (recordHistory) history.pushState(null, '', finalUrl);

  // Scroll only for foreground (history-recording) navigations. When
  // `recordHistory` is false we're either:
  //   (a) the background revalidation after a cached popstate restore
  //       - performNavigation already set scroll from the cached
  //       position; we must NOT clobber it here.
  //   (b) a cache-miss popstate: modern browsers fire scroll-
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

  document.dispatchEvent(new CustomEvent('webjs:navigate', { detail: { url: finalUrl, frameId, from: 'navigate' } }));
}

/**
 * Apply the swap from a parsed incoming Document onto the live document.
 * Picks the most-scoped match: explicit webjs-frame > deepest shared
 * layout marker > full body swap.
 *
 * If the incoming page carries a different importmap from the current
 * page (typical after a deploy that bumped a vendor pin), partial swap
 * is unsafe: importmaps are immutable once applied, so the new page
 * would resolve modules against the stale URLs. We fall back to a full
 * page load via `location.assign(href)`. Mirrors Turbo's
 * `tracked_element_mismatch` reload, applied specifically to
 * importmaps. Called with `href = null` for revalidation flows (which
 * never trigger a hard reload).
 *
 * Detection uses the `X-Webjs-Build` response header (read by the
 * fetch path and passed in as `incomingBuild`), compared against the
 * current page's `data-webjs-build`. The header is set on EVERY SSR
 * response, including X-Webjs-Have partial responses that omit the
 * head and importmap entirely, and it carries the PUBLISHED build id,
 * which the server advertises only once the importmap is final. A hard
 * reload fires only when both ids are present and differ (a real
 * cross-deploy). An empty / absent id on either side means "version
 * unknown" (a warming runtime-first-boot server, or a response that
 * predates the header) and never triggers a reload, so the warmup
 * window cannot wipe a half-filled form.
 *
 * @param {Document} doc
 * @param {string | null} frameId
 * @param {boolean} revalidating  Restore from cache; already-matched markers may stomp inflight state, signal helps loading templates skip.
 * @param {string | null} [href]  Target URL for hard-reload fallback on importmap mismatch.
 * @param {string | null} [incomingBuild]  X-Webjs-Build header from the response, or null.
 */
/**
 * Compute the signature of all `data-webjs-track="reload"` elements
 * in the head of `root`. Returns the concatenation of each element's
 * `outerHTML`, in document order. Two documents with identical
 * tracked-element sets produce identical signatures; any change in
 * attributes, content, or set membership produces a different one.
 *
 * Mirrors hotwired/turbo's `head_snapshot.js` `trackedElementSignature`
 * (the data-turbo-track="reload" mechanism). Used by applySwap as a
 * generic opt-in next to the importmap-specific build hash.
 *
 * Returns the empty string when `root` has no head (e.g. an
 * X-Webjs-Have partial response) or when no elements opt in.
 *
 * @param {Document | undefined} root
 * @returns {string}
 */
function trackedReloadSignature(root) {
  if (!root || !root.head) return '';
  const tracked = root.head.querySelectorAll('[data-webjs-track="reload"]');
  if (!tracked.length) return '';
  // Use outerHTMLForDiff so the CSP nonce (which rotates per
  // request) is stripped before signature comparison. Without this,
  // a nonced tracked script like `<script nonce="${cspNonce()}"
  // data-webjs-track="reload" src="/build.js?v=42">` would mismatch
  // every navigation and infinite-reload. Matches Turbo's
  // head_snapshot.js elementWithoutNonce posture.
  let sig = '';
  for (const el of tracked) sig += outerHTMLForDiff(el);
  return sig;
}

function applySwap(doc, frameId, revalidating, href, incomingBuild) {
  // Any clean swap (no importmap mismatch, including cache restores
  // and frame swaps where we don't even run the mismatch check) is a
  // signal that the user successfully navigated, so clear the reload
  // flag. Otherwise a sequence "reload because of mismatch → Back to
  // a cache restore → Forward to a deploy-bumped URL" would find the
  // stale flag still set and suppress the second legitimate reload.
  try {
    if (typeof sessionStorage !== 'undefined' && (!href || frameId || revalidating)) {
      sessionStorage.removeItem('webjs:importmap-reload');
    }
  } catch { /* ignore */ }

  // Importmap-mismatch guard. Only fires for foreground navs (href
  // present); revalidation passes href=null to keep cache restores
  // soft. Skipped if a <webjs-frame> escape hatch is in play (frame
  // swaps are intra-page and don't change the importmap).
  if (href && !frameId && !revalidating) {
    const currentTag = document.querySelector('script[type="importmap"]');
    const currentBuild = currentTag ? currentTag.getAttribute('data-webjs-build') : null;
    let mismatch = false;
    if (incomingBuild && currentBuild) {
      // Preferred path: compare per-response build id. Works even
      // when the response body has no importmap (partial swap).
      mismatch = incomingBuild !== currentBuild;
    }
    // An empty / absent build id on EITHER side means "version unknown":
    // the server has not published an authoritative importmap yet (the
    // warmup window, where a runtime-first-boot app resolves its vendor
    // map over the first request), or the response predates the build
    // header. In that state a hard reload is unsafe and destructive: it
    // would fire repeatedly as the warming server's id flips from empty
    // to its final value, wiping any half-filled form on the page. So we
    // never hard-reload against an unknown id and leave `mismatch` false;
    // the soft swap proceeds and the page settles once the server is
    // warm. A real cross-deploy reload still fires, because both sides
    // then carry non-empty, differing ids. (No importmap-textContent
    // fallback: the published-id contract above supersedes it, and the
    // textContent of a warming map drifts for the same reason the id does.)
    // Generic `data-webjs-track="reload"` opt-in. ANY element in the
    // head that the user marks gets included in the tracked-element
    // signature. If the signature differs between current and incoming
    // documents, hard-reload. Mirrors hotwired/turbo's
    // data-turbo-track="reload" semantics (head_snapshot.js
    // trackedElementSignature). Lets app authors tag arbitrary
    // version-sensitive elements (CSS bundle <link>, deploy meta tag)
    // for cross-deploy reload, not just the importmap.
    //
    // Importmap-specific data-webjs-build / X-Webjs-Build remain the
    // primary mechanism because they ALSO work on partial responses
    // (no head in the body). data-webjs-track is for elements that
    // can't ride the build hash.
    //
    // Skip the check when the incoming response has no head content
    // (X-Webjs-Have partial-fragment response). Without this guard
    // a partial response would always mismatch any current tracked
    // signature and falsely reload. With the guard, a partial
    // response means "trust the build hash; don't decide based on
    // missing head info." Comparing on full responses also catches
    // added/removed track markers because empty `incomingSig`
    // would correctly differ from a non-empty `currentSig`.
    if (!mismatch && doc.head && doc.head.children.length > 0) {
      const currentSig = trackedReloadSignature(document);
      const incomingSig = trackedReloadSignature(doc);
      if (currentSig !== incomingSig) mismatch = true;
    }
    if (mismatch && typeof location !== 'undefined') {
      // Infinite-reload guard: if the importmap appears to genuinely
      // change EVERY navigation (e.g. a developer is live-editing the
      // pin file in dev, or a misbehaving CDN returns different
      // jspm.io URLs each request), the user would experience a hard
      // reload on every click. Use a one-shot sessionStorage flag:
      // set before the first reload, cleared by the next successful
      // swap. Two reloads BACK-TO-BACK (without an intervening clean
      // nav) trip the guard.
      try {
        const flag = 'webjs:importmap-reload';
        if (sessionStorage && sessionStorage.getItem(flag)) {
          // Already reloaded once for an importmap mismatch and the
          // next nav STILL mismatches: bail to the partial swap. The
          // user is on a stale importmap but at least the page
          // renders.
          sessionStorage.removeItem(flag);
        } else {
          if (sessionStorage) sessionStorage.setItem(flag, '1');
          location.href = href;
          return;
        }
      } catch {
        // sessionStorage unavailable (private mode w/ quota etc.):
        // fall through to a single reload like before.
        location.href = href;
        return;
      }
    } else if (!mismatch) {
      // A clean swap (no importmap mismatch) means we're back to
      // matching client/server importmaps. Clear the reload flag so
      // a future LEGITIMATE mismatch (e.g. a later deploy) gets a
      // fresh single-shot reload instead of being suppressed by a
      // stale flag from an unrelated earlier reload.
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('webjs:importmap-reload');
        }
      } catch { /* ignore */ }
    }
  }

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
    // The response did not carry the requested frame (source null), or the
    // target frame is gone from the live DOM (target null). Falling through
    // would wholesale-replace the document, a silent full-page swap that
    // destroys the page (e.g. an auth redirect returning a login page without
    // the frame). Surface the contract violation with a cancelable event
    // instead. Default: warn and leave the frame unchanged. A listener that
    // calls preventDefault owns the outcome.
    const evt = new CustomEvent('webjs:frame-missing', {
      bubbles: true,
      cancelable: true,
      detail: { frameId, url: href || (typeof location !== 'undefined' ? location.href : null), document: doc },
    });
    (target || document).dispatchEvent(evt);
    if (!evt.defaultPrevented) {
      console.warn(`[webjs] frame "${frameId}" was not in the navigation response, leaving it unchanged. Handle "webjs:frame-missing" (preventDefault) to override.`);
    }
    return;
  }

  // 2. Auto-derived layout-marker swap.
  const here = collectChildrenSlots(document.body);
  const there = collectChildrenSlots(doc.body);
  const sharedPath = longestSharedPath(here, there);

  if (sharedPath) {
    // ADD-ONLY head merge for the same reason: outer layout stays
    // mounted, its head-bound runtime state must not be invalidated.
    addNewHeadElements(doc.head);
    swapMarkerRange(here.get(sharedPath), there.get(sharedPath), doc);
    forwardSuspenseResolvers(doc.body);
    blurOutgoingFocus();
    return;
  }

  // 3. Full body swap fallback. Use full head merge: different root
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
 * back: even though they navigated minutes ago.
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
 * the user was already interacting with: don't fight them).
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
  // The differ wants two parents: synthesize a transient parent for
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
 * This is intentionally simple: when no keys are present, the diff
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
  // (`value`, `checked`, `open`, etc.: see LIVE_ATTRS below for full list.)
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
  // A newer nav superseded the one that captured this state: don't
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
 * removing existing ones: runtime-generated content like Tailwind's
 * injected CSS must survive across navigations that keep the outer
 * layout mounted.
 *
 * @param {HTMLHeadElement} newHead
 */

/**
 * Read the CSP nonce that the original page load published via
 * `<meta name="csp-nonce" content="...">`. Returns empty string when
 * no meta tag is present (apps without strict CSP).
 *
 * The meta tag is the contract: server emits it once at SSR time,
 * client reads it for every dynamically-created script. The browser
 * enforces CSP against the nonce the original page declared, NOT the
 * per-request nonce on subsequent navigations. So we always apply
 * THIS nonce, not the source-page nonce that arrived with the new
 * head fragment.
 *
 * Mirrors hotwired/turbo's `getCspNonce` in src/util.js. Not cached:
 * a single querySelector on document.head is cheap, and caching
 * would break if the user (or a test) inserted the meta tag late.
 *
 * @returns {string}
 */
function getCspNonce() {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="csp-nonce"]');
  // Read the `content` attribute, not the `.nonce` IDL property.
  // Turbo's getCspNonce in src/util.js falls back to `.nonce` first
  // because it can be called against script/link elements (where
  // browsers DO expose `.nonce` and additionally clear the
  // `nonce` attribute on document load). The `<meta name="csp-nonce">`
  // element webjs targets has no `.nonce` IDL (only script + link
  // elements do per HTML spec), so the only viable source is the
  // `content` attribute.
  return meta ? meta.getAttribute('content') || '' : '';
}

/**
 * Create a `<script>` clone of `source` that's safe to insert into the
 * live document under strict CSP. Copies every attribute EXCEPT
 * nonce (the source's nonce is from the new page's per-request token,
 * which the browser's CSP cache from the original page load will
 * reject), then applies the cached nonce from the meta tag. Re-emits
 * textContent so inline scripts execute as if first-loaded.
 *
 * @param {HTMLScriptElement} source
 * @returns {HTMLScriptElement}
 */
function cloneScriptWithCorrectNonce(source) {
  const script = document.createElement('script');
  for (const attr of source.attributes) {
    if (attr.name === 'nonce') continue;
    script.setAttribute(attr.name, attr.value);
  }
  const nonce = getCspNonce();
  if (nonce) {
    // Use setAttribute so the attribute is queryable
    // (`getAttribute('nonce')`, outerHTML serialization, etc.).
    // Per CSP3 the .nonce IDL property is the authoritative source
    // for the CSP check, but real browsers reflect setAttribute into
    // .nonce automatically. Test environments (linkedom) reflect only
    // one direction, so we set the attribute.
    script.setAttribute('nonce', nonce);
  }
  script.textContent = source.textContent;
  return script;
}

/**
 * Clone any head element while substituting the page-load CSP nonce
 * for the source's per-request nonce. Used for `<link rel="modulepreload"
 * nonce="...">` and any other nonce-carrying head element: browsers
 * gate cross-origin module preload by script-src nonce too, so the
 * per-request nonce from the new page's head would be blocked by the
 * browser's CSP cache from the original page load.
 *
 * Returns a cloneNode(true) for elements without a nonce attribute,
 * so non-CSP cases stay zero-cost.
 *
 * @param {Element} source
 * @returns {Element}
 */
function cloneElementWithCorrectNonce(source) {
  if (!source.hasAttribute('nonce')) return source.cloneNode(true);
  const clone = /** @type {Element} */ (source.cloneNode(true));
  const nonce = getCspNonce();
  if (nonce) {
    clone.setAttribute('nonce', nonce);
  } else {
    clone.removeAttribute('nonce');
  }
  return clone;
}

/**
 * Return an `outerHTML` string suitable for head-diff comparison: strip
 * any nonce attribute so per-request nonces don't cause every script in
 * the head to look "changed" on every navigation. The original element
 * is left untouched (we clone first).
 *
 * Mirrors hotwired/turbo's `elementWithoutNonce` pattern in
 * src/core/drive/head_snapshot.js.
 *
 * @param {Element} el
 * @returns {string}
 */
function outerHTMLForDiff(el) {
  // Strip nonce from ANY element type. SCRIPT obviously, but also LINK
  // (modulepreload tags carry nonce per the recent CSP fix). Without
  // this, per-request nonces on link tags would cause the diff to
  // treat every preload as "changed", duplicating preloads on every
  // navigation.
  if (!el.hasAttribute('nonce')) return el.outerHTML;
  const clone = /** @type {Element} */ (el.cloneNode(true));
  clone.removeAttribute('nonce');
  return clone.outerHTML;
}

function addNewHeadElements(newHead) {
  const newTitle = newHead.querySelector('title');
  if (newTitle) document.title = newTitle.textContent || '';

  const currentSet = new Set();
  for (const el of document.head.children) currentSet.add(outerHTMLForDiff(el));

  for (const el of newHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') {
      // Skip: partial swaps keep the outer layout mounted, so the
      // existing importmap stays authoritative. Importmaps are
      // immutable once a script has run (modern browsers ignore
      // subsequent `<script type=importmap>`). Importmap-mismatch
      // detection lives at the applySwap entry: a mismatch there
      // triggers a full reload before we ever reach this loop.
      continue;
    }
    if (el.tagName === 'BASE') continue;
    if (el.tagName === 'TITLE') continue;
    if (!currentSet.has(outerHTMLForDiff(el))) {
      if (el.tagName === 'SCRIPT') {
        document.head.appendChild(
          cloneScriptWithCorrectNonce(/** @type {HTMLScriptElement} */ (el)),
        );
      } else {
        document.head.appendChild(cloneElementWithCorrectNonce(el));
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
    currentSet.add(outerHTMLForDiff(el));
  }

  const newSet = new Set();
  for (const el of newHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    newSet.add(outerHTMLForDiff(el));
  }

  for (const el of [...currentHead.children]) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    if (el.tagName === 'TITLE') continue;
    if (!newSet.has(outerHTMLForDiff(el))) el.remove();
  }

  for (const el of newHead.children) {
    if (el.tagName === 'SCRIPT' && el.getAttribute('type') === 'importmap') continue;
    if (el.tagName === 'BASE') continue;
    if (el.tagName === 'TITLE') continue;
    if (!currentSet.has(outerHTMLForDiff(el))) {
      if (el.tagName === 'SCRIPT') {
        currentHead.appendChild(
          cloneScriptWithCorrectNonce(/** @type {HTMLScriptElement} */ (el)),
        );
      } else {
        currentHead.appendChild(cloneElementWithCorrectNonce(el));
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
    old.replaceWith(cloneScriptWithCorrectNonce(/** @type {HTMLScriptElement} */ (old)));
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
  eligibleAnchorHref as _eligibleAnchorHref,
  prefetchSuppressed as _prefetchSuppressed,
  prefetchMode as _prefetchMode,
  prefetch as _prefetch,
  prefetchTake as _prefetchTake,
  prefetchSaysSaveData as _prefetchSaysSaveData,
};

/** Test-only: peek the speculative cache for a href without consuming it. */
export function _prefetchPeek(href) { return prefetchCache.get(cacheKey(href)) || null; }
/** Test-only: number of prefetch requests currently in flight. */
export function _prefetchInflightSize() { return prefetchInflight.size; }
/** Test-only: clear all prefetch state between cases. */
export function _resetPrefetch() {
  prefetchCache.clear();
  prefetchInflight.clear();
  prefetchQueue.length = 0;
  prefetchQueued.clear();
  clearPrefetchHover();
}

/** Test-only: read the monotonic navigation-token counter. */
export function _navToken() { return currentNavigationToken; }
/** Test-only: bump the navigation-token counter (simulates a fresh nav). */
export function _bumpNavToken() { return ++currentNavigationToken; }
/** Test-only: read the "current page URL" tracker (used for snapshot keying). */
export function _currentPageUrl() { return currentPageUrl; }
/** Test-only: set the tracker (simulates being on a specific page). */
export function _setCurrentPageUrl(u) { currentPageUrl = u; }

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

// Auto-enable on import (standard Turbo-Drive convention). Placed last so
// every top-level binding the router touches (notably the prefetch state)
// is initialised before enableClientRouter() runs.
enableClientRouter();
