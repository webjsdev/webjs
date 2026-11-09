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
 * Key: `WEBJS_SECRET`, else `AUTH_SECRET`, else a random per-process key (so
 * a flash still works on one instance; a multi-instance deploy sets a secret).
 *
 * @module action-flash
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { stringify, parse } from '@webjsdev/core';
import { shared } from './process-shared.js';

export const FLASH_COOKIE = '__webjs_flash';
const MAX_BYTES = 2048;
const MAX_AGE_SECONDS = 60;

const _key = shared('action-flash-key', () => ({ random: randomBytes(32).toString('hex') }));

function key() {
  return process.env.WEBJS_SECRET || process.env.AUTH_SECRET || _key.random;
}

/** @param {string} s */
function sign(s) {
  return createHmac('sha256', key()).update(s).digest('base64url');
}

/**
 * @typedef {{ id: string, result: unknown, shown: boolean }} Flash
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
    body = Buffer.from(JSON.stringify({ a: flash.id, s: flash.shown ? 1 : 0, r: await stringify(result ?? null) })).toString('base64url');
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
    return { id: o.a, shown: o.s === 1, result: parse(o.r) };
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
