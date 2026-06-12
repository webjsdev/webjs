import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { renderToString, isNotFound, isRedirect, lookupModuleUrl, isLazy, cspNonce } from '@webjsdev/core';
import { importMapTag, vendorIntegrityFor, publishedBuildId, basePath, vendorPreconnectOrigins } from './importmap.js';
import { withBasePath } from './base-path.js';
import { withAssetHash } from './asset-hash.js';
import { jsonForScriptTag } from './script-tag-json.js';
import { readToken, newToken, cookieHeader } from './csrf.js';
import { transitiveDeps } from './module-graph.js';
import { BUFFERED_MARKER, STREAM_MARKER } from './conditional-get.js';
import {
  readRevalidate,
  readHtmlCache,
  HTML_CACHE_MARKER,
} from './html-cache.js';
import { requestedFrameId, extractFrameSubtree } from './frame-render.js';

/**
 * SSR a matched page route to a Response.
 *
 * Mirrors NextJs semantics:
 *   - Page + layout default exports can be async.
 *   - `metadata` named export on layouts/pages is merged (page > innermost layout > … > root).
 *   - `notFound()` and `redirect()` thrown anywhere in the chain are caught
 *     and converted to 404 or 3xx responses.
 *   - On a render error we walk up the chain looking for the nearest `error.js`
 *     and render that instead (falls back to a plain error page).
 *
 * @param {import('./router.js').PageRoute} route
 * @param {Record<string,string>} params
 * @param {URL} url
 * @param {{ dev: boolean, appDir: string, req?: Request, moduleGraph?: import('./module-graph.js').ModuleGraph, serverFiles?: Map<string,string> | Set<string>, actionData?: unknown, status?: number, pageModule?: Record<string, unknown>, cspEnabled?: boolean }} opts
 * @returns {Promise<Response>}
 */
export async function ssrPage(route, params, url, opts) {
  // Server HTML response cache (ISR for no-build, #241). OPT-IN: only a page
  // that declares `export const revalidate = N` is ever cached (the page
  // module export is the single trigger). The page module is loaded ONCE up
  // front to read that window
  // and is threaded back through `opts.pageModule` so renderChain reuses the
  // same evaluation (no double-load). A cache HIT serves the stored HTML
  // without re-running the page function. Skipped entirely (no opt-in read,
  // no double behaviour) for the page-action re-render (actionData / a non-200
  // status) and for a partial-nav request (X-Webjs-Have), whose bytes depend
  // on the request and must not be shared under the full-URL key.
  const cacheEligible =
    !opts.actionData &&
    !opts.status &&
    !opts.pageModule &&
    !(opts.req && opts.req.headers.get('x-webjs-have'));
  let revalidateSeconds = null;
  if (cacheEligible) {
    try {
      const pageMod = await loadModule(route.file, opts.dev);
      opts = { ...opts, pageModule: pageMod };
      revalidateSeconds = readRevalidate(pageMod);
      if (revalidateSeconds !== null) {
        const hit = await readHtmlCache(url);
        if (hit) return cachedHtmlResponse(hit, opts.req, url);
      }
    } catch {
      // A load / store failure falls through to a normal fresh render: the
      // cache is an optimization, never a correctness dependency. Leave
      // revalidateSeconds as read so the write path still applies when the
      // page loaded but only the store lookup failed.
    }
  }

  const ctx = {
    params,
    searchParams: Object.fromEntries(url.searchParams.entries()),
    url: url.toString(),
    // Populated only when this render is the re-render after a failed page
    // `action` submission (#244). The page function and every layout receive
    // it so they can surface field errors and repopulate inputs from the
    // user's submitted values. Undefined on a normal GET render, so GET output
    // is byte-identical to before this feature.
    actionData: opts.actionData,
  };

  // Collect metadata across layouts (outermost first) then page.
  const metadata = await collectMetadata(route, ctx, opts.dev);

  try {
    const suspenseCtx = { pending: [], nextId: 1, usedComponents: new Set(), dev: opts.dev };
    // Parse the partial-nav "have" header from the client. The header
    // lists comma-separated marker paths the client already has rendered
    // in its DOM. The server walks the target route's layout chain
    // innermost → outermost and SHORT-CIRCUITS at the first match -
    // returning only the content below that layout, wrapped in the
    // matched layout's marker pair. Real wire-byte savings: the outer
    // layouts' HTML is never re-serialized for same-shell navigations.
    const haveHeader = opts.req?.headers.get('x-webjs-have') || '';
    const have = haveHeader
      ? new Set(haveHeader.split(',').map((s) => s.trim()).filter(Boolean))
      : null;
    const body = await renderChain(route, ctx, opts.dev, suspenseCtx, have, opts.pageModule);

    // Frame subtree render (#253). A `<webjs-frame src>` self-load (or a
    // click-driven frame nav) sends `x-webjs-frame: <id>` and applies ONLY the
    // matching `<webjs-frame id>` subtree from the response, discarding the rest
    // of the page. So when that header is present AND the requested frame is in
    // the rendered output (the "isolable" case), return JUST that subtree: the
    // bytes are extracted verbatim from the same full render, so the result is
    // BYTE-EQUIVALENT to what the client would slice from a full-page response,
    // but the full document shell + all the other regions never go on the wire.
    // The frame swap path (applySwap in router-client.js) parses this body and
    // does `doc.querySelector('webjs-frame#<id>')`, which finds the lone
    // subtree exactly as it would in the full page. A streamed (Suspense)
    // render is skipped (its bytes are not yet final). When the frame id is NOT
    // found (an auth redirect to a login page, a route that dropped the frame),
    // we fall through to the normal full-page render, where the client's
    // existing `webjs:frame-missing` fallback handles the absence. A request
    // with NO `x-webjs-frame` header never reaches this branch, so a normal
    // page request is byte-identical to before this feature.
    const frameId = requestedFrameId(opts.req);
    if (frameId && suspenseCtx.pending.length === 0) {
      const subtree = extractFrameSubtree(body, frameId);
      if (subtree !== null) {
        return htmlResponse(subtree, opts.status || 200, opts.req, url);
      }
    }
    // Module URLs for the page + every layout in its chain. These ride
    // the importmap; the browser fetches each file as it walks the
    // import graph. Combined with the modulepreload hints below, this
    // is the Rails 7+ / Hotwire pattern: per-file ESM, no bundling,
    // HTTP/2 multiplex on the wire.
    //
    // Inert route modules (a page or layout that does no client work, even
    // transitively) are dropped from the boot script: the browser never
    // downloads them. The SSR'd HTML is the complete output, and
    // progressive enhancement is unaffected, so a fully-static route ships
    // zero application JS. The analysis is conservative (anything that
    // touches the client router, a signal, an event, an npm import, or a
    // shipping component keeps shipping).
    const inert = opts.inertRouteModules;
    const moduleUrls = [route.file, ...route.layouts]
      .filter((f) => !(inert && inert.has(f)))
      .map((f) => toUrlPath(f, opts.appDir));
    // Emit <link rel="modulepreload"> for every custom element that
    // actually rendered PLUS their transitive dependencies (from the
    // module graph). URLs are deduplicated so the browser never sees
    // the same preload twice. Lazy components are excluded from
    // preloads and instead loaded via IntersectionObserver when they
    // enter the viewport.
    const { eager: eagerComponents, lazy: lazyComponents } =
      componentPreloads(suspenseCtx.usedComponents, opts.appDir, opts.elidableComponents);
    const preloads = deduplicatedPreloads(
      eagerComponents,
      moduleUrls,
      opts.moduleGraph,
      [route.file, ...route.layouts],
      opts.appDir,
      opts.serverFiles,
      opts.elidableComponents,
    );
    // Extract CSP nonce from request headers (if present).
    const nonce = opts.req ? getNonce(opts.req) : undefined;
    const wrapOpts = {
      metadata,
      moduleUrls,
      dev: opts.dev,
      streaming: suspenseCtx.pending.length > 0,
      preloads,
      lazyComponents,
      nonce,
    };
    // buildDocumentParts picks up a user-supplied <!doctype><html>…</html>
    // shell from the body when present; otherwise auto-emits the framework
    // shell. Either way the returned `prefix` ends just past the open <body>
    // and `closer` is the matching `</body></html>`.
    const { prefix, streamBody, closer } = buildDocumentParts(body, wrapOpts);
    const res = streamingHtmlResponse(
      prefix,
      streamBody,
      closer,
      suspenseCtx,
      // Normally 200. After a failed page `action` submission the caller passes
      // 422 (or another 4xx) so the re-rendered page with field errors carries
      // the right status for both the no-JS reload and the enhanced swap (#244).
      opts.status || 200,
      opts.req,
      url,
      metadata,
      nonce,
      opts.dev,
    );
    // Server HTML cache write (#241). The page opted in via `revalidate`, so
    // FLAG this candidate for the response funnel rather than writing here: the
    // store decision must see the FINAL response (after segment middleware,
    // which may append a per-user Set-Cookie this code can't see yet). The
    // funnel re-checks every guard via isCacheableResponse, writes the cache,
    // and strips this internal marker. The CSP guard is decided here (the SSR
    // side knows whether a nonce was stamped into the body).
    if (revalidateSeconds !== null && !opts.cspEnabled) {
      res.headers.set(HTML_CACHE_MARKER, String(revalidateSeconds));
    }
    return res;
  } catch (err) {
    if (isRedirect(err)) {
      const e = /** @type any */ (err);
      // A redirect thrown during a GET page/layout render is a GET-to-GET
      // navigation (an auth bounce, a gate). 302 Found is the conventional
      // code there, so it is the default when the caller did not pick one. An
      // explicit `redirect(url, status)` overrides it. (Action redirects, a
      // POST, default to 307 in page-action.js so the method is preserved.)
      return new Response(null, { status: e.status || 302, headers: { location: e.url } });
    }
    if (isNotFound(err)) {
      const html = await ssrNotFoundHtml(null, opts);
      return htmlResponse(html, 404, opts.req, url);
    }
    // APM / Sentry sink (issue #239): a page render error that becomes a 500
    // (an error.js boundary OR the default 500 page) is an unhandled error the
    // app should see in its error tracker. Report it best-effort BEFORE
    // rendering the boundary, so the sink gets the ORIGINAL error even if the
    // boundary itself swallows or transforms it. notFound / redirect are
    // sentinels (control flow), not errors, so they are excluded above.
    if (typeof opts.onError === 'function') {
      try { opts.onError(err); } catch { /* a throwing sink must not affect the response */ }
    }
    // Dev error overlay (#264): push a rich frame to the open tab so the
    // overlay appears live. Dev-only + best-effort; never affects the response.
    if (typeof opts.onDevError === 'function') {
      try { opts.onDevError(err); } catch { /* a throwing sink must not affect the response */ }
    }
    // Error paths still need to honor the request's CSP nonce so the
    // error page's boot scripts (when moduleUrls is non-empty) and
    // the meta csp-nonce tag both pass strict-CSP enforcement.
    const errNonce = opts.req ? getNonce(opts.req) : undefined;
    // Try nearest error.js (innermost → outermost).
    for (let i = route.errors.length - 1; i >= 0; i--) {
      try {
        const mod = await loadModule(route.errors[i], opts.dev);
        if (!mod.default) continue;
        const tree = await mod.default({ ...ctx, error: err });
        const body = await renderToString(tree, { ssr: true, dev: opts.dev });
        const moduleUrls = [route.file, ...route.layouts].map((f) => toUrlPath(f, opts.appDir));
        const html = wrapInDocument(body, { metadata, moduleUrls, dev: opts.dev, nonce: errNonce });
        return htmlResponse(html, 500, opts.req, url);
      } catch (nested) {
        // fall through to next error boundary
      }
    }
    // Default: dev shows stack, prod shows a terse message (no stack trace leaks).
    console.error('[webjs] unhandled render error:', err);
    const body = opts.dev
      ? `<h1>Server error</h1><pre style="white-space:pre-wrap">${escapeHtml(
          err instanceof Error ? err.stack || err.message : String(err)
        )}</pre>`
      : `<h1>Server error</h1><p>Something went wrong. Please try again.</p>`;
    return htmlResponse(
      wrapInDocument(body, { metadata, moduleUrls: [], dev: opts.dev, nonce: errNonce }),
      500,
      opts.req,
      url
    );
  }
}

