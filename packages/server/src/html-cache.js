/**
 * Server HTML response cache with TTL and on-demand revalidation: the
 * no-build equivalent of Next.js's Full Route Cache + ISR.
 *
 * A fully-static / inert route re-runs the entire SSR pipeline (layout
 * chain, renderToString, metadata merge, importmap splice) on every
 * request even though it proves identical HTML each time. This module
 * caches the rendered HTML in the existing pluggable store
 * (`getStore()` / `memoryStore` in dev, `redisStore` when configured)
 * under a namespaced key, and serves it WITHOUT re-running the page
 * function on a hit within the revalidation window.
 *
 * SAFETY: caching is OPT-IN and conservative. A wrongly-cached per-user
 * page served to the wrong visitor is a data leak, so the page author
 * MUST opt in by declaring a revalidation window, and the framework
 * applies several defense-in-depth guards before it stores anything.
 *
 * The opt-in trigger is `export const revalidate = N` (seconds) on the
 * page module (the Next idiom, read once cheaply before the cache lookup).
 * The contract: declaring `revalidate` is the author asserting "this page
 * is the same for everyone for N seconds". A page that reads `cookies()` /
 * a session (per-user output) MUST NOT set `revalidate`.
 *
 * @module html-cache
 */

import { getStore } from './cache.js';
import { STREAM_MARKER } from './conditional-get.js';
import { createHash } from 'node:crypto';
import { publishedBuildId } from './importmap.js';
import { dynamicAccessed } from './context.js';

/** Namespace prefix for every cached-HTML key, so a flush can target it. */
const KEY_PREFIX = 'webjs:html:';

/**
 * Internal response header `ssrPage` stamps on a render that opted into the
 * HTML cache (its value is the revalidate TTL in seconds). The response
 * funnel reads it, re-checks the guards against the FINAL response (after
 * segment middleware, which may have appended a per-user Set-Cookie the SSR
 * side could not see), writes the cache, and strips the marker so it never
 * reaches the client. Mirrors the BUFFERED / STREAM marker pattern.
 */
export const HTML_CACHE_MARKER = 'x-webjs-html-cache';

/**
 * Generation counter folded into every key namespace. `revalidateAll()`
 * bumps it so every previously-cached HTML entry becomes unreachable in one
 * step (the CacheStore interface has no key-scan primitive, so a global
 * clear cannot enumerate keys), and the store TTL eventually reclaims the
 * orphaned entries. A single process clears its own memory store this way
 * synchronously; a Redis-backed multi-process deploy bumps per process and
 * leans on the TTL for the rest (a best-effort global flush).
 */
let _generation = 0;

/**
 * A fingerprint of the served app source, folded into every cache key (#318).
 * The published build id keys on the IMPORTMAP (core + vendor) only, so a deploy
 * that changes ONLY an app module's bytes does not move it, and a Redis-cached
 * `revalidate` page survives that deploy still serving its baked-in OLD `?v`
 * boot URLs (under #243 immutable caching those then content-address to stale
 * bytes). dev.js sets this to a deterministic, location-independent digest of
 * the browser-bound file set's content hashes (PROD only; '' in dev, where
 * fs.watch handles staleness), so an app-source-changing deploy re-keys (a fresh
 * render) while a no-change redeploy keeps the key (a warm cache survives). The
 * client-router build id deliberately stays importmap-only: a partial-swap
 * fragment already carries the new `?v` boot URLs, so app updates propagate on
 * the next navigation without a destructive hard reload.
 *
 * @type {string}
 */
let _appSourceFp = '';

/**
 * Set the app-source fingerprint folded into the HTML cache key (see
 * `_appSourceFp`). Called by dev.js from `ensureReady` after the browser-bound
 * file set + asset hashes are known, and again on each rebuild. The input is a
 * deterministic, location-independent STRING (sorted `relpath:contentHash`
 * lines); it is digested to a short hex so the key stays compact. An empty
 * input clears the fingerprint (the key collapses to its prior shape).
 *
 * @param {string} raw
 * @returns {void}
 */
export function setAppSourceFingerprint(raw) {
  _appSourceFp = raw ? createHash('sha256').update(raw).digest('hex').slice(0, 16) : '';
}

/**
 * Read the revalidation window (seconds) a page module opted into via
 * `export const revalidate = N` (the Next idiom). Returns a positive finite
 * number of seconds, or `null` when the page did not opt in (the default:
 * no server HTML caching, current behavior).
 *
 * `revalidate = 0`, a negative, NaN, Infinity, or a non-number is treated
 * as "no caching" (opt-out), matching the Next semantics where 0 means
 * always-dynamic. The trigger is the page-module export ONLY (read once,
 * cheaply, before the cache lookup), so a per-user page that never declares
 * it is never cached.
 *
 * @param {Record<string, any> | null | undefined} pageModule
 * @returns {number | null}
 */
