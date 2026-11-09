/**
 * Server-side navigation helpers, modelled after NextJs.
 *
 * Usage (inside a server-only module: page, layout, API route, server action):
 *
 *   import { notFound, redirect } from '@webjsdev/core';
 *   if (!post) notFound();
 *   if (user.banned) redirect('/goodbye');
 *
 * Both throw a sentinel that the SSR pipeline catches. Never catch them
 * yourself: let them propagate.
 */

const NOT_FOUND = Symbol.for('webjs.notFound');
const REDIRECT = Symbol.for('webjs.redirect');
const FORBIDDEN = Symbol.for('webjs.forbidden');
const UNAUTHORIZED = Symbol.for('webjs.unauthorized');

/** @returns {never} */
export function notFound() {
  const err = new Error('webjs: notFound()');
  /** @type any */ (err).__webjs = NOT_FOUND;
  throw err;
}

/**
 * Throw a 403 Forbidden sentinel the SSR pipeline catches (#848, Next 15/16
 * parity). Renders the nearest `forbidden.{js,ts}` boundary at status 403, or a
 * default 403 page when none exists. Use for an authenticated user who lacks
 * permission (contrast `unauthorized()` for a not-logged-in user).
 *
 * @returns {never}
 */
export function forbidden() {
  const err = new Error('webjs: forbidden()');
  /** @type any */ (err).__webjs = FORBIDDEN;
  throw err;
}

/**
 * Throw a 401 Unauthorized sentinel the SSR pipeline catches (#848, Next 15/16
 * parity). Renders the nearest `unauthorized.{js,ts}` boundary at status 401, or
 * a default 401 page when none exists. Use for a request that is not
 * authenticated (contrast `forbidden()` for an authenticated-but-not-allowed
 * user).
 *
 * @returns {never}
 */
export function unauthorized() {
  const err = new Error('webjs: unauthorized()');
  /** @type any */ (err).__webjs = UNAUTHORIZED;
  throw err;
}

/**
 * Throw a redirect sentinel the SSR pipeline catches and turns into a 3xx.
 *
 * The status is OPTIONAL and, when omitted, is chosen by the catching site so
 * each kind of redirect gets the conventional code:
 *   - thrown during a GET page/layout render (a gating redirect like an auth
 *     bounce to `/login`): 302 Found, the conventional GET-to-GET code.
 *   - thrown from a `route.ts` handler: 307 Temporary Redirect.
 *   - thrown from a server action bound to a form: always 303 See Other, so
 *     the browser follows with a GET and the action runs once (Next parity).
 *   - thrown from a server action called over RPC: the client router
 *     navigates to the target.
 * Pass an explicit status to override: `redirect('/x', 308)` (permanent) or the
 * options form `redirect('/x', { status: 301 })`. An explicit status wins at
 * every catching site.
 *
 * The second argument may instead be `'push'` or `'replace'` (Next's
 * `RedirectType`): how the client records the navigation when the redirect
 * reaches the browser from an action called over RPC. `'replace'` is the
 * default there.
 *
 * @param {string} url
 * @param {number | RedirectType | { status?: number, type?: RedirectType }} [status]
 *   explicit status (number), a `RedirectType`, or `{ status, type }`; omit to
 *   let the catching site pick.
 * @returns {never}
 */
export function redirect(url, status) {
  /** @type {number | undefined} */
  let code;
  /** @type {RedirectType | undefined} */
  let type;
  if (status === 'push' || status === 'replace') type = status;
  else if (typeof status === 'object' && status !== null) {
    code = status.status;
    if (status.type === 'push' || status.type === 'replace') type = status.type;
  } else if (typeof status === 'number') code = status;
  const err = new Error(`webjs: redirect(${url})`);
  /** @type any */ (err).__webjs = REDIRECT;
  /** @type any */ (err).url = url;
  // Left undefined when the caller did not specify one, so the catching site
  // can apply its convention (302 GET gate vs 307 action). A caller-supplied
  // code is stored verbatim and overrides that convention.
  /** @type any */ (err).status = typeof code === 'number' ? code : undefined;
  /** @type any */ (err).redirectType = type;
  throw err;
}

/**
 * Throw a PERMANENT redirect sentinel, Next.js's `permanentRedirect()`: a 308
 * Permanent Redirect at every catching site that answers with a 3xx. Use it
 * when a URL has moved for good (a renamed slug); browsers and search engines
 * remember a 308.
 *
 * @param {string} url
 * @param {RedirectType} [type] how an RPC caller's client records the navigation.
 * @returns {never}
 */
export function permanentRedirect(url, type) {
  return redirect(url, { status: 308, type });
}

/** @typedef {'push' | 'replace'} RedirectType */

/** @param {unknown} e */
export function isNotFound(e) {
  return !!e && /** @type any */ (e).__webjs === NOT_FOUND;
}

/** @param {unknown} e */
export function isRedirect(e) {
  return !!e && /** @type any */ (e).__webjs === REDIRECT;
}

/** @param {unknown} e */
export function isForbidden(e) {
  return !!e && /** @type any */ (e).__webjs === FORBIDDEN;
}

/** @param {unknown} e */
export function isUnauthorized(e) {
  return !!e && /** @type any */ (e).__webjs === UNAUTHORIZED;
}