/**
 * 404 response for unmatched routes.
 * @param {string | null} notFoundFile
 * @param {{ dev: boolean, appDir: string, req?: Request, url?: URL }} opts
 */
export async function ssrNotFound(notFoundFile, opts) {
  const html = await ssrNotFoundHtml(notFoundFile, opts);
  return htmlResponse(html, 404, opts.req, opts.url);
}

/**
 * Build an HTML Response and, if missing, attach the CSRF cookie.
 * @param {string} html
 * @param {number} status
 * @param {Request | undefined} req
 * @param {URL | undefined} url
 * @param {Record<string, any>} [metadata]
 */
function htmlResponse(html, status, req, url, metadata) {
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  // Default: no caching. Pages are dynamic by default: the developer
  // opts in to caching explicitly via metadata.cacheControl.
  headers.set('cache-control', metadata?.cacheControl || 'no-store');
  // X-Webjs-Build carries the published build id so the client
  // router can detect post-deploy importmap changes on EVERY
  // response, including the X-Webjs-Have partial responses that
  // omit the head entirely. Empty until the map is authoritatively
  // final, so a warming response is reload-safe. See router-client.js
  // applySwap and publishedBuildId() in importmap.js.
  headers.set('x-webjs-build', publishedBuildId());
  if (req && !readToken(req)) {
    const secure = url ? url.protocol === 'https:' : false;
    headers.append('set-cookie', cookieHeader(newToken(), { secure }));
  }
  // Buffered (string) body: opt into the conditional-GET funnel so a
  // PUBLIC-cacheable page (metadata.cacheControl) gets a weak ETag + 304.
  // The funnel still excludes the no-store default, so a private page is
  // never ETagged. See conditional-get.js.
  headers.set(BUFFERED_MARKER, '1');
  return new Response(html, { status, headers });
}

/**
 * Rebuild a Response from a cached HTML record (#241). The stored body is
 * the stable per-page HTML; the per-response varying bits are re-minted
 * here so a new visitor still gets them: the CSRF cookie is freshly issued
 * when the request lacks one (it is a Set-Cookie header, never part of the
 * cached body), and the published build id is re-read so a post-deploy
 * client sees the current id. The BUFFERED marker opts the cached body into
 * the conditional-GET funnel exactly as a fresh render does, so a cached
 * PUBLIC-cacheable page still 304s. Output is observably identical to the
 * fresh render of the same route within the window.
 *
 * @param {{ body: string, contentType: string, cacheControl: string, status: number }} rec
 * @param {Request | undefined} req
 * @param {URL | undefined} url
 */
function cachedHtmlResponse(rec, req, url) {
  const headers = new Headers({ 'content-type': rec.contentType });
  headers.set('cache-control', rec.cacheControl);
  headers.set('x-webjs-build', publishedBuildId());
  if (req && !readToken(req)) {
    const secure = url ? url.protocol === 'https:' : false;
    headers.append('set-cookie', cookieHeader(newToken(), { secure }));
  }
  headers.set(BUFFERED_MARKER, '1');
  return new Response(rec.body, { status: rec.status, headers });
}

/* ------------ internals ------------ */

async function ssrNotFoundHtml(notFoundFile, opts) {
  let body = '<h1>404: Not found</h1>';
  if (notFoundFile) {
    try {
      const mod = await loadModule(notFoundFile, opts.dev);
      if (mod.default) body = await renderToString(await mod.default({}), { ssr: true, dev: opts.dev });
    } catch (e) {
      body = `<h1>404: Not found</h1><pre>${escapeHtml(String(e))}</pre>`;
    }
  }
  const nonce = opts.req ? getNonce(opts.req) : undefined;
  return wrapInDocument(body, {
    metadata: { title: 'Not found' },
    moduleUrls: [],
    dev: opts.dev,
    nonce,
  });
}

async function renderChain(route, ctx, dev, suspenseCtx, have, pageModule) {
  // Reuse a caller-supplied page module when present (the page-action
  // re-render passes the exact module whose `action` just ran, so the
  // failure re-render shares that single evaluation instead of re-importing
  // and re-running the module's top-level side effects).
  const page = pageModule || await loadModule(route.file, dev);
  if (!page.default) throw new Error(`Page ${route.file} must have a default export`);
  let tree = await page.default(ctx);

  // If the route has a loading.ts file, wrap the page in a Suspense boundary
  // with the loading content as the fallback. This mirrors NextJs's automatic
  // Suspense wrapping when loading.tsx is present.
  if (route.loadings && route.loadings.length > 0) {
    // Use the innermost (closest) loading file
    const loadingFile = route.loadings[route.loadings.length - 1];
    try {
      const loadingMod = await loadModule(loadingFile, dev);
      if (loadingMod.default) {
        const { Suspense } = await import('@webjsdev/core');
        const fallback = await loadingMod.default(ctx);
        tree = Suspense({ fallback, children: Promise.resolve(tree) });
      }
    } catch { /* loading file failed: skip, render page directly */ }
  }

  // Wrap each layout's `${children}` interpolation in
  // `<!--wj:children:<segment-path>-->...<!--/wj:children-->` comment
  // markers. The client router walks both old + new DOM for these
  // markers and swaps only the children-slot of the deepest shared
  // layout: preserving outer-layout DOM (and the scroll position of
  // anything inside it: sidenavs, sticky headers, inner scroll
  // containers). Auto-derived from folder structure: no opt-in
  // required from layout authors.
  // X-Webjs-Have optimization: iterate from innermost → outermost and
  // SHORT-CIRCUIT at the first layout whose segment path the client
  // already has rendered. Wrap the accumulated inner tree in that
  // layout's marker pair (so the client can identify the splice
  // target) and return: outer layouts are not rendered at all,
  // saving CPU and wire bytes.
  for (let i = route.layouts.length - 1; i >= 0; i--) {
    const segmentPath = layoutSegmentPath(route.layouts[i]);
    if (have && have.has(segmentPath)) {
      tree = wrapWithChildrenMarker(tree, segmentPath);
      const body = await renderToString(tree, { ssr: true, suspenseCtx });
      return body + (await loadingTemplates(route, ctx, dev));
    }
    const mod = await loadModule(route.layouts[i], dev);
    if (!mod.default) continue;
    tree = await mod.default({
      ...ctx,
      children: wrapWithChildrenMarker(tree, segmentPath),
    });
  }
  const body = await renderToString(tree, { ssr: true, suspenseCtx });
  return body + (await loadingTemplates(route, ctx, dev));
}

