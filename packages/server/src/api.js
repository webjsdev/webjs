import { isRedirect, isNotFound, isForbidden, isUnauthorized } from '@webjsdev/core';
import { headerSafeLocation } from './redirect-location.js';
import { makeThenable } from './thenable-params.js';
import { devImport } from './dev-import.js';

/** Every method a route module may export (Next's HTTP_METHODS). */
const HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Dispatch an incoming request to a matched API route.
 * API modules export methods as named async functions: GET, HEAD, OPTIONS,
 * POST, PUT, PATCH, DELETE.
 *
 * Handlers receive a standard `Request` and return a standard `Response`.
 *
 * Next.js parity:
 *   - HEAD and OPTIONS are implemented automatically when the module does not
 *     export them (a port of Next's `autoImplementMethods`): HEAD runs GET and
 *     drops the body; OPTIONS answers 204 with a sorted `Allow`.
 *   - `redirect()` thrown from a handler answers 307 (308 from
 *     `permanentRedirect()`; an explicit status wins), and `notFound()` /
 *     `forbidden()` / `unauthorized()` answer 404 / 403 / 401 with no body.
 *     They are answered HERE, so no caller ever sees them as errors.
 *
 * @param {import('./router.js').ApiRoute} route
 * @param {Record<string, string | string[]>} params
 * @param {Request} webRequest
 * @param {boolean} dev
 * @returns {Promise<Response>}
 */
export async function handleApi(route, params, webRequest, dev) {
  const mod = await devImport(route.file, dev);
  const method = webRequest.method.toUpperCase();
  const implemented = HTTP_METHODS.filter((m) => typeof mod[m] === 'function');
  let handler = typeof mod[method] === 'function' ? mod[method] : null;
  let headOnly = false;
  if (!handler && method === 'HEAD' && typeof mod.GET === 'function') {
    handler = mod.GET;
    headOnly = true;
  }
  if (!handler && method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: allowHeader(implemented) } });
  }
  if (!handler) {
    return new Response(`Method ${method} not allowed`, {
      status: 405,
      headers: { allow: allowHeader(implemented) },
    });
  }
  // Route-handler params are awaitable AND sync-readable (#848, Next parity:
  // `const { id } = await params`). Non-enumerable `then`, so a handler that
  // spreads / JSON-stringifies params is unaffected.
  const thenableParams = makeThenable(params);
  /** @type any */ (webRequest).params = thenableParams;
  let result;
  try {
    result = await handler(webRequest, { params: thenableParams });
  } catch (e) {
    // A route handler that read its body via `readBody` (json.js) over the
    // size limit (issue #237) throws a BodyLimitError; surface it as 413 rather
    // than a generic 500. Detected via a marker so a cross-module-copy
    // instanceof miss never downgrades it.
    if (e && /** @type any */ (e).webjsBodyLimit) {
      return new Response('Payload Too Large', {
        status: 413,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    const control = controlFlowResponse(e);
    if (control) return control;
    throw e;
  }
  const res = result instanceof Response ? result : Response.json(result);
  if (!headOnly) return res;
  // A synthesized HEAD answers GET's status and headers with no body. GET's own
  // body is never read, so it is cancelled: a streamed one (SSE, a DB cursor)
  // would otherwise keep producing for no reader until it is collected.
  if (res.body && !res.bodyUsed) res.body.cancel().catch(() => {});
  return new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/**
 * The response Next.js gives a control-flow throw inside a route handler, or
 * null when `e` is a real error.
 * @param {unknown} e
 * @returns {Response | null}
 */
export function controlFlowResponse(e) {
  if (isRedirect(e)) {
    const r = /** @type any */ (e);
    return new Response(null, { status: r.status || 307, headers: { location: headerSafeLocation(r.url) } });
  }
  if (isNotFound(e)) return new Response(null, { status: 404 });
  if (isForbidden(e)) return new Response(null, { status: 403 });
  if (isUnauthorized(e)) return new Response(null, { status: 401 });
  return null;
}

/**
 * The `Allow` header Next sends: the implemented methods plus OPTIONS (always
 * answered) and HEAD (when GET exists), sorted.
 * @param {string[]} implemented
 */
function allowHeader(implemented) {
  const allow = new Set(['OPTIONS', ...implemented]);
  if (allow.has('GET')) allow.add('HEAD');
  return [...allow].sort().join(', ');
}
