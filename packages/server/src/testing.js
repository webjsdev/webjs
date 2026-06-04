/**
 * Server-side test harness helpers (issue #267).
 *
 * `createRequestHandler(...).handle(request)` drives the FULL webjs pipeline
 * (middleware, routing, SSR, page actions, server-action RPC, auth + CSRF), and
 * the framework's own suite already drives it. These helpers are THIN builders
 * over the native `Request` / `Response` around that `handle()`, so an app test
 * reads as a one-liner instead of hand-assembling a `Request`, minting a CSRF
 * pair, or serializing an action payload by hand.
 *
 * They are intentionally not a test framework: each is a few lines, returns
 * native objects, and reuses the REAL cookie / header names (`csrf.js`) and the
 * REAL wire serializer (`serializer.js` -> `@webjsdev/core`), never a parallel
 * fake. The most robust auth helper drives the REAL login through `handle()` and
 * captures the `Set-Cookie`, so it exercises the production cookie shape.
 *
 * Usage (a scaffolded app test):
 *
 * ```js
 * import { createRequestHandler } from '@webjsdev/server';
 * import { testRequest, getCsrf, invokeActionForTest } from '@webjsdev/server/testing';
 *
 * const app = await createRequestHandler({ appDir: process.cwd(), dev: true });
 *
 * // 1. fire a request through the real pipeline
 * const res = await testRequest(app.handle, '/about');
 *
 * // 2. round-trip an action through the real /__webjs/action/<hash>/<fn> path
 * const out = await invokeActionForTest(app, 'modules/m/act.server.js', 'echo', [new Date()]);
 * ```
 *
 * @module testing
 */

import { hashFile, RPC_CONTENT_TYPE } from './actions.js';
import { CSRF_COOKIE, CSRF_HEADER } from './csrf.js';
import { getSerializer } from './serializer.js';
import { join, sep } from 'node:path';

/**
 * A `handle` is whatever `createRequestHandler(...).handle` is: a function
 * taking a native `Request` and returning a `Promise<Response>`.
 * @typedef {(req: Request) => Promise<Response>} Handle
 */

/** Dummy origin used to turn a bare path (`/about`) into an absolute URL. */
const DUMMY_ORIGIN = 'http://webjs.test';

/**
 * Coerce a path-or-Request `input` into a native `Request`.
 *
 * A string starting with `/` is prefixed with a dummy origin (the pipeline only
 * reads `url.pathname` + `url.search`, so the origin is irrelevant); a full URL
 * string is used as-is; a `Request` is passed through (with `init` overrides
 * merged when provided).
 *
 * @param {string | Request} input
 * @param {RequestInit} [init]
 * @returns {Request}
 */
export function toRequest(input, init) {
  if (input instanceof Request) {
    return init ? new Request(input, init) : input;
  }
  const url = input.startsWith('/') ? DUMMY_ORIGIN + input : input;
  return new Request(url, init);
}

/**
 * Fire a request through the real `handle()` pipeline and return the `Response`.
 *
 * The documented one-liner: `const res = await testRequest(app.handle, '/about')`.
 * Accepts a bare path (prefixed with a dummy origin), a full URL string, or a
 * pre-built `Request`. `init` is the standard `RequestInit` (method, headers,
 * body, ...).
 *
 * @param {Handle} handle
 * @param {string | Request} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function testRequest(handle, input, init) {
  return handle(toRequest(input, init));
}

/**
 * Read the `webjs_csrf` cookie value off a response's `Set-Cookie` header(s).
 * Returns null when the response set no CSRF cookie.
 *
 * @param {Response} res
 * @returns {string | null}
 */
export function readCsrfCookie(res) {
  const cookies = getSetCookies(res);
  for (const c of cookies) {
    const m = new RegExp(`(?:^|\\s)${CSRF_COOKIE}=([^;]+)`).exec(c);
    if (m) {
      try { return decodeURIComponent(m[1]); } catch { return m[1]; }
    }
  }
  return null;
}