/**
 * Render each `loading.{js,ts}` in the route's chain into a hidden
 * `<template id="wj-loading:<segment-path>">`. The client router clones
 * the deepest matching template into the swap slot on nav-start, giving
 * users an instant per-segment skeleton instead of stale content.
 *
 * Each loading file's segment path is the URL prefix it serves: same
 * derivation as layoutSegmentPath but stripping `loading.ext` instead.
 *
 * Errors loading a single file are swallowed so a broken loading.ts in
 * one segment doesn't break the whole response.
 *
 * @param {{ loadings?: string[] }} route
 * @param {Record<string,unknown>} ctx
 * @param {boolean} dev
 * @returns {Promise<string>}
 */
async function loadingTemplates(route, ctx, dev) {
  if (!route.loadings || route.loadings.length === 0) return '';
  /** @type {string[]} */
  const parts = [];
  for (const file of route.loadings) {
    try {
      const mod = await loadModule(file, dev);
      if (!mod.default) continue;
      const tree = await mod.default(ctx);
      const html = await renderToString(tree, { ssr: true, dev });
      const segmentPath = loadingSegmentPath(file);
      parts.push(`<template id="wj-loading:${segmentPath}">${html}</template>`);
    } catch { /* skip broken loading file */ }
  }
  return parts.join('');
}

/**
 * Like layoutSegmentPath but for `loading.{js,ts}` files. Strips the
 * `loading.ext` filename from the URL path under app/.
 *
 * @param {string} loadingFile
 * @returns {string}
 */
