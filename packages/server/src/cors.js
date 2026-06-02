/**
 * Reusable CORS primitive for webjs.
 *
 * Two surfaces share one origin-resolution + header-building core:
 *
 * 1. `cors(options)` returns a webjs MIDDLEWARE `(req, next) => Response`,
 *    usable in `middleware.js` (root or per-segment) or wrapped around a
 *    `route.js` handler. This is the public app-facing API.
 * 2. The `expose()` REST path (`actions.js`) reuses `resolveOrigin` and
 *    `applyCorsHeaders` so a route's `cors` config and a standalone
 *    `cors()` middleware compute identical headers.
 *
 * Web-standards-first: the option shape mirrors the well-trodden
 * `cors` npm package and the Fetch CORS protocol. We reflect the
 * request `Origin` ONLY when the policy allows it, never blanket-reflect
 * with credentials, and always append (never clobber) `Vary: Origin`
 * when the allowed origin is dynamic, to keep shared caches correct.
 *
 * The one hard CORS-spec rule we enforce: a wildcard origin (`*`) is
 * incompatible with `credentials: true`. The browser rejects
 * `Access-Control-Allow-Origin: *` together with
 * `Access-Control-Allow-Credentials: true`, so when both are configured
 * we NARROW to the reflected request origin instead of sending `*`
 * (and append `Vary: Origin`, since the response now varies by origin).
 *
 * ```js
 * // middleware.js
 * import { cors } from '@webjsdev/server';
 * export default cors({ origin: ['https://app.example.com'], credentials: true });
 * ```
 *
 * @module cors
 */

/**
 * @typedef {string | RegExp | ((origin: string) => boolean)} OriginRule
 *   A single origin rule. A function receives the request `Origin` and
 *   returns whether it is allowed.
 */

/**
 * @typedef {Object} CorsOptions
 * @property {'*' | true | OriginRule | OriginRule[]} [origin]
 *   Allowed origin policy. `'*'` / `true` allows any origin. A string is
 *   an exact match. A `RegExp` tests the origin. A function returns a
 *   boolean. An array is an allow-list of any of the above (matches if
 *   ANY entry matches). Defaults to `'*'`.
 * @property {boolean} [credentials]
 *   Send `Access-Control-Allow-Credentials: true`. Forces a wildcard
 *   origin to narrow to the reflected request origin (spec requirement).
 * @property {string[] | string} [methods]
 *   Methods advertised on a preflight. Defaults to the common verb set.
 * @property {string[] | string} [allowedHeaders]
 *   Request headers advertised on a preflight. Defaults to reflecting
 *   the preflight's `Access-Control-Request-Headers`.
 * @property {string[] | string} [exposedHeaders]
 *   Response headers exposed to client JS via
 *   `Access-Control-Expose-Headers`.
 * @property {number} [maxAge]
 *   Preflight cache lifetime in seconds (`Access-Control-Max-Age`).
 */

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

/** @param {string[] | string | undefined} v @returns {string | undefined} */
function csv(v) {
  if (v == null) return undefined;
  return Array.isArray(v) ? v.join(', ') : String(v);
}

/**
 * Decide whether `origin` is allowed by a single rule.
 *
 * @param {OriginRule | '*' | true} rule
 * @param {string} origin
 * @returns {boolean}
 */
function ruleAllows(rule, origin) {
  if (rule === '*' || rule === true) return true;
  if (typeof rule === 'string') return rule === origin;
  if (rule instanceof RegExp) return rule.test(origin);
  if (typeof rule === 'function') return rule(origin) === true;
  return false;
}

/**
 * Resolve a CORS origin policy against a request `Origin` header.
 *
 * Returns the value to send in `Access-Control-Allow-Origin`, or `null`
 * when the origin is NOT allowed (the caller then omits the header so the
 * browser blocks the cross-origin read). The shape:
 *
 * - `{ allowOrigin: '*', dynamic: false }`  any origin, no credentials.
 * - `{ allowOrigin: '<origin>', dynamic: true }`  reflected, varies by origin.
 * - `null`  disallowed.
 *
 * `credentials: true` forces a wildcard to narrow: `*` is invalid with
 * credentials, so we reflect the concrete request origin (and mark the
 * result dynamic so `Vary: Origin` is appended). With no `Origin` header
 * a wildcard policy still resolves to `*` (or, under credentials, yields
 * no reflected value), matching same-origin / server-to-server traffic.
 *
 * @param {'*' | true | OriginRule | OriginRule[]} policy
 * @param {string} origin  request `Origin` header (`''` if absent)
 * @param {boolean} credentials
 * @returns {{ allowOrigin: string, dynamic: boolean } | null}
 */
