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
 * `?a=1&b=2` and `?b=2&a=1` share an entry. The current generation is
 * folded into the namespace so `revalidateAll()` (a generation bump) makes
 * every prior key unreachable in one step.
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
  return `${KEY_PREFIX}${_generation}:${url.pathname}${search}`;
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
 * own CSRF cookie. A getSetCookie()-capable runtime is read directly; a
 * fallback parses the single combined header. Conservative: an
 * unparseable cookie counts as non-framework (do not cache).
 *
 * @param {Response} res
 * @returns {boolean}
 */
function hasNonFrameworkSetCookie(res) {
  /** @type {string[]} */
  let cookies = [];
  const h = res.headers;
  if (typeof h.getSetCookie === 'function') {
    cookies = h.getSetCookie();
  } else {
    const single = h.get('set-cookie');
    if (single) cookies = [single];
  }
  for (const c of cookies) {
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

/** Evict ALL cached HTML for this process. @returns {void} */
export function revalidateAll() {
  _generation++;
}

/** Internal: current generation, folded into keys by `htmlCacheKey`. */
export function htmlCacheGeneration() {
  return _generation;
}
