/**
 * The form-action flash: what a form-bound server action returned, carried
 * across the 303 that answers a successful submission, so the page it lands
 * on still sees the result (`actionData`), and the NEXT submission of the same
 * action receives it as `prevState` (Next.js's `useActionState(action,
 * initial)` contract, `(prevState, formData) => newState`).
 *
 * The carrier is one cookie, `__webjs_flash`: HttpOnly, SameSite=Lax, 60
 * seconds, HMAC-signed (so a visitor cannot forge a `prevState`), capped at
 * 2 KB (a larger result is simply not carried; the action's own redirect
 * still happens). The payload is the rich-serialized result (minus its
 * `redirect`), the action's `<hash>/<fn>` identity, and whether a page has
 * already displayed it: a result is shown ONCE as `actionData`, then kept
 * only as the next `prevState`.
 *
 * Key: `WEBJS_SECRET`, else `AUTH_SECRET`, else `SESSION_SECRET`, else (in
 * development and tests) the persisted dev secret, else a random per-process key (so a
 * flash still works on one instance; a multi-instance deploy sets a secret).
 *
 * @module action-flash
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { stringify, parse } from '@webjsdev/core';
import { shared } from './process-shared.js';
import { devSecret, devSecretApplies } from './dev-secret.js';
import { stripBasePath } from './base-path.js';

export const FLASH_COOKIE = '__webjs_flash';
const MAX_BYTES = 2048;
const MAX_AGE_SECONDS = 60;

const _key = shared('action-flash-key', () => ({ random: randomBytes(32).toString('hex'), warned: false, dev: /** @type {string | undefined | null} */ (null) }));

function key() {
  // Any secret the app already set signs it, and in development and tests the
  // persisted dev secret does, so a flash survives a dev server restart too.
  const set = process.env.WEBJS_SECRET || process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (set) return set;
  // Whether the dev secret applies is decided on every call, as devSecret
  // decides it, so a flash signed before NODE_ENV was set does not pin the
  // random key for the rest of the process. Only a secret it RETURNS is kept:
  // it is a file, and a sign and its verify must use one key even when .webjs
  // cannot be written (devSecret then makes a new one per call).
  if (devSecretApplies()) {
    if (!_key.dev) _key.dev = devSecret('WEBJS_SECRET') || null;
    if (_key.dev) return _key.dev;
  }
  // A per-process key verifies only on the instance that signed it, so behind
  // a load balancer a flash whose 303 lands elsewhere is silently dropped. Say
  // so once in production rather than let it look like a missing feature.
  if (process.env.NODE_ENV === 'production' && !_key.warned) {
    _key.warned = true;
    console.warn('[webjs] none of WEBJS_SECRET, AUTH_SECRET or SESSION_SECRET is set, so form action results (actionData after a redirect, prevState) are signed with a per-process key and are lost when the redirect lands on another instance. Set any one of them.');
  }
  return _key.random;
}

/**
 * HMAC of a flash body. The input is prefixed so the signature is unrelated by
 * construction to any other HMAC made with the same secret (`AUTH_SECRET` also
 * signs the session), whatever either format becomes.
 * @param {string} s
 */
function sign(s) {
  return createHmac('sha256', key()).update(`webjs-flash:${s}`).digest('base64url');
}

/**
 * `path` is the page the success redirect lands on: only that page shows it.
 * @typedef {{ id: string, result: unknown, shown: boolean, path?: string }} Flash
 */

/**
 * Encode a flash as a cookie value, or null when it does not fit the cap.
 * @param {Flash} flash
 * @returns {Promise<string | null>}
 */
export async function encodeFlash(flash) {
  let result = flash.result;
  if (result && typeof result === 'object' && !Array.isArray(result) && 'redirect' in result) {
    const { redirect: _drop, ...rest } = /** @type {Record<string, unknown>} */ (result);
    result = rest;
  }
  let body;
  try {
    body = Buffer.from(JSON.stringify({ a: flash.id, s: flash.shown ? 1 : 0, ...(flash.path ? { p: flash.path } : {}), r: await stringify(result ?? null) })).toString('base64url');
  } catch {
    return null; // unserializable result: nothing to carry
  }
  const value = `${body}.${sign(body)}`;
  return value.length > MAX_BYTES ? null : value;
}

/**
 * Decode and verify a flash cookie value; null when absent, forged, or broken.
 * @param {string | undefined | null} value
 * @returns {Promise<Flash | null>}
 */
export async function decodeFlash(value) {
  if (!value || typeof value !== 'string') return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const mac = Buffer.from(value.slice(dot + 1));
  const want = Buffer.from(sign(body));
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return null;
  try {
    const o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!o || typeof o.a !== 'string' || typeof o.r !== 'string') return null;
    return { id: o.a, shown: o.s === 1, ...(typeof o.p === 'string' ? { path: o.p } : {}), result: parse(o.r) };
  } catch {
    return null;
  }
}

/**
 * The `Set-Cookie` value that stores a flash (or clears it with null).
 * @param {string | null} value
 */
export function flashSetCookie(value) {
  return value
    ? `${FLASH_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`
    : `${FLASH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Read the flash cookie off a request.
 * @param {Request | undefined | null} req
 * @returns {Promise<Flash | null>}
 */
export async function readFlash(req) {
  const header = req && req.headers.get('cookie');
  if (!header || !header.includes(FLASH_COOKIE)) return null;
  const m = new RegExp(`(?:^|;\\s*)${FLASH_COOKIE}=([^;]*)`).exec(header);
  return m ? decodeFlash(m[1]) : null;
}

/** A path without its trailing slash (the root stays "/"). @param {string} p */
const trimSlash = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

/**
 * The app-root-relative form of a path: the `webjs.basePath` mount prefix
 * removed when the path is under it (a redirect target may be written with or
 * without it), else the path as is.
 * @param {string} pathname
 * @param {string} mount
 */
export function appRelativePath(pathname, mount) {
  return (mount && stripBasePath(pathname, mount)) || pathname;
}

/**
 * Carry an unshown flash across a redirect of the page it is bound to (#1686).
 * A success redirect names a path, and a redirects rule, middleware or the
 * trailing-slash policy can send that path on (`/posts` to `/en/posts`); the
 * flash then has to follow, or no page would ever show it and it would turn
 * up stale on a later visit. When `res` redirects the request the flash is
 * bound to, to another same-origin path, the flash is re-set bound to that
 * path. Mutates `res.headers`; a no-op for anything else.
 * @param {Request} req
 * @param {Response} res
 * @param {string} mount the app's `webjs.basePath` ('' when none)
 */
export async function carryFlashAcrossRedirect(req, res, mount) {
  if (res.status < 300 || res.status >= 400) return;
  const location = res.headers.get('location');
  if (!location) return;
  const flash = await readFlash(req);
  if (!flash || flash.shown || !flash.path) return;
  const from = new URL(req.url);
  if (trimSlash(appRelativePath(from.pathname, mount)) !== trimSlash(flash.path)) return;
  let to;
  try { to = new URL(location, from); } catch { return; }
  if (to.origin !== from.origin) return;
  const path = appRelativePath(to.pathname, mount);
  if (trimSlash(path) === trimSlash(flash.path)) return;
  const value = await encodeFlash({ ...flash, path });
  if (value) res.headers.append('set-cookie', flashSetCookie(value));
}