export function readRevalidate(pageModule) {
  const raw = pageModule ? pageModule.revalidate : undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * The cache key for a request: the FULL URL (path + search string), since
 * `searchParams` change page output. Normalized to path + sorted query so
 * `?a=1&b=2` and `?b=2&a=1` share an entry. Two more discriminators are
 * folded into the namespace:
 *
 *  - the in-process generation, so `revalidateAll()` (a generation bump)
 *    makes every prior key unreachable in one step;
 *  - the published build id (the importmap fingerprint), so a NEW DEPLOY
 *    naturally writes and reads under fresh keys. The cached HTML bakes the
 *    deploy's `data-webjs-build` importmap into its boot script, so a Redis
 *    store that survives a deploy must NOT let a v2 process serve a v1-body
 *    (resolving modules against stale vendor URLs);
 *  - the app-source fingerprint (#318), so a deploy that changes ONLY an app
 *    module's bytes (which does not move the importmap build id) also re-keys,
 *    instead of serving a cached body with stale `?v` boot URLs. Together the
 *    build id (vendor) and the app-source fingerprint (app modules) mean ANY
 *    deploy that changes the served output re-keys, while a no-change redeploy
 *    keeps every key so a warm cache survives.
 *
 * @param {URL} url
 * @returns {string}
 */
export function htmlCacheKey(url) {
  const params = [...url.searchParams.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  const search = params.length
    ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&')
    : '';
  const build = publishedBuildId() || 'nobuild';
  // The app-source fingerprint (#318) re-keys on an app-module-only deploy that
  // the importmap-only build id misses. Empty (dev / no fingerprint) collapses
  // to the prior key shape, so an unconfigured app is byte-identical.
  const appfp = _appSourceFp ? `${_appSourceFp}:` : '';
  return `${KEY_PREFIX}${build}:${appfp}${_generation}:${url.pathname}${search}`;
}

/**
 * Read a cached HTML entry for a URL. Returns the parsed record (body +
 * the headers needed to faithfully rebuild the response) or null on a
 * miss / expiry / parse error (fail open to a fresh render).
 *
 * @param {URL} url
 * @returns {Promise<{ body: string, contentType: string, cacheControl: string, status: number } | null>}
 */
export async function readHtmlCache(url) {
  try {
    const raw = await getStore().get(htmlCacheKey(url));
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || typeof rec.body !== 'string') return null;
    return rec;
  } catch {
    return null;
  }
}

/**
 * Store a rendered HTML response for a URL with TTL = revalidate seconds.
 * Best-effort: a store error never affects the live response.
 *
 * @param {URL} url
 * @param {{ body: string, contentType: string, cacheControl: string, status: number }} rec
 * @param {number} revalidateSeconds
 */
export async function writeHtmlCache(url, rec, revalidateSeconds) {
  try {
    await getStore().set(htmlCacheKey(url), JSON.stringify(rec), revalidateSeconds * 1000);
  } catch {
    /* a store write failure must never crash the response */
  }
}

/**
 * Decide whether a freshly-rendered Response is SAFE to cache. This is the
 * defense-in-depth gate that runs AFTER the page opted in via `revalidate`.
 * Returns true only when every guard passes:
 *
 *  - status 200 (an error / redirect / 404 is request-specific)
 *  - NOT a streamed Suspense body (it cannot be buffered cheaply, and an
 *    unflushed stream has no stable bytes to cache)
 *  - NO non-framework Set-Cookie. A page that sets a session / per-user
 *    cookie is per-user output and must not be shared. The framework's own
 *    CSRF cookie (`webjs_csrf`) is allowed and re-minted per response on a
 *    cache hit, so its presence does not block caching.
 *  - CSP is OFF. With CSP enabled the inline boot script carries a fresh
 *    per-request nonce, so the body varies per request and a cached body
 *    would replay a stale nonce that the response's CSP header rejects.
 *
 * @param {Response} res
 * @param {{ cspEnabled?: boolean }} [guards]
 * @returns {boolean}
 */
export function isCacheableResponse(res, guards = {}) {
  if (res.status !== 200) return false;
  if (res.headers.has(STREAM_MARKER)) return false;
  if (guards.cspEnabled) return false;
  if (hasNonFrameworkSetCookie(res)) return false;
  return true;
}

/**
 * True when the response carries a Set-Cookie OTHER than the framework's
 * own CSRF cookie. Reads each cookie individually via `getSetCookie()`, the
 * only correct way to enumerate multiple Set-Cookie values (a combined
 * `get('set-cookie')` cannot be split safely, since a cookie value or an
 * Expires date can contain a comma). When `getSetCookie` is unavailable
 * (a runtime older than Node 24) this FAILS SAFE: it reports a
 * non-framework cookie (do not cache) rather than parsing only the first of
 * a combined header and wrongly judging it framework-only.
 *
 * @param {Response} res
 * @returns {boolean}
 */
function hasNonFrameworkSetCookie(res) {
  const h = res.headers;
  if (typeof h.getSetCookie !== 'function') {
    // No reliable per-cookie enumeration: fail safe (treat as per-user).
    return h.has('set-cookie');
  }
  for (const c of h.getSetCookie()) {
    const name = c.split('=', 1)[0].trim().toLowerCase();
    if (name !== 'webjs_csrf') return true;
  }
  return false;
}

/**
 * Evict the cached HTML for one path (server-side, on-demand
 * revalidation: the no-build ISR revalidation hook). A server action that
 * mutates the data a cached page renders calls this so the next request
 * re-renders. Distinct from the client-side `revalidate()` (which evicts
 * the browser snapshot cache).
 *
 * The path may include a search string. A bare path with no query evicts
 * ONLY the no-query entry; pass the exact `path?query` to target a
 * specific query variant, or call `revalidateAll()` to clear everything.
 *
 * @param {string} path  e.g. '/blog' or '/blog?page=2'
 * @returns {Promise<void>}
 */
export async function revalidatePath(path) {
  if (typeof path !== 'string' || !path) return;
  // Build the same normalized key readHtmlCache / writeHtmlCache produce.
  let url;
  try {
    url = new URL(path, 'http://internal.invalid');
  } catch {
    return;
  }
  try {
    await getStore().delete(htmlCacheKey(url));
  } catch {
    /* a store delete failure is non-fatal: the TTL still expires the entry */
  }
}

/**
 * Response-funnel step (#241): if the response carries the HTML_CACHE_MARKER
 * (the SSR opted it into caching), re-check every guard against the FINAL
 * response and, when it passes, buffer the body and store it under the URL
 * key with TTL = the marked revalidate seconds. Always strips the marker so
 * it never reaches the client. Returns the same response (the marker removal
 * mutates its headers in place). Best-effort: any failure leaves the live
 * response untouched. The CSP guard was already applied on the SSR side (the
 * marker is only stamped when CSP is off), so it is not re-checked here.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function commitHtmlCache(req, res, url) {
  const marker = res.headers.get(HTML_CACHE_MARKER);
  if (!marker) return res;
  res.headers.delete(HTML_CACHE_MARKER);
  const revalidateSeconds = Number(marker);
  if (!Number.isFinite(revalidateSeconds) || revalidateSeconds <= 0) return res;
  // Per-user leak defense (#241). The page set `revalidate` (asserting "same
  // for everyone"), but if the render actually read per-user request state
  // (cookies() / headers() / getSession()), its body varies by visitor and
  // must NOT be cached, even though it set no new Set-Cookie. Fail safe (skip
  // caching) and warn the author ONCE per path so the wrong `revalidate` is
  // visible without spamming the log.
  if (dynamicAccessed()) {
    warnDynamicRevalidateOnce(url.pathname);
    return res;
  }
  // Re-check status / streaming / cookie guards against the final response.
  if (!isCacheableResponse(res)) return res;
  try {
    const body = await res.clone().text();
    await writeHtmlCache(
      url,
      {
        body,
        contentType: res.headers.get('content-type') || 'text/html; charset=utf-8',
        cacheControl: res.headers.get('cache-control') || 'no-store',
        status: res.status,
      },
      revalidateSeconds,
    );
  } catch {
    /* a buffer / store failure must never affect the live response */
  }
  return res;
}

/**
 * Paths already warned about a `revalidate` on a per-user page, so the
 * console.warn fires once per offending route rather than once per request.
 * @type {Set<string>}
 */
const _warnedDynamicPaths = new Set();

/** @param {string} pathname */
function warnDynamicRevalidateOnce(pathname) {
  if (_warnedDynamicPaths.has(pathname)) return;
  _warnedDynamicPaths.add(pathname);
  console.warn(
    `[webjs] not caching ${pathname}: it exported \`revalidate\` but read ` +
    `per-user request state (cookies() / headers() / getSession()) during ` +
    `render, so its output varies by visitor. Remove \`revalidate\` from a ` +
    `per-user page, or stop reading request state if it is the same for ` +
    `everyone. The page is being served fresh (uncached) to avoid a leak.`
  );
}

/** Evict ALL cached HTML for this process. @returns {void} */
export function revalidateAll() {
  _generation++;
}

/** Internal: current generation, folded into keys by `htmlCacheKey`. */
export function htmlCacheGeneration() {
  return _generation;
}
