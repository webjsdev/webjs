import { pathToFileURL } from 'node:url';
import { makeThenable } from './thenable-params.js';

/**
 * Dispatch an incoming request to a matched API route.
 * API modules export methods as named async functions: GET, POST, PUT, PATCH, DELETE.
 *
 * Handlers receive a standard `Request` and return a standard `Response`.
 *
 * @param {import('./router.js').ApiRoute} route
 * @param {Record<string,string>} params
 * @param {Request} webRequest
 * @param {boolean} dev
 * @returns {Promise<Response>}
 */
export async function handleApi(route, params, webRequest, dev) {
  const url = pathToFileURL(route.file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  const mod = await import(url + bust);
  const method = webRequest.method.toUpperCase();
  const handler = mod[method];
  if (!handler) {
    return new Response(`Method ${method} not allowed`, {
      status: 405,
      headers: { allow: allowedMethods(mod).join(', ') },
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
    throw e;
  }
  if (result instanceof Response) return result;
  // Convenience: allow returning plain objects as JSON.
  return Response.json(result);
}

/** @param {Record<string,unknown>} mod */
function allowedMethods(mod) {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => typeof mod[m] === 'function');
}
