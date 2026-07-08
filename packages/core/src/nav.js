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
 *   - thrown from a server action (a POST): 307 Temporary Redirect, which is
 *     method-preserving so the action's intent survives. (The PRG success
 *     path uses 303 separately.)
 * Pass an explicit status to override: `redirect('/x', 308)` (permanent) or the
 * options form `redirect('/x', { status: 301 })`. An explicit status wins at
 * every catching site.
 *
 * @param {string} url
 * @param {number | { status?: number }} [status] explicit status (number) or
 *   `{ status }`; omit to let the catching site pick (302 for a GET gate, 307
 *   for an action).
 * @returns {never}
 */
export function redirect(url, status) {
  const code = typeof status === 'object' && status !== null ? status.status : status;
  const err = new Error(`webjs: redirect(${url})`);
  /** @type any */ (err).__webjs = REDIRECT;
  /** @type any */ (err).url = url;
  // Left undefined when the caller did not specify one, so the catching site
  // can apply its convention (302 GET gate vs 307 action). A caller-supplied
  // code is stored verbatim and overrides that convention.
  /** @type any */ (err).status = typeof code === 'number' ? code : undefined;
  throw err;
}

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
