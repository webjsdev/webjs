/**
 * RFC 7232 conditional GET (ETag + If-None-Match -> 304).
 *
 * One shared funnel that, given a Request and the buffered Response the
 * pipeline produced, attaches a content-hash `ETag` when the response is
 * cacheable and missing one, then turns a matching `If-None-Match` into a
 * `304 Not Modified` with no body. Wired once at the response funnel in
 * `dev.js`'s `handle()`, so it covers SSR HTML pages, static assets, app
 * source modules, vendor / core runtime modules, and route-handler bodies
 * uniformly.
 *
 * What is EXCLUDED, and why:
 *   - `no-store` / `private` responses (the default for dynamic, per-user
 *     pages). Never enable a cross-session 304 on private content: a shared
 *     cache keyed on the URL could serve one user's validator to another.
 *   - Streaming bodies (a Suspense response with pending boundaries). The
 *     bytes are not yet materialised, so there is nothing cheap to hash; the
 *     stream is left untouched. Such a response is flagged with the
 *     `X-Webjs-Stream: 1` header by the SSR pipeline; this funnel skips it and
 *     strips the marker. Streaming responses are not conditional-GET cached,
 *     by design.
 *   - Non-GET / non-HEAD methods, and any status other than 200. A validator
 *     is only meaningful for a successful, replayable read.
 *
 * The ETag is computed over the response's OWN body bytes, so an identical
 * body yields an identical ETag across requests. Per-response varying bits
 * that ride RESPONSE HEADERS (the `x-webjs-build` id, a `set-cookie` CSRF
 * token, the CSP nonce on the header) are NOT part of the body hash, so they
 * do not destabilise the ETag. The one body-level varying input is the CSP
 * nonce stamped INTO the inline boot script: when CSP is enabled the HTML
 * body changes every request, so its ETag changes every request and a 304 is
 * simply never produced for that page (correct, not a bug). CSP is off by
 * default, so the common case has a stable body and a stable ETag.
 *
 * @module conditional-get
 */

import { digestHex } from './crypto-utils.js';

/**
 * Headers that must not ride a 304 response (it has no body). Everything
 * else (ETag, Cache-Control, Vary, the framework's X-Webjs-Build /
 * X-Request-Id, Set-Cookie) is preserved so a shared cache and the client
 * router behave identically to a 200.
 */
const STRIP_ON_304 = ['content-length', 'content-encoding', 'content-type'];

/**
 * Is this response cacheable enough to carry a validator?  Cacheable means a
 * 200 whose `Cache-Control` is present and does not forbid storage. A
 * `no-store` or `private` response is excluded (private / per-user content
 * must never get a cross-session 304). `no-cache` is INCLUDED: it means
 * "revalidate before reuse", and a 304 is exactly that revalidation answer,
 * so dev's `no-cache` assets still benefit.
 *
 * @param {Response} res
 * @returns {boolean}
 */
function isCacheable(res) {
  if (res.status !== 200) return false;
  const cc = res.headers.get('cache-control');
  if (!cc) return false;
  return !/(?:^|,)\s*(?:no-store|private)\s*(?:,|$)/i.test(cc);
}

/**
 * Parse an `If-None-Match` request header and test it against an ETag.
 * Honors the `*` wildcard and a comma-separated list, and compares
 * weak-insensitively (a `W/` prefix on either side is ignored for the
 * comparison, per RFC 7232 weak-comparison semantics, which is the correct
 * function for `If-None-Match`).
 *
 * @param {string | null} header  the raw `If-None-Match` value
 * @param {string} etag  the response ETag, e.g. `"abc123"`
 * @returns {boolean}
 */
export function ifNoneMatchSatisfied(header, etag) {
  if (!header || !etag) return false;
  const want = stripWeak(etag);
  for (const raw of header.split(',')) {
    const tok = raw.trim();
    if (tok === '*') return true;
    if (stripWeak(tok) === want) return true;
  }
  return false;
}

/** @param {string} tag */
function stripWeak(tag) {
  return tag.startsWith('W/') ? tag.slice(2) : tag;
}

/**
 * Apply conditional-GET semantics to a finished, buffered Response.
 *
 * Returns either the same response (now possibly carrying an `ETag`) or, when
 * the request's `If-None-Match` matches, a fresh `304 Not Modified` with no
 * body and the validators / caching headers preserved. A streaming,
 * non-cacheable, or non-GET/HEAD response is returned unchanged.
 *
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 */
export async function applyConditionalGet(req, res) {
  const method = req.method.toUpperCase();
  // A genuinely streamed Suspense response is flagged by the SSR pipeline.
  // Strip the internal marker on the way out (it must never reach a client),
  // and skip conditional-GET entirely so the live stream is never consumed.
  if (res.headers.has('x-webjs-stream')) {
    res.headers.delete('x-webjs-stream');
    return res;
  }
  if (method !== 'GET' && method !== 'HEAD') return res;
  if (!isCacheable(res)) return res;

  let etag = res.headers.get('etag');
  if (!etag) {
    // Read the body bytes WITHOUT consuming the caller's response: clone
    // first. Every response reaching this point is buffered (the only
    // streaming path is flagged and returned above), so the clone is cheap.
    let bytes;
    try {
      bytes = new Uint8Array(await res.clone().arrayBuffer());
    } catch {
      // A body that refuses to buffer (should not happen for the branches we
      // gate to) is left without a validator rather than crashing the funnel.
      return res;
    }
    etag = `"${(await digestHex('SHA-1', bytes)).slice(0, 16)}"`;
    res.headers.set('etag', etag);
  }

  if (ifNoneMatchSatisfied(req.headers.get('if-none-match'), etag)) {
    const headers = new Headers(res.headers);
    for (const h of STRIP_ON_304) headers.delete(h);
    return new Response(null, { status: 304, headers });
  }
  return res;
}
