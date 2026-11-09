import { cspNonce, renderToString, isRedirect } from '@webjsdev/core';
import { headerSafeLocation } from '../redirect-location.js';
import { BUFFERED_MARKER, STREAM_MARKER } from '../conditional-get.js';
import { publishedBuildId, appSourceId } from '../importmap.js';
import { escapeAttr, escapeHtml } from './escape.js';

/**
 * Turning rendered HTML into a Response: the per-request CSP nonce read and
 * the three builders (cached, buffered and streaming).
 *
 * Split off render.js, which owns the RENDER. Nothing here renders anything;
 * it decides status, headers and framing for bytes it is handed.
 */

/**
 * The CSP nonce for the in-flight request, or undefined if none is in
 * scope. Delegates to `cspNonce()`, which returns the per-request nonce
 * the handler MINTED when CSP is enabled (issue #233), or, as a fallback,
 * the nonce parsed from an inbound `Content-Security-Policy` request
 * header (a proxy that mints its own). Using the same source as the
 * `Content-Security-Policy` response header is what guarantees the inline
 * boot script, the importmap, the modulepreload hints, and the header all
 * carry the EXACT same nonce: one minted value, no drift. The value comes
 * from the request-scoped AsyncLocalStorage store, so it takes no request.
 *
 * @returns {string | undefined}
 */
export function getNonce() {
  return cspNonce() || undefined;
}

/**
 * Rebuild a Response from a cached HTML record (#241). The stored body is
 * the stable per-page HTML; the per-response varying bits are re-minted
 * here so a new visitor still gets them: the published build id is re-read so
 * a post-deploy client sees the current id. No cookie is set (action CSRF is
 * an Origin / Sec-Fetch-Site check), which is what keeps a cached page
 * cookieless and shareable. The BUFFERED marker opts the cached body into
 * the conditional-GET funnel exactly as a fresh render does, so a cached
 * PUBLIC-cacheable page still 304s. Output is observably identical to the
 * fresh render of the same route within the window.
 *
 * @param {{ body: string, contentType: string, cacheControl: string, status: number }} rec
 * @param {Request | undefined} req
 * @param {URL | undefined} url
 */
export function cachedHtmlResponse(rec, req, url) {
  const headers = new Headers({ 'content-type': rec.contentType });
  headers.set('cache-control', rec.cacheControl);
  headers.set('x-webjs-build', publishedBuildId());
  headers.set('x-webjs-src', appSourceId());
  headers.set(BUFFERED_MARKER, '1');
  return new Response(rec.body, { status: rec.status, headers });
}

/**
 * Build an HTML Response. Sets no cookie: action CSRF is an Origin /
 * Sec-Fetch-Site check, so the page response is cookieless (CDN-cacheable).
 * @param {string} html
 * @param {number} status
 * @param {Request | undefined} req
 * @param {URL | undefined} url
 * @param {Record<string, any>} [metadata]
 */
export function htmlResponse(html, status, req, url, metadata) {
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  // Default: no caching. Pages are dynamic by default: the developer opts in
  // explicitly via metadata.cacheControl. No non-200 guard here, unlike
  // streamingHtmlResponse: every caller of THIS builder passes no metadata, so
  // the value is already the no-store default and a guard would be dead code.
  headers.set('cache-control', metadata?.cacheControl || 'no-store');
  // X-Webjs-Build carries the published build id so the client
  // router can detect post-deploy importmap changes on EVERY
  // response, including the X-Webjs-Have partial responses that
  // omit the head entirely. Empty until the map is authoritatively
  // final, so a warming response is reload-safe. See router-client.js
  // applySwap and publishedBuildId() in importmap.js.
  headers.set('x-webjs-build', publishedBuildId());
  headers.set('x-webjs-src', appSourceId());
  // Buffered (string) body: opt into the conditional-GET funnel.
  // A cacheable page (metadata.cacheControl) gets a weak ETag + 304. The
  // funnel excludes only the no-store default; a `private` page IS validated,
  // which is what keeps the router's partial responses cheap (#1140).
  // See conditional-get.js.
  headers.set(BUFFERED_MARKER, '1');
  return new Response(noindexErrorPage(html, status), { status, headers });
}

