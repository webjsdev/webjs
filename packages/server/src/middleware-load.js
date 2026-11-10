/**
 * Loading and wrapping middleware the way Next.js does.
 *
 *   - The root file is `middleware.{ts,js,mts,mjs}` or, Next 16's name,
 *     `proxy.{ts,js,mts,mjs}`. Both at once is a boot error.
 *   - The function is the default export, else a named `middleware`, else a
 *     named `proxy` export (Next accepts all three).
 *   - `export const config = { matcher }` scopes it: a string, an array, or
 *     `{ source, has, missing }` objects. A request whose (base-path-stripped)
 *     path matches no entry skips straight to `next()`.
 *   - Returning `undefined` continues (Next's `NextResponse.next()` is the
 *     default), `next()` is memoized so calling it twice runs the rest of the
 *     chain once, and `next.waitUntil(promise)` keeps background work going
 *     after the response without failing it.
 *   - `request.cookies` is Next's RequestCookies over the request's cookies, and reading
 *     `request.nextUrl` (Next's extended URL) throws in dev with the fix.
 *   - A load failure FAILS CLOSED: a middleware that guards a route and cannot
 *     load must never let the request through unguarded. The root one rejects
 *     the analysis (dev overlay, prod readiness 503), a segment one answers 500.
 *
 * @module middleware-load
 */
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { devImport } from './dev-import.js';
import { requestCookieStore, markDynamicAccess } from './context.js';
import { parseCookieHeader, requestCookiesView } from './cookie-store.js';

const MIDDLEWARE_FILES = ['middleware.ts', 'middleware.js', 'middleware.mts', 'middleware.mjs'];
const PROXY_FILES = ['proxy.ts', 'proxy.js', 'proxy.mts', 'proxy.mjs'];

/** @param {string} p */
async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * The root middleware file, or null. Throws when both a `middleware.*` and a
 * `proxy.*` exist, since only one can be the app's middleware.
 * @param {string} appDir
 * @returns {Promise<string | null>}
 */
export async function findRootMiddleware(appDir) {
  let mw = null;
  let px = null;
  for (const n of MIDDLEWARE_FILES) if (!mw && await exists(join(appDir, n))) mw = n;
  for (const n of PROXY_FILES) if (!px && await exists(join(appDir, n))) px = n;
  if (mw && px) {
    const err = new Error(`[webjs] both ${mw} and ${px} exist at the app root. They are the same thing (proxy is Next 16's name for middleware), so only one may exist. Delete one, or merge them.`);
    /** @type {any} */ (err).code = 'WEBJS_APP_LAYOUT';
    throw err;
  }
  const name = mw || px;
  return name ? join(appDir, name) : null;
}

/**
 * The middleware function a module exports: `default`, then `middleware`,
 * then `proxy`. Throws naming the file when there is none.
 * @param {Record<string, unknown>} mod
 * @param {string} file
 * @returns {Function}
 */
export function resolveMiddlewareExport(mod, file) {
  for (const k of ['default', 'middleware', 'proxy']) {
    if (typeof mod[k] === 'function') return /** @type {Function} */ (mod[k]);
  }
  throw new Error(`[webjs] ${file} exports no middleware function. Export it as the default, or as a named \`middleware\` (or \`proxy\`) function, as in Next.js.`);
}

/**
 * @typedef {{ type: 'header' | 'cookie' | 'query' | 'host', key?: string, value?: string }} RouteHas
 * @typedef {string | { source: string, has?: RouteHas[], missing?: RouteHas[] }} MatcherEntry
 */

/**
 * A port of Next's `matchHas` (prepare-destination.ts): each `has` condition
 * must hold and no `missing` one may. A condition with no `value` checks
 * presence; a `value` is a regex anchored to the whole value.
 * @param {Request} req
 * @param {URL} url
 * @param {RouteHas[]} [has]
 * @param {RouteHas[]} [missing]
 */
export function matchHas(req, url, has = [], missing = []) {
  /** @type {Map<string, string> | null} */
  let cookies = null;
  /** @param {RouteHas} item */
  const holds = (item) => {
    /** @type {string | undefined | null} */
    let value;
    switch (item.type) {
      case 'header': value = req.headers.get(String(item.key).toLowerCase()); break;
      case 'cookie': value = (cookies ||= parseCookieHeader(req.headers.get('cookie'))).get(String(item.key)); break;
      case 'query': value = url.searchParams.get(String(item.key)); break;
      case 'host': value = (req.headers.get('host') || url.host).split(':', 1)[0].toLowerCase(); break;
      default: return false;
    }
    if (value == null || value === '') return false;
    if (!item.value) return true;
    return new RegExp(`^${item.value}$`).test(value);
  };
  return has.every(holds) && !missing.some(holds);
}

/**
 * Compile `config.matcher` into a predicate over a request, or null when the
 * middleware has no matcher (it runs for every request). Each source is a
 * Next path pattern (`/dashboard/:path*`, `/((?!api|_next).*)`) compiled with
 * URLPattern; a path with a trailing slash is retried without it.
 * @param {unknown} matcher
 * @param {string} file for the error message
 * @returns {((req: Request, url: URL) => boolean) | null}
 */