function loadingSegmentPath(loadingFile) {
  const p = loadingFile
    .replace(/^.*\/app\//, '')
    .replace(/\/?loading\.[jt]sx?$/, '');
  return p === '' ? '/' : '/' + p;
}

/**
 * Derive a layout's segment path from its file path. The path identifies
 * the layout's slot in the layout chain for partial-nav marker matching.
 *
 *   app/layout.ts                          → '/'
 *   app/docs/layout.ts                     → '/docs'
 *   app/docs/components/layout.ts          → '/docs/components'
 *   app/(marketing)/about/layout.ts        → '/(marketing)/about'
 *
 * Route groups `(marketing)` are KEPT in the path. They don't appear in
 * URLs but DO scope distinct layouts: two routes at the same URL prefix
 * served by different `(group)` layouts must produce different markers
 * so the client doesn't falsely identify them as a shared layout.
 *
 * @param {string} layoutFile  Absolute path to the layout source file.
 * @returns {string}
 */
function layoutSegmentPath(layoutFile) {
  const p = layoutFile
    .replace(/^.*\/app\//, '')
    .replace(/\/?layout\.[jt]sx?$/, '');
  return p === '' ? '/' : '/' + p;
}

/**
 * Wrap a TemplateResult-or-renderable child in the partial-nav children
 * marker pair. Returns a synthetic TemplateResult: server `renderToString`
 * walks `.strings` and `.values` exactly the same way as for the `html` tag.
 *
 * The marker text lives in `strings` (static template parts), NOT in
 * `values`: `values` get HTML-escaped on render, comments wouldn't survive.
 *
 * @param {unknown} tree  A TemplateResult, string, array, or Promise.
 * @param {string} segmentPath  The layout's segment path, used as marker id.
 * @returns {{ _$webjs: 'template', strings: string[], values: unknown[] }}
 */
function wrapWithChildrenMarker(tree, segmentPath) {
  return {
    _$webjs: 'template',
    strings: [
      `<!--wj:children:${segmentPath}-->`,
      `<!--/wj:children-->`,
    ],
    values: [tree],
  };
}

// Re-export for unit testing.
export {
  layoutSegmentPath as _layoutSegmentPath,
  wrapWithChildrenMarker as _wrapWithChildrenMarker,
};

/**
 * @param {import('./router.js').PageRoute} route
 * @param {Record<string,unknown>} ctx
 * @param {boolean} dev
 */
async function collectMetadata(route, ctx, dev) {
  /** @type {Record<string, any>} */
  let meta = {};
  // Carry the title template forward across layers. Once an outer layout
  // sets `title: { template, default }`, every deeper layer that supplies
  // a plain string title gets it transformed via the template: matching
  // Next.js App Router semantics.
  /** @type {string | null} */
  let titleTemplate = null;
  for (const file of route.metadataFiles) {
    try {
      const mod = await loadModule(file, dev);
      let m = null;
      if (typeof mod.generateMetadata === 'function') {
        m = await mod.generateMetadata(ctx);
      } else if (mod.metadata) {
        m = mod.metadata;
      }
      // Next.js 14+ split `viewport` out of metadata into its own export
      // (with `themeColor`, `colorScheme`). We support both: the new
      // `export const viewport = {…}` shape merges into metadata.viewport
      // as a string at emit time, and existing `metadata.viewport` keeps
      // working. Likewise for `themeColor` and `colorScheme`.
      let vp = null;
      if (typeof mod.generateViewport === 'function') {
        vp = await mod.generateViewport(ctx);
      } else if (mod.viewport) {
        vp = mod.viewport;
      }
      if (vp && typeof vp === 'object') {
        m = { ...(m || {}), _viewport: { ...(m && m._viewport), ...vp } };
        // Allow `themeColor` / `colorScheme` to live on the viewport export.
        if (typeof vp.themeColor === 'string' && !(m && m.themeColor)) {
          m.themeColor = vp.themeColor;
        }
        if (typeof vp.colorScheme === 'string') m.colorScheme = vp.colorScheme;
      }
      if (!m || typeof m !== 'object') continue;
      // Pre-resolve the title for this layer using the inherited template.
      const resolved = { ...m };
      if (m.title !== undefined) {
        const t = m.title;
        if (typeof t === 'string') {
          resolved.title = titleTemplate ? titleTemplate.replace('%s', t) : t;
        } else if (t && typeof t === 'object') {
          // { template, default, absolute }: `absolute` overrides everything;
          // `template` is captured for deeper layers; `default` is the value
          // used when no deeper layer supplies a plain title string.
          if (typeof t.template === 'string') titleTemplate = t.template;
          if (typeof t.absolute === 'string') {
            resolved.title = t.absolute;
            // `absolute` does NOT clear the template: Next.js propagates
            // it for deeper segments below, but the *current* segment is
            // rendered absolute.
          } else if (typeof t.default === 'string') {
            resolved.title = t.default;
          } else {
            delete resolved.title;
          }
        }
      }
      meta = { ...meta, ...resolved };
    } catch {
      // ignore: metadata collection never fails the request
    }
  }
  return meta;
}

/**
 * Extract leading `<script>`, `<style>`, and `<link>` tags from the body
 * HTML and hoist them into `<head>`. Ensures blocking scripts (e.g.
 * Tailwind runtime, theme bootstrap) run before any body content renders,
 * and that `<link rel="icon">` / `<link rel="stylesheet">` land where
 * browsers reliably honour them.
 *
 * @param {string} headHtml
 * @param {string} bodyHtml
 * @returns {{ head: string, body: string }}
 */
function hoistHeadTags(headHtml, bodyHtml) {
  // Shares the leading-run scanner (comment-skipping included) with the
  // streaming path so both hoist identically. See collectHoistedHeadTags.
  const { tags: hoisted, body: remaining } = collectHoistedHeadTags(bodyHtml);
  if (!hoisted.length) return { head: headHtml, body: bodyHtml };
  const newHead = headHtml.replace('</head>', hoisted.join('\n') + '\n</head>');
  return { head: newHead, body: remaining };
}

// Internal helper re-exported for unit testing.
export { hoistHeadTags as _hoistHeadTags };

/**
 * Detect a user-supplied <!doctype><html>…</html> shell at the top of
 * `body`. Returns the parsed parts when present; otherwise null.
 *
 * The framework owns the shell by default: it auto-emits
 * `<!doctype><html lang="en"><head>…</head><body>` around every page.
 * But the *root layout* (only) may write its own shell to set
 * `<html lang>`, `<html dir>`, `<html data-*>`, `<body class>`, etc.
 * When that happens we keep the user's shell verbatim and splice the
 * framework's required `<head>` tags (importmap, modulepreload, title,
 * meta, og/twitter) into the user's `<head>`. Non-root layouts that
 * try this would produce nested-shell garbage; `webjs check` flags
 * them via the `shell-in-non-root-layout` rule.
 *
 * @param {string} body
 * @returns {{
 *   htmlAttrs: string,
 *   headAttrs: string,
 *   userHead: string,
 *   bodyAttrs: string,
 *   userBody: string,
 * } | null}
 */
function extractUserShell(body) {
  // Tolerant: allow optional whitespace, optional <!doctype>, then <html ...>.
  // Capture html attributes (anything between <html and >).
  const htmlOpen = /^\s*(?:<!doctype[^>]*>\s*)?<html\b([^>]*)>\s*([\s\S]*)<\/html>\s*$/i;
  const m = body.match(htmlOpen);
  if (!m) return null;
  const htmlAttrs = m[1] || '';
  const shellInner = m[2];

  // <head> is optional inside the user's shell: if missing, the
  // framework's head content stands alone. Same for <body>.
  const headRe = /<head\b([^>]*)>([\s\S]*?)<\/head>/i;
  const bodyRe = /<body\b([^>]*)>([\s\S]*?)<\/body>/i;
  const headMatch = shellInner.match(headRe);
  const bodyMatch = shellInner.match(bodyRe);

  return {
    htmlAttrs,
    headAttrs: headMatch ? (headMatch[1] || '') : '',
    userHead: headMatch ? headMatch[2] : '',
    bodyAttrs: bodyMatch ? (bodyMatch[1] || '') : '',
    // If the user omitted <body>, treat everything outside <head>…</head>
    // as their body content.
    userBody: bodyMatch
      ? bodyMatch[2]
      : (headMatch ? shellInner.replace(headMatch[0], '') : shellInner).trim(),
  };
}

// Re-export for unit testing.
export { extractUserShell as _extractUserShell };

/**
 * Inner-only variant of wrapHead: returns just the meta/title/link/script
 * tags that should live INSIDE <head>, without the surrounding
 * <!doctype><html><head>…</head><body> shell. Used to splice into a
 * user-provided shell from `extractUserShell()`.
 *
 * @param {Parameters<typeof wrapHead>[0]} opts
 * @returns {string}
 */
function buildHeadInner(opts) {
  // Pull the full prefix and strip the <!doctype><html><head> opening + the
  // closing </head><body> so we're left with the inner tags only. Keeps a
  // single source of truth for what goes in <head>.
  const full = wrapHead({ ...opts, streaming: false });
  const start = full.indexOf('<head>');
  const end = full.indexOf('</head>');
  if (start === -1 || end === -1) return '';
  // +'<head>'.length to skip past the opening tag itself.
  return full.slice(start + '<head>'.length, end).trim();
}

/**
 * Build the prefix/body/closer triple for a rendered layout's body. Single
 * source of truth used by both the buffered (`wrapInDocument`) and
 * streaming (`streamingHtmlResponse`) paths.
 *
 * If `body` starts with a user-supplied <!doctype><html>…</html> shell:
 *   - `prefix` opens with the user's `<!doctype><html><head>` (with their
 *     attributes), splices the framework's required tags + the user's
 *     own head content + auto-hoisted body-positioned head-bound tags,
 *     then closes `</head>` and opens `<body>` (with user attributes).
 *   - `streamBody` is the user's body content (head-hoist already stripped).
 *   - `closer` is `</body></html>`.
 *
 * Otherwise (no user shell): use the framework's auto-emitted shell.
 *
 * @param {string} body
 * @param {Parameters<typeof wrapHead>[0]} wrapOpts
 * @returns {{ prefix: string, streamBody: string, closer: string }}
 */
function buildDocumentParts(body, wrapOpts) {
  const shell = extractUserShell(body);
  if (shell) {
    const headInner = buildHeadInner(wrapOpts);
    const hoist = collectHoistedHeadTags(shell.userBody);
    const composedHead = [headInner, shell.userHead.trim(), hoist.tags.join('\n')]
      .filter(Boolean)
      .join('\n');
    const prefix =
      `<!doctype html>\n<html${shell.htmlAttrs}>\n<head${shell.headAttrs}>\n` +
      composedHead +
      `\n</head>\n<body${shell.bodyAttrs}>\n`;
    return { prefix, streamBody: hoist.body, closer: `\n</body>\n</html>` };
  }
  // No user shell: framework owns the wrapper.
  const headHtml = wrapHead(wrapOpts);
  const { head, body: bodyOut } = hoistHeadTags(headHtml, body);
  return { prefix: head, streamBody: bodyOut, closer: `\n</body>\n</html>` };
}

// Re-export for unit testing.
export { buildDocumentParts as _buildDocumentParts };

/**
 * Buffered wrapper (error / not-found paths; no Suspense streaming).
 *
 * @param {string} body
 * @param {{ metadata: Record<string,any>, moduleUrls: string[], dev: boolean }} opts
 */
function wrapInDocument(body, opts) {
  const { prefix, streamBody, closer } = buildDocumentParts(body, { ...opts, streaming: false });
  return prefix + streamBody + closer;
}

/**
 * Strip leading head-bound tags (<script>, <style>, <link>) from a body
 * string. Returns the collected tags + the remaining body. Mirrors what
 * `hoistHeadTags` does but takes/returns plain strings (no head input)
 * so it can be used with a user-provided <head>.
 *
 * @param {string} bodyHtml
 * @returns {{ tags: string[], body: string }}
 */
function collectHoistedHeadTags(bodyHtml) {
  const tags = [];
  // <script>…</script> and <style>…</style> are paired; <link …> is void.
  // A plain HTML comment (<!-- … -->) is consumed but NOT hoisted, so a
  // comment interleaved with head-bound tags (e.g. "<!-- Self-hosted fonts -->"
  // between a favicon <link> and the stylesheet <link>) does not terminate
  // the leading run and strand the stylesheet in <body>, which caused FOUC
  // because a <link rel="stylesheet"> in <body> is not reliably
  // render-blocking (#406). The `(?!/?wj:)` guard exempts client-router
  // markers (<!--wj:children:…-->, <!--/wj:children-->) so a layout that
  // renders children directly after its head tags still terminates the run
  // there rather than swallowing the nesting marker.
  const re =
    /^\s*(<!--(?!\/?wj:)[\s\S]*?-->|<script[\s>][\s\S]*?<\/script>|<style[\s>][\s\S]*?<\/style>|<link\b[^>]*>)/i;
  let remaining = bodyHtml;
  // `body` only advances to just-past the LAST hoisted head tag. Comments
  // are scanned through (so they don't terminate the run) but a comment that
  // trails the final head tag stays in the body rather than being dropped.
  let body = bodyHtml;
  let m;
  while ((m = re.exec(remaining)) !== null) {
    const token = m[1];
    remaining = remaining.slice(m[0].length);
    if (!token.startsWith('<!--')) {
      tags.push(token);
      body = remaining;
    }
  }
  return { tags, body };
}

/**
 * Produce the `<!doctype…><body>` prefix. If `streaming` is true, injects
 * the tiny client-side resolver that swaps Suspense fallback nodes for
 * streamed-in real content.
 *
 * Also emits `<link rel="modulepreload">` for every component that rendered
 * (breaks the ES-module waterfall without a bundler) and any user-declared
 * `metadata.preload` entries.
 *
 * @param {{ metadata: Record<string,any>, moduleUrls: string[], dev: boolean, streaming: boolean, preloads?: string[], lazyComponents?: Record<string, string>, nonce?: string }} opts
 */
/**
 * Build an inline `<script>` that exposes server-side environment
 * variables to the browser via `window.process.env`. Two purposes:
 *
 *   1. App code can read `process.env.WEBJS_PUBLIC_X` directly in
 *      components (counterpart of Next.js's `NEXT_PUBLIC_` prefix,
 *      but without a build step).
 *   2. `process.env.NODE_ENV` is defined for vendor bundles that
 *      probe it (lit, react, etc.) so they do not throw
 *      ReferenceError in the browser.
 *
 * Only variables whose name starts with `WEBJS_PUBLIC_` are exposed.
 * Other server env vars stay on the server.
 *
 * `</...` sequences in stringified values are escaped so an env value
 * containing `</script>` cannot terminate the inline script tag.
 *
 * @param {{ dev: boolean, nonce?: string, env?: Record<string, string|undefined> }} opts
 *   `env` defaults to `process.env`. Override for tests.
 * @returns {string}
 */
export function publicEnvShim(opts) {
  const source = opts.env || process.env;
  /** @type {Record<string, string>} */
  const env = {};
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith('WEBJS_PUBLIC_') && v !== undefined) {
      env[k] = String(v);
    }
  }
  env.NODE_ENV = opts.dev ? 'development' : 'production';
  const n = opts.nonce ? ` nonce="${escapeAttr(opts.nonce)}"` : '';
  return `<script${n}>`
    + `window.process=window.process||{};`
    + `window.process.env=Object.assign(window.process.env||{},${jsonForScriptTag(env)});`
    + `</script>`;
}