/**
 * A 404, 403 or 401 page is not something to index, so, as Next.js does for
 * every not-found page (#1686), it carries `<meta name="robots"
 * content="noindex">` unless the app set robots metadata itself. Inserted
 * before `</head>`, so a boundary inside the layouts and a `global-not-found`
 * that writes its own document are covered alike.
 * @param {string} html @param {number} status
 */
export function noindexErrorPage(html, status) {
  if (status !== 404 && status !== 403 && status !== 401) return html;
  if (typeof html !== 'string' || /<meta\s[^>]*name=["']?robots/i.test(html)) return html;
  const at = html.indexOf('</head>');
  return at < 0 ? html : html.slice(0, at) + '<meta name="robots" content="noindex">' + html.slice(at);
}

/**
 * Build a streaming Response. Degrades to a single-flush response when
 * there are no pending Suspense boundaries.
 *
 * @param {string} prefix
 * @param {string} bodyHtml
 * @param {string} closer
 * @param {{ pending: {id: string, promise: Promise<unknown>}[], nextId: number }} ctx
 * @param {number} status
 * @param {Request | undefined} req
 * @param {URL | undefined} url
 * @param {Record<string, any>} [metadata]
 * @param {string} [nonce]
 * @param {boolean} [dev]  dev surfaces a streamed-boundary error message; prod stays silent
 * @param {(e: unknown) => Promise<string | null>} [accessFallback] the markup of the
 *   nearest not-found / forbidden / unauthorized boundary for such a throw, else null
 */
export function streamingHtmlResponse(prefix, bodyHtml, closer, ctx, status, req, url, metadata, nonce, dev, accessFallback) {
  const encoder = new TextEncoder();
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  // Default: no caching. Pages are dynamic by default: the developer
  // opts in to caching explicitly via metadata.cacheControl. A non-200 does
  // NOT inherit it (#1140): the form-action re-render is a 422 carrying the
  // submitter's own field values and errors, which must never be handed to a
  // shared cache just because the page opted into public caching.
  headers.set('cache-control', status === 200 ? (metadata?.cacheControl || 'no-store') : 'no-store');
  // See htmlResponse: published build id on every response for the
  // client router's importmap-mismatch detection on partial swaps.
  headers.set('x-webjs-build', publishedBuildId());
  headers.set('x-webjs-src', appSourceId());

  if (!ctx.pending.length) {
    // No pending boundaries: this degrades to a single buffered (string)
    // flush, so opt it into the conditional-GET funnel like htmlResponse.
    headers.set(BUFFERED_MARKER, '1');
    return new Response(prefix + bodyHtml + closer, { status, headers });
  }

  // Flag a genuinely streamed body so the conditional-GET funnel skips it
  // (an unflushed stream cannot be hashed without buffering, which would
  // defeat streaming). The marker is internal and stripped at the funnel
  // before the response reaches the client. See conditional-get.js.
  headers.set(STREAM_MARKER, '1');

  const stream = new ReadableStream({
    async start(controller) {
      // Flush the shell (prefix + body with fallbacks) immediately, followed by
      // a shell-ready sentinel comment IN THE SAME chunk. The resolved boundary
      // templates and the `</body></html>` closer are emitted LATER (after the
      // slow data settles), so without this sentinel a streaming soft-nav client
      // could not tell "shell complete, awaiting the slow boundary" from "shell
      // still arriving" and would block its progressive swap until the slow
      // boundary (#473). The comment is inert for the native initial-load parse.
      controller.enqueue(encoder.encode(prefix + bodyHtml + '<!--wj-stream-shell-->'));
      let noindexSent = /<meta\s[^>]*name=["']?robots/i.test(prefix);
      try {
        // Loop: resolve all currently-pending promises in parallel; nested
        // Suspense inside resolved content adds more pending entries.
        while (ctx.pending.length) {
          const batch = ctx.pending.slice();
          ctx.pending.length = 0;
          const settled = await Promise.all(
            batch.map(async (p) => {
              try {
                const resolved = await p.promise;
                const sub = { pending: [], nextId: ctx.nextId, dev: ctx.dev };
                // A fresh scan that cannot see the shell the boundary sits in.
                // That used to require carrying the boundary's form scope
                // (#1207), or a `<button formaction=${fn}>` inside a bound
                // form's boundary read as form-less, was refused, and the catch
                // below turned it into an empty boundary on a 200 in
                // production. #1307 made a bound submitter self-sufficient, so
                // there is nothing left to carry.
                const html = await renderToString(resolved, { ssr: true, suspenseCtx: sub });
                ctx.nextId = sub.nextId;
                for (const n of sub.pending) ctx.pending.push(n);
                return { id: p.id, html };
              } catch (e) {
                // A redirect() thrown inside a streamed boundary arrives after
                // the 200 is sent, so it becomes a client redirect, as Next.js
                // does (#1686): a marker the soft-navigation path follows, plus
                // a refresh and a script for a first load (below).
                if (isRedirect(e)) {
                  const to = headerSafeLocation(/** @type {any} */ (e).url);
                  return { id: p.id, html: `<meta data-webjs-redirect="${escapeAttr(to)}">`, redirect: to };
                }
                // notFound() / forbidden() / unauthorized() after the 200 went
                // out: the nearest boundary renders in place of the streamed
                // content and the page is marked noindex, as Next.js documents
                // ("keeps its 200 status. Next.js adds a noindex tag", #1686).
                if (accessFallback) {
                  const fb = await accessFallback(e);
                  if (fb !== null) return { id: p.id, html: fb, noindex: true };
                }
                // Match the SSR error-isolation policy (render-server.js's
                // defaultSSRErrorTemplate): dev surfaces the message so the
                // failure is obvious, prod stays SILENT so no internal detail
                // (a DB error, a stack-derived path) leaks to the client (#478).
                const msg = e instanceof Error ? e.message : String(e);
                const html = dev ? `<p>error: ${escapeHtml(msg)}</p>` : '';
                return { id: p.id, html };
              }
            })
          );
          for (const r of settled) {
            if (r.noindex && !noindexSent) {
              noindexSent = true;
              const n = nonce ? ` nonce="${escapeAttr(nonce)}"` : '';
              controller.enqueue(encoder.encode(
                `<meta name="robots" content="noindex">` +
                `<script${n}>document.head.insertAdjacentHTML('beforeend','<meta name="robots" content="noindex">')</script>`,
              ));
            }
            // Emit just the <template>: the MutationObserver-based resolver
            // in the boot script detects it and swaps it into the placeholder.
            // Falls back to the __webjsResolve global for browsers without MO.
            // The fallback <script> carries the request's CSP nonce so
            // strict-CSP enforcement passes. Browsers that support
            // MutationObserver (all evergreen) handle the swap via the
            // boot script's observer and skip this fallback; the
            // <script> is here for legacy / extremely-restrictive
            // environments. Either way it must be nonce-signed.
            const scriptNonce = nonce ? ` nonce="${escapeAttr(nonce)}"` : '';
            const go = r.redirect
              ? `<meta http-equiv="refresh" content="0;url=${escapeAttr(r.redirect)}">`
                + `<script${scriptNonce}>location.replace(${JSON.stringify(r.redirect).replace(/</g, '\\u003c')})</script>`
              : '';
            const chunk =
              `<template data-webjs-resolve="${r.id}">${r.html}</template>` +
              `<script${scriptNonce}>window.__webjsResolve&&__webjsResolve("${r.id}")</script>` + go;
            controller.enqueue(encoder.encode(chunk));
          }
        }
      } finally {
        controller.enqueue(encoder.encode(closer));
        controller.close();
      }
    },
  });
  return new Response(stream, { status, headers });
}