export function compileMatcher(matcher, file) {
  if (matcher == null) return null;
  const list = Array.isArray(matcher) ? matcher : [matcher];
  const entries = list.map((m) => {
    const e = typeof m === 'string' ? { source: m } : m;
    if (!e || typeof e.source !== 'string' || !e.source.startsWith('/')) {
      throw new Error(`[webjs] ${file}: config.matcher entries must be a path starting with "/" or { source, has?, missing? }; got ${JSON.stringify(m)}.`);
    }
    let pattern;
    try { pattern = new URLPattern({ pathname: e.source }); } catch (err) {
      throw new Error(`[webjs] ${file}: config.matcher "${e.source}" is not a valid path pattern (${/** @type {Error} */ (err).message}).`);
    }
    return { pattern, has: e.has, missing: e.missing };
  });
  return (req, url) => {
    const path = url.pathname;
    const alt = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : null;
    return entries.some((e) => (e.pattern.test({ pathname: path }) || (alt !== null && e.pattern.test({ pathname: alt })))
      && matchHas(req, url, e.has, e.missing));
  };
}

/**
 * Give a middleware's or a route handler's request Next's extras (#1686:
 * `NextRequest` is what both receive in Next.js): `request.cookies` (Next's
 * `RequestCookies`: a set there changes what the rest of this request reads and
 * sends nothing to the browser, `cookies().set()` does that) and, in dev, a
 * `request.nextUrl` that throws naming `new URL(request.url)`.
 * @param {Request} req
 * @param {boolean} dev
 */
export function decorateRequest(req, dev) {
  try {
    if (!Object.prototype.hasOwnProperty.call(req, 'cookies')) {
      Object.defineProperty(req, 'cookies', { configurable: true, get: () => { markDynamicAccess(); return requestCookiesView(requestCookieStore()); } });
    }
    if (!Object.prototype.hasOwnProperty.call(req, 'nextUrl')) {
      Object.defineProperty(req, 'nextUrl', {
        configurable: true,
        get() {
          if (dev) throw new Error('[webjs] request.nextUrl is Next.js\'s extended URL, which WebJs does not add: middleware receives the platform Request. Use new URL(request.url) instead.');
          return new URL(req.url);
        },
      });
    }
  } catch { /* a frozen request: leave it as the platform made it */ }
}

/**
 * Wrap a middleware function with Next's call semantics (see the module doc).
 * @param {Function} fn
 * @param {((req: Request, url: URL) => boolean) | null} matcher
 * @param {{ dev: boolean, file: string, logger?: { error?: (...a: any[]) => void } }} opts
 * @returns {(req: Request, next: () => Promise<Response>) => Promise<Response>}
 */
export function wrapMiddleware(fn, matcher, opts) {
  return async (req, next) => {
    if (matcher) {
      let url;
      try { url = new URL(req.url); } catch { return next(); }
      if (!matcher(req, url)) return next();
    }
    /** @type {Promise<Response> | null} */
    let ran = null;
    const once = /** @type {(() => Promise<Response>) & { waitUntil: (p: Promise<unknown>) => void }} */ (
      Object.assign(() => (ran ||= Promise.resolve().then(next)), {
        waitUntil(/** @type {Promise<unknown>} */ p) {
          Promise.resolve(p).catch((e) => opts.logger?.error?.(`[webjs] next.waitUntil promise rejected in ${opts.file}`, { err: String(e) }));
        },
      }));
    decorateRequest(req, opts.dev);
    const result = await fn(req, once);
    if (result === undefined || result === null) return once();
    if (result instanceof Response) return result;
    throw new Error(`[webjs] ${opts.file} returned ${typeof result === 'object' ? 'a non-Response object' : typeof result}. Middleware returns a Response to answer, or calls next() (returning nothing also continues).`);
  };
}

/**
 * Load a middleware module into its wrapped form. Throws (fail closed) when
 * the module fails to import, exports no function, or has a bad matcher.
 * @param {string} file
 * @param {boolean} dev
 * @param {{ error?: (...a: any[]) => void }} [logger]
 */
export async function loadMiddlewareFile(file, dev, logger) {
  const mod = await devImport(file, dev);
  // Segment middleware is loaded on every request, so the wrapper (and the
  // URLPattern compile of its matcher) is memoized on the module object: the
  // same module until its source changes (devImport keys a dev re-import on
  // the file's content), so an edit gets a fresh wrapper and nothing else does.
  const hit = WRAPPED.get(mod);
  if (hit && hit.dev === dev && hit.logger === logger) return hit.wrapped;
  const fn = resolveMiddlewareExport(mod, file);
  const config = mod.config && typeof mod.config === 'object' ? /** @type {any} */ (mod.config) : {};
  const matcher = compileMatcher(config.matcher, file);
  const wrapped = wrapMiddleware(fn, matcher, { dev, file, logger });
  WRAPPED.set(mod, { dev, logger, wrapped });
  return wrapped;
}

/** @type {WeakMap<object, { dev: boolean, logger: unknown, wrapped: Function }>} */
const WRAPPED = new WeakMap();

/**
 * Load the optional root middleware (or proxy). Null when there is none;
 * throws when it cannot be loaded, so the analysis refuses to serve.
 * @param {string} appDir
 * @param {boolean} dev
 * @param {{ error?: (...a: any[]) => void }} [logger]
 */
export async function loadRootMiddleware(appDir, dev, logger) {
  const file = await findRootMiddleware(appDir);
  if (!file) return null;
  return loadMiddlewareFile(file, dev, logger);
}