function wrapHead(opts) {
  // CSP nonce: if provided, all inline <script> tags get nonce="…" so they
  // pass strict Content-Security-Policy headers. The nonce is extracted from
  // the request's CSP header by the caller.
  const n = opts.nonce ? ` nonce="${escapeAttr(opts.nonce)}"` : '';

  // Sub-path deployment (issue #256): the boot script's per-route module
  // specifiers and the dev reload `src` are framework-emitted same-origin
  // absolute URLs, so prefix them with the base path (a no-op when empty).
  // The lazy-loader import is a BARE specifier resolved through the importmap
  // (whose target is already base-path-prefixed in importmap.js), so it is
  // NOT prefixed here. The base path is the one set at boot via setBasePath
  // (read from importmap.js's module state), the same value the importmap
  // targets were prefixed with, so the boot specifiers and the map agree.
  const bp = basePath();
  // Content-hash asset URLs (issue #243): after base-path-prefixing, append
  // `?v=<hash>` to a same-origin module specifier for immutable caching. A
  // no-op in dev (so the boot script is byte-identical) and for a bare/
  // cross-origin specifier; same compose order as the importmap targets
  // (basePath then `?v`).
  const fp = (u) => withAssetHash(withBasePath(u, bp), bp);
  const imports = opts.moduleUrls
    .map((u) => `import ${jsonForScriptTag(fp(u))};`)
    .join('\n');
  const rawLazyEntries = opts.lazyComponents && Object.keys(opts.lazyComponents).length
    ? opts.lazyComponents
    : null;
  // The lazy map's values are same-origin module URLs `observeLazy` will
  // dynamically import, so prefix them with the base path too (no-op when
  // empty).
  // The lazy map's values are same-origin module URLs `observeLazy` will
  // dynamically import, so base-path-prefix AND content-hash them (#243), the
  // same as the eager boot specifiers. `fp` is a pure no-op in dev and at the
  // root mount with fingerprinting off, so the mapped map equals the raw one
  // byte-for-byte there; only prod fingerprinting / a sub-path mount changes it.
  const lazyEntries = rawLazyEntries
    ? Object.fromEntries(
        Object.entries(rawLazyEntries).map(([tag, u]) => [tag, fp(u)]),
      )
    : rawLazyEntries;
  const lazyBoot = lazyEntries
    ? `\nimport { observeLazy } from '@webjsdev/core/lazy-loader';\nobserveLazy(${jsonForScriptTag(lazyEntries)});`
    : '';
  const boot = (imports || lazyBoot) ? `<script type="module"${n}>\n${imports}${lazyBoot}\n</script>` : '';
  const reload = opts.dev
    ? `<script type="module"${n} src="${escapeAttr(withBasePath('/__webjs/reload.js', bp))}"></script>`
    : '';
  const suspenseBoot = opts.streaming
    ? `<script${n}>(function(){` +
      `function r(id){var t=document.querySelector('template[data-webjs-resolve="'+id+'"]');` +
      `var b=document.getElementById(id);if(t&&b){b.replaceWith(t.content.cloneNode(true));t.remove();}}` +
      `window.__webjsResolve=r;` +
      `if(typeof MutationObserver!=='undefined'){` +
      `new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){` +
      `if(n.nodeType===1&&n.tagName==='TEMPLATE'&&n.dataset.webjsResolve){r(n.dataset.webjsResolve);}` +
      `});});}).observe(document.documentElement,{childList:true,subtree:true});}` +
      `})()</script>`
    : '';

  const m = opts.metadata || {};
  const metaTags = [];
  // linkTags is populated by both the metadata emission below (icons,
  // alternates, archives, etc.) AND by the preload block further down.
  // Hoist the declaration so the metadata block can push into it.
  const linkTags = [];
  // scriptTags collects JSON-LD structured-data blocks (see m.jsonLd below).
  const scriptTags = [];

  // Tiny URL resolver against metadataBase. If metadataBase is set and a
  // value looks like a relative URL (no scheme, no `//` prefix), resolve
  // it. Otherwise return as-is. Used by og:image, twitter:image,
  // alternates.canonical / languages / media.
  const base = typeof m.metadataBase === 'string' ? m.metadataBase : '';
  /** @param {unknown} v */
  const absUrl = (v) => {
    const s = String(v);
    if (!base) return s;
    if (/^https?:\/\//i.test(s) || s.startsWith('//') || s.startsWith('data:')) return s;
    try {
      return new URL(s, base).toString();
    } catch {
      return s;
    }
  };

  if (m.description) metaTags.push(`<meta name="description" content="${escapeAttr(m.description)}">`);

  // viewport: support string form (legacy), `metadata.viewport` object form,
  // and the new Next.js 14+ `export const viewport = { … }` shape captured
  // into `_viewport` by collectMetadata.
  let viewportStr = '';
  if (typeof m.viewport === 'string') {
    viewportStr = m.viewport;
  } else if (m.viewport && typeof m.viewport === 'object') {
    viewportStr = serializeViewport(m.viewport);
  } else if (m._viewport && typeof m._viewport === 'object') {
    viewportStr = serializeViewport(m._viewport);
  }
  metaTags.push(`<meta name="viewport" content="${escapeAttr(viewportStr || 'width=device-width,initial-scale=1')}">`);

  if (m.themeColor) metaTags.push(`<meta name="theme-color" content="${escapeAttr(m.themeColor)}">`);
  if (m.colorScheme) metaTags.push(`<meta name="color-scheme" content="${escapeAttr(m.colorScheme)}">`);

  // ---- i18n + SEO essentials ----

  // robots: { index, follow, googleBot, etc. }
  if (m.robots) {
    if (typeof m.robots === 'string') {
      metaTags.push(`<meta name="robots" content="${escapeAttr(m.robots)}">`);
    } else if (typeof m.robots === 'object') {
      const parts = [];
      if (m.robots.index === false) parts.push('noindex');
      else if (m.robots.index === true) parts.push('index');
      if (m.robots.follow === false) parts.push('nofollow');
      else if (m.robots.follow === true) parts.push('follow');
      if (m.robots.noarchive) parts.push('noarchive');
      if (m.robots.nosnippet) parts.push('nosnippet');
      if (m.robots.noimageindex) parts.push('noimageindex');
      if (parts.length) {
        metaTags.push(`<meta name="robots" content="${escapeAttr(parts.join(', '))}">`);
      }
      if (typeof m.robots.googleBot === 'string') {
        metaTags.push(`<meta name="googlebot" content="${escapeAttr(m.robots.googleBot)}">`);
      }
    }
  }

  // keywords: string | string[]
  if (m.keywords) {
    const kws = Array.isArray(m.keywords) ? m.keywords.join(', ') : String(m.keywords);
    if (kws) metaTags.push(`<meta name="keywords" content="${escapeAttr(kws)}">`);
  }

  // authors: Array<{ name, url? }> | { name, url? } | string
  if (m.authors) {
    const list = Array.isArray(m.authors) ? m.authors : [m.authors];
    for (const a of list) {
      if (!a) continue;
      const name = typeof a === 'string' ? a : a.name;
      if (!name) continue;
      metaTags.push(`<meta name="author" content="${escapeAttr(name)}">`);
      if (typeof a === 'object' && a.url) {
        metaTags.push(`<link rel="author" href="${escapeAttr(absUrl(a.url))}">`);
      }
    }
  }

  // Singletons that map 1:1 to <meta name="…">.
  for (const [field, metaName] of [
    ['creator', 'creator'],
    ['publisher', 'publisher'],
    ['applicationName', 'application-name'],
    ['generator', 'generator'],
    ['referrer', 'referrer'],
  ]) {
    if (m[field]) {
      metaTags.push(`<meta name="${metaName}" content="${escapeAttr(String(m[field]))}">`);
    }
  }

  // ---- Long-tail metadata (the Next.js "everything else") ----

  // appleWebApp: { capable, title, statusBarStyle, startupImage }
  if (m.appleWebApp && typeof m.appleWebApp === 'object') {
    if (m.appleWebApp.capable !== undefined) {
      metaTags.push(
        `<meta name="apple-mobile-web-app-capable" content="${m.appleWebApp.capable ? 'yes' : 'no'}">`,
      );
    }
    if (m.appleWebApp.title) {
      metaTags.push(`<meta name="apple-mobile-web-app-title" content="${escapeAttr(m.appleWebApp.title)}">`);
    }
    if (m.appleWebApp.statusBarStyle) {
      metaTags.push(
        `<meta name="apple-mobile-web-app-status-bar-style" content="${escapeAttr(m.appleWebApp.statusBarStyle)}">`,
      );
    }
    // startupImage maps to <link rel="apple-touch-startup-image">.
    if (m.appleWebApp.startupImage) {
      const list = Array.isArray(m.appleWebApp.startupImage)
        ? m.appleWebApp.startupImage
        : [m.appleWebApp.startupImage];
      for (const it of list) {
        if (typeof it === 'string') {
          linkTags.push(`<link rel="apple-touch-startup-image" href="${escapeAttr(absUrl(it))}">`);
        } else if (it && it.url) {
          const parts = [`rel="apple-touch-startup-image"`, `href="${escapeAttr(absUrl(it.url))}"`];
          if (it.media) parts.push(`media="${escapeAttr(it.media)}"`);
          linkTags.push(`<link ${parts.join(' ')}>`);
        }
      }
    }
  } else if (m.appleWebApp === true) {
    metaTags.push(`<meta name="apple-mobile-web-app-capable" content="yes">`);
  }

  // formatDetection: { telephone, address, email, date, … }. All booleans.
  // Disabled detection types append "type=no" to the content string.
  if (m.formatDetection && typeof m.formatDetection === 'object') {
    const parts = [];
    for (const [k, v] of Object.entries(m.formatDetection)) {
      if (v === false) parts.push(`${k}=no`);
      else if (v === true) parts.push(`${k}=yes`);
    }
    if (parts.length) {
      metaTags.push(`<meta name="format-detection" content="${escapeAttr(parts.join(', '))}">`);
    }
  }

  // itunes: { appId, appArgument? }
  if (m.itunes && typeof m.itunes === 'object' && m.itunes.appId) {
    let content = `app-id=${m.itunes.appId}`;
    if (m.itunes.appArgument) content += `, app-argument=${m.itunes.appArgument}`;
    metaTags.push(`<meta name="apple-itunes-app" content="${escapeAttr(content)}">`);
  }

  // Plain singleton string fields.
  for (const [field, metaName] of [
    ['category', 'category'],
    ['classification', 'classification'],
    ['abstract', 'abstract'],
  ]) {
    if (m[field]) metaTags.push(`<meta name="${metaName}" content="${escapeAttr(String(m[field]))}">`);
  }

  // archives / assets / bookmarks: each is string | string[].
  // Standard registered link relations.
  for (const [field, rel] of [
    ['archives', 'archives'],
    ['assets', 'assets'],
    ['bookmarks', 'bookmark'],
  ]) {
    if (m[field]) {
      const list = Array.isArray(m[field]) ? m[field] : [m[field]];
      for (const href of list) {
        linkTags.push(`<link rel="${rel}" href="${escapeAttr(absUrl(href))}">`);
      }
    }
  }

  // `other` is the typed escape hatch for any arbitrary <meta name="…">
  // entries Next.js (or future webjs) doesn't ship as a typed field.
  // Values can be string, number, or string[] (emits multiple meta tags).
  if (m.other && typeof m.other === 'object') {
    for (const [name, v] of Object.entries(m.other)) {
      const list = Array.isArray(v) ? v : [v];
      for (const item of list) {
        if (item == null) continue;
        metaTags.push(`<meta name="${escapeAttr(name)}" content="${escapeAttr(String(item))}">`);
      }
    }
  }

  // verification: { google, yandex, yahoo, me }. Each is string OR string[].
  // - google     → <meta name="google-site-verification">
  // - yandex     → <meta name="yandex-verification">
  // - yahoo      → <meta name="y_key">  (Yahoo's unusual canonical name)
  // - me         → <meta name="me">     (IndieAuth / personal verification)
  if (m.verification && typeof m.verification === 'object') {
    const verifyKeys = {
      google: 'google-site-verification',
      yandex: 'yandex-verification',
      yahoo: 'y_key',
      me: 'me',
    };
    for (const [field, metaName] of Object.entries(verifyKeys)) {
      const v = m.verification[field];
      if (!v) continue;
      const list = Array.isArray(v) ? v : [v];
      for (const item of list) {
        metaTags.push(`<meta name="${metaName}" content="${escapeAttr(String(item))}">`);
      }
    }
    // `verification.other` allows arbitrary <meta name="…"> entries.
    if (m.verification.other && typeof m.verification.other === 'object') {
      for (const [name, v] of Object.entries(m.verification.other)) {
        const list = Array.isArray(v) ? v : [v];
        for (const item of list) {
          metaTags.push(`<meta name="${escapeAttr(name)}" content="${escapeAttr(String(item))}">`);
        }
      }
    }
  }

  if (m.openGraph && typeof m.openGraph === 'object') {
    for (const [k, v] of Object.entries(m.openGraph)) {
      const out = k === 'image' || k === 'url' ? absUrl(v) : String(v);
      metaTags.push(`<meta property="og:${escapeAttr(k)}" content="${escapeAttr(out)}">`);
    }
  }
  // Twitter card tags. Twitter falls back to og:* when these are absent
  // but won't upgrade to summary_large_image without an explicit
  // twitter:card entry.
  if (m.twitter && typeof m.twitter === 'object') {
    for (const [k, v] of Object.entries(m.twitter)) {
      const out = k === 'image' ? absUrl(v) : String(v);
      metaTags.push(`<meta name="twitter:${escapeAttr(k)}" content="${escapeAttr(out)}">`);
    }
  }

  // JSON-LD structured data (schema.org). `m.jsonLd` is a single object
  // OR an array of objects. The author owns the schema.org shape; the
  // framework only serializes and HTML-safe-escapes each object into a
  // `<script type="application/ld+json">` block. A single object emits
  // ONE script; an array emits one script PER element.
  //
  // The block is a NON-EXECUTABLE data island (type application/ld+json),
  // so CSP script-src does not gate it and it carries NO nonce. Adding one
  // would wrongly imply it is executable script.
  if (m.jsonLd != null) {
    const list = Array.isArray(m.jsonLd) ? m.jsonLd : [m.jsonLd];
    for (const obj of list) {
      const tag = jsonLdScript(obj);
      if (tag) scriptTags.push(tag);
    }
  }

  // Preload hints: page modules themselves + every discovered component
  // module, then any custom `metadata.preload` entries (fonts, images, etc.)
  // (linkTags array was declared earlier so the metadata block above can
  // push icons / canonical / hreflang / archives / etc. into it.)
  //
  // Cross-origin URLs (vendor packages served from jspm.io etc.) MUST
  // carry `crossorigin="anonymous"` on the preload link. Without it
  // the browser either ignores the preload entirely or double-fetches
  // (once for the preload as a non-CORS request, once for the actual
  // module as a CORS request, defeating the optimization). Same-origin
  // URLs get no attribute; adding `crossorigin=""` there would also
  // double-fetch in some browsers because the preload becomes CORS
  // but the import doesn't.
  // CSP nonce on the preload link: under strict CSP (script-src
  // 'nonce-...') the browser also gates modulepreload by the same
  // policy. Without the attribute the preload is blocked and the
  // import either falls back to a cold fetch or fails. Rails (via
  // importmap-rails) applies nonce on every modulepreload tag for
  // the same reason.
  const noncePreload = opts.nonce ? ` nonce="${escapeAttr(opts.nonce)}"` : '';
  // Sub-path deployment (issue #256): the modulepreload href is prefixed with
  // the base path (a no-op when empty), but `crossorigin` / `integrity` are
  // decided on the ORIGINAL url, so the integrity lookup still keys on the
  // unprefixed map url and a cross-origin CDN url (never prefixed) keeps its
  // crossorigin attribute.
  // Content-hash (#243): the href additionally gets a `?v=<hash>` after the
  // base-path prefix (a no-op in dev / for a cross-origin url), but
  // `crossorigin` / `integrity` are still decided on the ORIGINAL url, so the
  // integrity lookup keys on the unprefixed/unhashed map url and a cross-origin
  // CDN url (never prefixed, never hashed) keeps its crossorigin attribute.
  for (const url of opts.moduleUrls) {
    linkTags.push(
      `<link rel="modulepreload" href="${escapeAttr(fp(url))}"` +
      `${preloadCrossOriginAttr(url)}${integrityAttr(url)}${noncePreload}>`,
    );
  }
  for (const url of opts.preloads || []) {
    linkTags.push(
      `<link rel="modulepreload" href="${escapeAttr(fp(url))}"` +
      `${preloadCrossOriginAttr(url)}${integrityAttr(url)}${noncePreload}>`,
    );
  }
  if (Array.isArray(m.preload)) {
    for (const p of m.preload) {
      if (!p || !p.href) continue;
      const attrs = Object.entries(p)
        .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
        .join(' ');
      linkTags.push(`<link rel="preload" ${attrs}>`);
    }
  }

  // preconnect / dns-prefetch hints (issue #243). `metadata.preconnect` and
  // `metadata.dnsPrefetch` each take a URL string, `{ url, crossorigin? }`, or
  // an array of those. A preconnect warms DNS + TLS + TCP; dns-prefetch only
  // resolves DNS (no crossorigin). The framework ALSO auto-emits ONE preconnect
  // to the resolved vendor CDN origin for an unpinned cross-origin app, so the
  // browser warms that connection before the importmap resolves. The author's
  // declared origins are tracked so the auto one is not a duplicate.
  /** @type {Set<string>} the origins the author already declared a preconnect to */
  const declaredPreconnectOrigins = new Set();
  /** @param {unknown} hint @returns {{ url: string, crossorigin?: string|boolean } | null} */
  const normalizeHint = (hint) => {
    if (typeof hint === 'string') return hint ? { url: hint } : null;
    if (hint && typeof hint === 'object' && typeof (/** @type {any} */ (hint).url) === 'string') {
      return /** @type {any} */ (hint);
    }
    return null;
  };
  /** @param {unknown} value @returns {Array<{ url: string, crossorigin?: string|boolean }>} */
  const toHints = (value) => {
    if (value == null) return [];
    const list = Array.isArray(value) ? value : [value];
    const out = [];
    for (const h of list) {
      const n = normalizeHint(h);
      if (n) out.push(n);
    }
    return out;
  };
  /** @param {string|boolean|undefined} co @returns {string} */
  const crossoriginAttr = (co) => {
    if (co === undefined || co === false) return '';
    if (co === true || co === '') return ' crossorigin';
    return ` crossorigin="${escapeAttr(String(co))}"`;
  };
  for (const h of toHints(m.preconnect)) {
    try { declaredPreconnectOrigins.add(new URL(h.url).origin); } catch { /* relative / opaque; track by raw href instead */ declaredPreconnectOrigins.add(h.url); }
    linkTags.push(`<link rel="preconnect" href="${escapeAttr(h.url)}"${crossoriginAttr(h.crossorigin)}>`);
  }
  for (const h of toHints(m.dnsPrefetch)) {
    // dns-prefetch never carries crossorigin (it only resolves DNS).
    linkTags.push(`<link rel="dns-prefetch" href="${escapeAttr(h.url)}">`);
  }
  // Auto vendor preconnect: warm the cross-origin vendor CDN connection for an
  // unpinned app. Deduped against an author-declared preconnect to the same
  // origin; emits none for a same-origin pinned app or one with no cross-origin
  // vendors (vendorPreconnectOrigins returns []). crossorigin is required (the
  // importmap fetches the module as a CORS request).
  for (const origin of vendorPreconnectOrigins()) {
    if (declaredPreconnectOrigins.has(origin)) continue;
    linkTags.push(`<link rel="preconnect" href="${escapeAttr(origin)}" crossorigin>`);
  }

  // icons: { icon, apple, shortcut, other }. Each entry can be a string
  // (URL), an object { url, sizes?, type? }, or an array of those.
  //   - icon    → <link rel="icon">
  //   - apple   → <link rel="apple-touch-icon">
  //   - shortcut→ <link rel="shortcut icon">
  //   - other   → <link rel="…" href="…"> using the entry's `rel` field
  if (m.icons) {
    const buckets = typeof m.icons === 'string' || Array.isArray(m.icons)
      ? { icon: m.icons }
      : m.icons;
    /** @param {string} rel @param {unknown} entry */
    const pushIcon = (rel, entry) => {
      if (!entry) return;
      const items = Array.isArray(entry) ? entry : [entry];
      for (const it of items) {
        if (!it) continue;
        if (typeof it === 'string') {
          linkTags.push(`<link rel="${rel}" href="${escapeAttr(absUrl(it))}">`);
        } else if (typeof it === 'object' && it.url) {
          const parts = [`rel="${rel}"`, `href="${escapeAttr(absUrl(it.url))}"`];
          if (it.sizes) parts.push(`sizes="${escapeAttr(it.sizes)}"`);
          if (it.type) parts.push(`type="${escapeAttr(it.type)}"`);
          linkTags.push(`<link ${parts.join(' ')}>`);
        }
      }
    };
    pushIcon('icon', buckets.icon);
    pushIcon('apple-touch-icon', buckets.apple);
    pushIcon('shortcut icon', buckets.shortcut);
    // `other` is the catch-all: array of { rel, url, ...attrs }.
    if (buckets.other) {
      const others = Array.isArray(buckets.other) ? buckets.other : [buckets.other];
      for (const o of others) {
        if (!o || !o.rel || !o.url) continue;
        const parts = [`rel="${escapeAttr(o.rel)}"`, `href="${escapeAttr(absUrl(o.url))}"`];
        if (o.sizes) parts.push(`sizes="${escapeAttr(o.sizes)}"`);
        if (o.type) parts.push(`type="${escapeAttr(o.type)}"`);
        linkTags.push(`<link ${parts.join(' ')}>`);
      }
    }
  }

  // manifest: a string URL → <link rel="manifest">
  if (typeof m.manifest === 'string') {
    linkTags.push(`<link rel="manifest" href="${escapeAttr(absUrl(m.manifest))}">`);
  }

  // alternates: { canonical, languages: { '<hreflang>': url }, media: { '<media>': url } }
  // Mirrors Next.js's metadata.alternates surface. Relative values are resolved
  // against metadataBase.
  if (m.alternates && typeof m.alternates === 'object') {
    if (m.alternates.canonical) {
      linkTags.push(`<link rel="canonical" href="${escapeAttr(absUrl(m.alternates.canonical))}">`);
    }
    if (m.alternates.languages && typeof m.alternates.languages === 'object') {
      for (const [hreflang, href] of Object.entries(m.alternates.languages)) {
        linkTags.push(
          `<link rel="alternate" hreflang="${escapeAttr(hreflang)}" href="${escapeAttr(absUrl(href))}">`,
        );
      }
    }
    if (m.alternates.media && typeof m.alternates.media === 'object') {
      for (const [media, href] of Object.entries(m.alternates.media)) {
        linkTags.push(
          `<link rel="alternate" media="${escapeAttr(media)}" href="${escapeAttr(absUrl(href))}">`,
        );
      }
    }
    if (m.alternates.types && typeof m.alternates.types === 'object') {
      // alternates.types: { 'application/rss+xml': '/rss.xml' }
      for (const [type, href] of Object.entries(m.alternates.types)) {
        linkTags.push(
          `<link rel="alternate" type="${escapeAttr(type)}" href="${escapeAttr(absUrl(href))}">`,
        );
      }
    }
  }

  const title = m.title || 'webjs app';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${opts.nonce ? `<meta name="csp-nonce" content="${escapeAttr(opts.nonce)}">` : ''}
${metaTags.join('\n')}
<title>${escapeHtml(title)}</title>
${publicEnvShim({ dev: opts.dev, nonce: opts.nonce })}
${importMapTag({ nonce: opts.nonce })}
${linkTags.join('\n')}
${scriptTags.length ? scriptTags.join('\n') + '\n' : ''}${boot}
${reload}
${suspenseBoot}
</head>
<body>
`;
}

/**
 * Translate a Set of custom element tag names used on the page into browser
 * URLs for modulepreload. Components that didn't pass a module URL to
 * `register()` are skipped silently (no harm, just no preload hint).
 *
 * Returns separate eager and lazy lists. Lazy components (static lazy = true)
 * are NOT preloaded: they're loaded by the IntersectionObserver-based
 * lazy-loader when the element enters the viewport.
 *
 * Elidable (display-only) components are skipped entirely: their imports
 * are stripped from the served source, so preloading their module would
 * fetch JS the browser never executes.
 *
 * @param {Set<string>} usedTags
 * @param {string} appDir
 * @param {Set<string>} [elidable]  absolute paths of elidable component files
 * @returns {{ eager: string[], lazy: Record<string, string> }}
 */
function componentPreloads(usedTags, appDir, elidable) {
  const eager = [];
  /** @type {Record<string, string>} */
  const lazy = {};
  for (const tag of usedTags) {
    const fileUrl = lookupModuleUrl(tag);
    if (!fileUrl) continue;
    try {
      const abs = fileURLToPath(fileUrl);
      if (!abs.startsWith(appDir)) continue;
      if (elidable && elidable.has(abs)) continue;
      const url = toUrlPath(abs, appDir);
      if (isLazy(tag)) {
        lazy[tag] = url;
      } else {
        eager.push(url);
      }
    } catch { /* ignore */ }
  }
  return { eager, lazy };
}

/**
 * Merge component preloads with transitive dependencies from the module
 * graph, then deduplicate against the already-imported module URLs.
 *
 * @param {string[]} componentUrls  direct component module URLs
 * @param {string[]} moduleUrls     boot script imports (page + layouts)
 * @param {import('./module-graph.js').ModuleGraph | undefined} graph
 * @param {string[]} entryFiles     absolute paths of page + layout files
 * @param {string} appDir
 * @param {Set<string>} [elidableComponents]  absolute paths to skip in the walk
 * @returns {string[]}
 */
function deduplicatedPreloads(componentUrls, moduleUrls, graph, entryFiles, appDir, serverFiles, elidableComponents) {
  const seen = new Set(moduleUrls);
  const result = [];

  // Server-only modules are never useful to preload: they're imported by
  // pages/layouts on the server, or surfaced to client components as
  // generated RPC stubs that load lazily on first call. Preloading them
  // wastes a roundtrip and pollutes the network tab with server-named files.
  //
  // Detection is belt-and-suspenders: filename suffix catches `.server.*`;
  // the `serverFiles` set (built from the action index) also catches files
  // that opted in via `'use server'` directive without the suffix.
  const byName = (url) => /\.server\.m?[jt]s$/.test(url);
  const byIndex = serverFiles
    ? (abs) => (serverFiles.has ? serverFiles.has(abs) : false)
    : () => false;

  // Add direct component URLs
  for (const url of componentUrls) {
    if (seen.has(url) || byName(url)) continue;
    seen.add(url);
    result.push(url);
  }

  // Add transitive deps from the module graph
  if (graph) {
    // Combine entry files + component files for graph lookup
    const allEntries = [...entryFiles];
    for (const url of componentUrls) {
      // Convert URL back to absolute path for graph lookup
      const abs = resolve(appDir, url.startsWith('/') ? url.slice(1) : url);
      allEntries.push(abs);
    }
    // Skip elidable components and any subtree reachable only through
    // them: their imports are stripped from served source, so the
    // browser never fetches these modules.
    const deps = transitiveDeps(graph, allEntries, appDir, elidableComponents);
    for (const dep of deps) {
      if (byIndex(dep)) continue;
      const url = toUrlPath(dep, appDir);
      if (seen.has(url) || byName(url)) continue;
      seen.add(url);
      result.push(url);
    }
  }

  return result;
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
 */
function streamingHtmlResponse(prefix, bodyHtml, closer, ctx, status, req, url, metadata, nonce, dev) {
  const encoder = new TextEncoder();
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  // Default: no caching. Pages are dynamic by default: the developer
  // opts in to caching explicitly via metadata.cacheControl.
  headers.set('cache-control', metadata?.cacheControl || 'no-store');
  // See htmlResponse: published build id on every response for the
  // client router's importmap-mismatch detection on partial swaps.
  headers.set('x-webjs-build', publishedBuildId());
  if (req && !readToken(req)) {
    const secure = url ? url.protocol === 'https:' : false;
    headers.append('set-cookie', cookieHeader(newToken(), { secure }));
  }

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
                const html = await renderToString(resolved, { ssr: true, suspenseCtx: sub });
                ctx.nextId = sub.nextId;
                for (const n of sub.pending) ctx.pending.push(n);
                return { id: p.id, html };
              } catch (e) {
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
            const chunk =
              `<template data-webjs-resolve="${r.id}">${r.html}</template>` +
              `<script${scriptNonce}>window.__webjsResolve&&__webjsResolve("${r.id}")</script>`;
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

/**
 * Import a route module. In prod the URL is stable so Node's module cache
 * serves a single evaluation; in dev a cache-bust query forces a fresh
 * evaluation so source edits take effect (which also re-runs the module's
 * top-level side effects, the reason pages/layouts must keep their top level
 * side-effect-free). Exported so page-action.js loads the page module the same
 * way the SSR re-render does.
 *
 * @param {string} file
 * @param {boolean} dev
 */
export async function loadModule(file, dev) {
  const url = pathToFileURL(file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  return import(url + bust);
}

/**
 * @param {string} file
 * @param {string} appDir
 */
function toUrlPath(file, appDir) {
  let rel = file.startsWith(appDir) ? file.slice(appDir.length) : file;
  rel = rel.split('\\').join('/');
  if (!rel.startsWith('/')) rel = '/' + rel;
  return rel;
}

/**
 * The CSP nonce for the in-flight request, or undefined if none is in
 * scope. Delegates to `cspNonce()`, which returns the per-request nonce
 * the handler MINTED when CSP is enabled (issue #233), or, as a fallback,
 * the nonce parsed from an inbound `Content-Security-Policy` request
 * header (the legacy consume-only path). Using the same source as the
 * `Content-Security-Policy` response header is what guarantees the inline
 * boot script, the importmap, the modulepreload hints, and the header all
 * carry the EXACT same nonce: one minted value, no drift.
 *
 * `req` is accepted (and ignored) so existing call sites stay unchanged;
 * the value comes from the request-scoped AsyncLocalStorage store, not
 * the argument.
 *
 * @param {Request} [_req]
 * @returns {string | undefined}
 */
function getNonce(_req) {
  return cspNonce() || undefined;
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
/** @param {string} s */
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * HTML-safe-escape a JSON string for embedding inside a
 * `<script type="application/ld+json">` element.
 *
 * This is NOT the HTML-entity escaper (escapeHtml / escapeAttr). A
 * JSON parser reads the raw character, so turning `<` into `&lt;`
 * would CORRUPT the JSON. Instead we emit the Unicode escape form
 * (`<`), which a JSON parser decodes back to the original
 * character while making the literal byte sequence `</script>`
 * impossible to form in the served HTML. So the embedded data parses
 * back to the author's exact object, AND a value containing
 * `</script><img onerror=...>` can never break out of the script tag.
 *
 * U+2028 / U+2029 are escaped too: they are valid inside a JSON
 * string but are line terminators in HTML/JS contexts, and some
 * consumers choke on them. Escaping keeps the block robust.
 *
 * @param {string} json  the `JSON.stringify` output
 * @returns {string}
 */
function escapeJsonLd(json) {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Serialize one schema.org object into a `<script type="application/ld+json">`
 * block, HTML-safe-escaped via escapeJsonLd. Fails SAFE: a non-object
 * input, or a circular reference that makes JSON.stringify throw, is
 * skipped (returns the empty string) with a one-line warn, never breaking
 * the whole render.
 *
 * @param {unknown} obj
 * @returns {string}  the script tag, or '' to skip this element
 */
function jsonLdScript(obj) {
  if (!obj || typeof obj !== 'object') return '';
  try {
    const json = JSON.stringify(obj);
    if (typeof json !== 'string') return '';
    return `<script type="application/ld+json">${escapeJsonLd(json)}</script>`;
  } catch (err) {
    console.warn('[webjs] metadata.jsonLd: skipped an entry that could not be serialized:', err && err.message);
    return '';
  }
}

// Internal helpers re-exported for unit testing.
export { escapeJsonLd as _escapeJsonLd, jsonLdScript as _jsonLdScript };

/**
 * Decide whether a `<link rel="modulepreload">` href needs a
 * `crossorigin="anonymous"` attribute. True for absolute URLs with
 * an http(s) scheme (vendor packages from jspm.io etc.); false for
 * same-origin paths like `/__webjs/core/index.js`. Browsers require
 * crossorigin on cross-origin module preload, else the preload is
 * wasted or double-fetched. Same-origin URLs must NOT have it for
 * the same reason in reverse.
 *
 * Exported for tests; production callers use it via documentParts.
 *
 * @param {string} url
 * @returns {string}  either ` crossorigin="anonymous"` or empty
 */
export function preloadCrossOriginAttr(url) {
  return /^https?:\/\//i.test(url) ? ' crossorigin="anonymous"' : '';
}

/**
 * Look up the SRI integrity hash for a vendor URL and format it as a
 * `integrity="sha384-..."` attribute. Empty string for URLs without a
 * known hash (framework files, user code, vendor URLs in live-API
 * mode without a pin file).
 *
 * @param {string} url
 * @returns {string}
 */
export function integrityAttr(url) {
  const hash = vendorIntegrityFor(url);
  // Belt and suspenders: readPinFile already validates the integrity
  // value end-to-end against /^sha(256|384|512)-[A-Za-z0-9+/=]+$/, so
  // a valid hash has no HTML-special chars and escapeAttr is a no-op.
  // But emission goes through the same attribute-injection-safe path
  // as everything else in the SSR pipeline so a future regression in
  // the validator doesn't bypass it.
  return hash ? ` integrity="${escapeAttr(hash)}"` : '';
}

/**
 * Serialize a Next.js-shaped viewport object into the comma-separated
 * `content` string the meta tag expects. Recognised fields:
 *   width, height, initialScale, minimumScale, maximumScale,
 *   userScalable, viewportFit, interactiveWidget.
 * Other fields (themeColor, colorScheme) live on their own meta tags
 * and are handled by the caller: skipped here.
 *
 * @param {Record<string, unknown>} v
 * @returns {string}
 */
function serializeViewport(v) {
  const parts = [];
  /** @param {string} key @param {string} prop */
  const push = (key, prop) => {
    if (v[prop] !== undefined && v[prop] !== null && v[prop] !== '') {
      parts.push(`${key}=${v[prop]}`);
    }
  };
  push('width', 'width');
  push('height', 'height');
  push('initial-scale', 'initialScale');
  push('minimum-scale', 'minimumScale');
  push('maximum-scale', 'maximumScale');
  if (v.userScalable === false) parts.push('user-scalable=no');
  else if (v.userScalable === true) parts.push('user-scalable=yes');
  push('viewport-fit', 'viewportFit');
  push('interactive-widget', 'interactiveWidget');
  return parts.join(',');
}