/**
 * Collect every `Set-Cookie` value off a `Response`, preferring the
 * structured `getSetCookie()` (which keeps multiple cookies separate) and
 * falling back to the single combined header.
 *
 * @param {Response} res
 * @returns {string[]}
 */
export function getSetCookies(res) {
  const h = res.headers;
  if (typeof h.getSetCookie === 'function') {
    const list = h.getSetCookie();
    if (list && list.length) return list;
  }
  const single = h.get('set-cookie');
  return single ? [single] : [];
}

/**
 * Turn a list of `Set-Cookie` header values into a single `Cookie` request
 * header value (`name=value; name2=value2`). Strips the cookie attributes
 * (`Path`, `Max-Age`, ...), keeping only the `name=value` pair of each.
 *
 * @param {string[]} setCookies
 * @returns {string}
 */
export function cookiesToHeader(setCookies) {
  return setCookies
    .map((c) => c.split(';', 1)[0].trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Do an initial GET to mint a CSRF token, returning the `{ cookie, token }`
 * pair so a test can send a CSRF-valid action request. `cookie` is a ready-made
 * `Cookie` request-header value; `token` is the bare value for the
 * `x-webjs-csrf` header. Reuses the REAL cookie / header names from `csrf.js`.
 *
 * @param {Handle} handle
 * @param {string} [path] the GET path used to issue the cookie (default `/`)
 * @returns {Promise<{ cookie: string, token: string, header: string }>}
 */
export async function getCsrf(handle, path = '/') {
  const res = await testRequest(handle, path);
  const token = readCsrfCookie(res);
  if (!token) {
    throw new Error(
      `getCsrf: GET ${path} issued no ${CSRF_COOKIE} cookie. The first SSR ` +
      `response issues it; hit a real page route (or pass a path that renders).`,
    );
  }
  return {
    token,
    header: CSRF_HEADER,
    cookie: `${CSRF_COOKIE}=${encodeURIComponent(token)}`,
  };
}

/**
 * Merge an extra cookie string into a `RequestInit`'s `Cookie` header,
 * preserving any cookie already on `init.headers`.
 *
 * @param {RequestInit} [init]
 * @param {string} cookieValue a `name=value; name2=value2` string
 * @returns {RequestInit}
 */
export function withCookies(init = {}, cookieValue) {
  const headers = new Headers(init.headers || {});
  const existing = headers.get('cookie');
  headers.set('cookie', existing ? `${existing}; ${cookieValue}` : cookieValue);
  return { ...init, headers };
}

/**
 * Attach an auth/session cookie (captured from a real login `Set-Cookie`) to a
 * `RequestInit` so a follow-up request hits a protected route as the logged-in
 * user. A thin convenience over `withCookies`; the cookie value comes from the
 * REAL session mechanism (see `loginAndGetCookies`), never a fabricated shape.
 *
 * @param {RequestInit} [init]
 * @param {string} sessionCookie a `Cookie` header value (e.g. from `loginAndGetCookies`)
 * @returns {RequestInit}
 */
export function withSessionCookie(init = {}, sessionCookie) {
  return withCookies(init, sessionCookie);
}

/**
 * Drive the REAL credentials login through `handle()` and return the resulting
 * cookies as a ready-to-reuse `Cookie` request-header value, so a test can hit a
 * protected route as a logged-in user. This exercises the production auth flow
 * (the `app/api/auth/[...path]/route.ts` handler + `createAuth`'s
 * `Set-Cookie`), so the captured cookie is the genuine signed session cookie,
 * not a fabricated one.
 *
 * Defaults target `createAuth`'s credentials sign-in route
 * (`POST /api/auth/signin/credentials`, the path its handler actually routes a
 * credentials login through), posting a urlencoded `email` + `password`.
 * Override `loginPath` / `body` / `method` for a different auth wiring.
 *
 * @param {Handle} handle
 * @param {{ email: string, password: string }} credentials
 * @param {{
 *   loginPath?: string,
 *   method?: string,
 *   body?: BodyInit,
 *   contentType?: string,
 *   expectStatuses?: number[],
 * }} [opts]
 * @returns {Promise<{ cookies: string, setCookies: string[], response: Response }>}
 *   `cookies` is the combined `Cookie` header value; `setCookies` is the raw
 *   `Set-Cookie` list; `response` is the login response (a 302 on success).
 */
export async function loginAndGetCookies(handle, credentials, opts = {}) {
  const loginPath = opts.loginPath || '/api/auth/signin/credentials';
  const method = opts.method || 'POST';
  const contentType = opts.contentType || 'application/x-www-form-urlencoded';
  const body =
    opts.body != null
      ? opts.body
      : new URLSearchParams({
          email: credentials.email,
          password: credentials.password,
        }).toString();

  const res = await testRequest(handle, loginPath, {
    method,
    headers: { 'content-type': contentType },
    body,
  });

  const setCookies = getSetCookies(res);
  const cookies = cookiesToHeader(setCookies);
  if (!cookies) {
    throw new Error(
      `loginAndGetCookies: POST ${loginPath} returned no Set-Cookie (status ` +
      `${res.status}). The credentials were likely rejected, or the login path ` +
      `is wrong for this app's auth wiring (override opts.loginPath / opts.body).`,
    );
  }
  return { cookies, setCookies, response: res };
}

/**
 * Compute the RPC endpoint path for an action, addressing it the same way the
 * generated client stub does: by the SHA-256 hash of the action's ABSOLUTE file
 * path (`hashFile` in `actions.js`, the single source of truth) plus the
 * exported function name.
 *
 * `serverFilePath` may be absolute, or relative to `appDir` (joined with the
 * OS separator, matching `resolveServerModule`).
 *
 * @param {string} appDir the app root passed to `createRequestHandler`
 * @param {string} serverFilePath the `.server.{js,ts}` file (absolute or appDir-relative)
 * @param {string} fnName the exported action function name
 * @returns {Promise<string>} the path, e.g. `/__webjs/action/<hash>/<fn>`
 */
export async function actionEndpoint(appDir, serverFilePath, fnName) {
  const abs = isAbsolutePath(serverFilePath)
    ? serverFilePath
    : join(appDir, serverFilePath.split('/').join(sep));
  const hash = await hashFile(abs);
  return `/__webjs/action/${hash}/${fnName}`;
}

/** @param {string} p */
function isAbsolutePath(p) {
  return p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
}

/**
 * Round-trip a registered server action through the REAL
 * `/__webjs/action/<hash>/<fn>` endpoint: serialize `args` with the webjs
 * serializer (exactly as the client stub does), POST them with a valid CSRF
 * cookie + header, and parse the response with the serializer.
 *
 * Unlike a DIRECT import of the action (which calls the function in-process),
 * this exercises the production path: CSRF validation, the wire serializer
 * round-trip (so a `Date` / `Map` / `BigInt` arg or return is genuinely
 * encoded + decoded), and prod error sanitization (a thrown error surfaces as a
 * sanitized message, never the stack). That is why it catches a
 * serializer / CSRF / error-sanitization regression a direct import would miss.
 *
 * The action is addressed via `actionEndpoint` (the file-path hash + fn name),
 * the same scheme the generated stub uses.
 *
 * On a non-2xx response the parsed `error` is thrown as an `Error` whose
 * `status` property carries the HTTP status, mirroring the client stub's
 * behavior (so a CSRF 403 or a sanitized 500 surfaces as a throw a test can
 * assert on).
 *
 * @param {{ handle: Handle, appDir: string } | Handle} app
 *   the handler object (`{ handle, appDir }`, e.g. the `createRequestHandler`
 *   return) or, when you pass `opts.appDir` and `opts.endpoint`, just the
 *   `handle` function.
 * @param {string} serverFilePath the `.server.{js,ts}` action file (absolute or appDir-relative)
 * @param {string} fnName the exported action function name
 * @param {unknown[]} [args] positional args (serialized as the stub sends an arg array)
 * @param {{
 *   csrf?: { cookie: string, token: string },
 *   appDir?: string,
 *   extraCookies?: string,
 *   throwOnError?: boolean,
 * }} [opts]
 * @returns {Promise<any>} the parsed action return value
 */
export async function invokeActionForTest(app, serverFilePath, fnName, args = [], opts = {}) {
  const handle = typeof app === 'function' ? app : app.handle;
  const appDir = opts.appDir || (typeof app === 'object' ? app.appDir : undefined);
  if (!appDir) {
    throw new Error(
      'invokeActionForTest: appDir unknown. Pass the createRequestHandler ' +
      'return value (which carries appDir), or set opts.appDir.',
    );
  }
  const throwOnError = opts.throwOnError !== false;

  const endpoint = await actionEndpoint(appDir, serverFilePath, fnName);
  const csrf = opts.csrf || (await getCsrf(handle));

  const serializer = getSerializer();
  const body = await serializer.serialize(args);

  let cookie = csrf.cookie || `${CSRF_COOKIE}=${encodeURIComponent(csrf.token)}`;
  if (opts.extraCookies) cookie = `${cookie}; ${opts.extraCookies}`;

  const res = await testRequest(handle, endpoint, {
    method: 'POST',
    headers: {
      'content-type': RPC_CONTENT_TYPE,
      [CSRF_HEADER]: csrf.token,
      cookie,
    },
    body,
  });

  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  let parsed;
  if (ct.includes(RPC_CONTENT_TYPE)) parsed = serializer.deserialize(text);
  else if (ct.includes('application/json')) parsed = text ? JSON.parse(text) : null;
  else parsed = text;

  if (!res.ok && throwOnError) {
    const msg = (parsed && parsed.error) || `webjs action ${fnName} -> ${res.status}`;
    const err = /** @type {Error & { status?: number, response?: Response }} */ (new Error(msg));
    err.status = res.status;
    err.response = res;
    throw err;
  }
  return parsed;
}

/**
 * Lower-level variant of `invokeActionForTest` that returns the raw `Response`
 * (never throws on a non-2xx), so a test can assert on the status directly
 * (e.g. a CSRF-missing request returns 403). Send `opts.csrf = null` /
 * `opts.omitCsrf = true` to deliberately omit the CSRF header + cookie.
 *
 * @param {{ handle: Handle, appDir: string } | Handle} app
 * @param {string} serverFilePath
 * @param {string} fnName
 * @param {unknown[]} [args]
 * @param {{
 *   csrf?: { cookie: string, token: string } | null,
 *   omitCsrf?: boolean,
 *   appDir?: string,
 *   extraCookies?: string,
 *   contentType?: string,
 * }} [opts]
 * @returns {Promise<Response>}
 */
export async function rawActionRequest(app, serverFilePath, fnName, args = [], opts = {}) {
  const handle = typeof app === 'function' ? app : app.handle;
  const appDir = opts.appDir || (typeof app === 'object' ? app.appDir : undefined);
  if (!appDir) {
    throw new Error('rawActionRequest: appDir unknown. Pass the handler object or set opts.appDir.');
  }
  const endpoint = await actionEndpoint(appDir, serverFilePath, fnName);
  const serializer = getSerializer();
  const body = await serializer.serialize(args);

  /** @type {Record<string,string>} */
  const headers = { 'content-type': opts.contentType || RPC_CONTENT_TYPE };
  if (!opts.omitCsrf && opts.csrf !== null) {
    const csrf = opts.csrf || (await getCsrf(handle));
    headers[CSRF_HEADER] = csrf.token;
    let cookie = csrf.cookie || `${CSRF_COOKIE}=${encodeURIComponent(csrf.token)}`;
    if (opts.extraCookies) cookie = `${cookie}; ${opts.extraCookies}`;
    headers.cookie = cookie;
  } else if (opts.extraCookies) {
    headers.cookie = opts.extraCookies;
  }

  return testRequest(handle, endpoint, { method: 'POST', headers, body });
}
