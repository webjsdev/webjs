/**
 * Server-action error sanitization (#749).
 *
 * A thrown server action must NOT leak its raw error message to the client in
 * production. Most thrown errors are NOT author-controlled (a Postgres driver
 * error carries the constraint / column name, an `ECONNREFUSED` carries an
 * internal host / IP, an fs error carries an absolute server path), and the RPC
 * client surfaces the message. So in prod we return a GENERIC message plus a
 * short `digest`, and log the full error server-side keyed by that digest, the
 * same model as Next.js's server-action errors. An author-facing user-safe
 * message belongs on the `ActionResult` `{ success: false, error }` envelope
 * (the expected-failure channel), not on a throw.
 *
 * Used by both the buffered RPC error path (`actions.js`) and the streaming
 * error frame (`action-stream.js`); it is a leaf module so neither importer
 * creates a cycle.
 *
 * @module action-error
 */

import { isRedirect, isNotFound, isForbidden, isUnauthorized } from '@webjsdev/core';
import { digestHex } from './crypto-utils.js';

/** The generic client-facing message for a sanitized prod action error. */
export const GENERIC_ERROR_MESSAGE = 'Internal server error';

/**
 * `redirect()` / `notFound()` throw `Error` sentinels tagged with a `__webjs`
 * SYMBOL VALUE. They are control flow, not errors to sanitize, and their
 * message is not sensitive, so the error path passes them through unchanged.
 *
 * Reuses core's authoritative `isRedirect` / `isNotFound`, which match the exact
 * sentinel symbol value (`__webjs === REDIRECT` / `=== NOT_FOUND`), NOT mere
 * property presence: a genuine error that happens to carry a `__webjs` property
 * must still be sanitized, never passed through.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isControlFlowThrow(err) {
  return isRedirect(err) || isNotFound(err) || isForbidden(err) || isUnauthorized(err);
}

/**
 * A short, stable correlation digest for a thrown error (a hash of its message
 * and stack). The SAME value is logged server-side and returned to the client,
 * so a generic client error maps back to the full server log line, and two
 * occurrences of the same error share a digest (groupable in an APM).
 *
 * @param {unknown} err
 * @returns {Promise<string>}
 */
export async function errorDigest(err) {
  const basis = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
  return (await digestHex('SHA-256', basis)).slice(0, 10);
}