export function resolveOrigin(policy, origin, credentials) {
  const rules = Array.isArray(policy) ? policy : [policy];
  const isWildcard = rules.some((r) => r === '*' || r === true);

  if (isWildcard) {
    // Wildcard + credentials is invalid per the CORS spec: a literal `*`
    // ACAO can never be combined with `Allow-Credentials: true`. Narrow
    // to the reflected origin (dynamic), or refuse if no origin is given.
    if (credentials) {
      if (!origin) return null;
      return { allowOrigin: origin, dynamic: true };
    }
    return { allowOrigin: '*', dynamic: false };
  }

  if (!origin) return null;
  const allowed = rules.some((r) => ruleAllows(r, origin));
  if (!allowed) return null;
  return { allowOrigin: origin, dynamic: true };
}

/** @param {Headers} headers append `Vary: Origin` without clobbering existing Vary */
function appendVaryOrigin(headers) {
  const existing = headers.get('vary');
  if (!existing) {
    headers.set('vary', 'Origin');
    return;
  }
  const parts = existing.split(',').map((s) => s.trim().toLowerCase());
  if (parts.includes('*') || parts.includes('origin')) return;
  headers.append('vary', 'Origin');
}

/**
 * Mutate `headers` in place to carry the actual-request CORS headers for
 * a resolved origin: `Access-Control-Allow-Origin`, optional
 * `Allow-Credentials`, optional `Expose-Headers`, and `Vary: Origin`
 * when the origin is dynamic.
 *
 * @param {Headers} headers
 * @param {{ allowOrigin: string, dynamic: boolean }} resolved
 * @param {{ credentials?: boolean, exposedHeaders?: string[] | string }} cfg
 */
export function applyCorsHeaders(headers, resolved, cfg) {
  headers.set('access-control-allow-origin', resolved.allowOrigin);
  if (cfg.credentials && resolved.allowOrigin !== '*') {
    headers.set('access-control-allow-credentials', 'true');
  }
  const exposed = csv(cfg.exposedHeaders);
  if (exposed) headers.set('access-control-expose-headers', exposed);
  if (resolved.dynamic) appendVaryOrigin(headers);
}

/**
 * Build a CORS middleware `(req, next) => Response`.
 *
 * Behavior:
 * - On an OPTIONS preflight (carries `Access-Control-Request-Method`),
 *   short-circuit with a 204 carrying Allow-Methods / Allow-Headers /
 *   Max-Age. `next()` is NOT called.
 * - On an actual request, call `next()` then attach the actual-request
 *   CORS headers to the response.
 * - A disallowed origin gets NO `Access-Control-Allow-Origin` (the
 *   browser blocks the read). The server still serves the actual request
 *   (CORS is browser-enforced); a disallowed PREFLIGHT returns a bare 204
 *   with no CORS headers, so the browser blocks the follow-up.
 *
 * @param {CorsOptions} [options]
 * @returns {(req: Request, next: () => Promise<Response>) => Promise<Response>}
 */
export function cors(options = {}) {
  const policy = options.origin ?? '*';
  const credentials = options.credentials === true;
  const methods = csv(options.methods) || DEFAULT_METHODS.join(', ');
  const allowedHeaders = csv(options.allowedHeaders);
  const exposedHeaders = options.exposedHeaders;
  const maxAge = options.maxAge;

  return async function corsMiddleware(req, next) {
    const origin = req.headers.get('origin') || '';
    const resolved = resolveOrigin(policy, origin, credentials);
    const isPreflight =
      req.method === 'OPTIONS' && req.headers.has('access-control-request-method');

    if (isPreflight) {
      const headers = new Headers();
      // Disallowed preflight: bare 204, no CORS headers. The browser then
      // blocks the actual request, which is the correct CORS posture.
      if (resolved) {
        applyCorsHeaders(headers, resolved, { credentials, exposedHeaders });
        headers.set('access-control-allow-methods', methods);
        const reqHeaders =
          allowedHeaders || req.headers.get('access-control-request-headers') || 'content-type';
        headers.set('access-control-allow-headers', reqHeaders);
        if (maxAge != null) headers.set('access-control-max-age', String(maxAge));
      }
      return new Response(null, { status: 204, headers });
    }

    const resp = await next();
    if (!resolved) return resp;
    // Some synthetic Responses have immutable headers; fall back to a copy.
    try {
      applyCorsHeaders(resp.headers, resolved, { credentials, exposedHeaders });
      return resp;
    } catch {
      const headers = new Headers(resp.headers);
      applyCorsHeaders(headers, resolved, { credentials, exposedHeaders });
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
    }
  };
}
