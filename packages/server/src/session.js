/**
 * Session middleware with Remix-style Session class and SessionStorage interface.
 *
 * Storage owns the Session lifecycle:
 *   `storage.read(cookie) → Session`
 *   `storage.save(session) → cookie | null | ''`
 *
 * ```js
 * // middleware.ts
 * import { session } from '@webjsdev/server';
 * export default session({ secret: process.env.SESSION_SECRET });
 *
 * // In any handler:
 * import { getSession } from '@webjsdev/server';
 * const s = getSession(req);
 * s.set('userId', user.id);
 * s.flash('message', 'Welcome back!');
 * ```
 *
 * @module session
 */

import { getStore } from './cache.js';
import { markDynamicAccess } from './context.js';

// -- Web Crypto helpers ------------------------------------------------------
// Same shape as auth.js. We duplicate here rather than share a module
// because the helpers are small and the two consumers want different
// import surfaces.

const enc = new TextEncoder();

/** @param {string} secret @returns {Promise<CryptoKey>} */
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** @param {ArrayBuffer | ArrayBufferView} buf @returns {string} */
function b64url(buf) {
  let bytes;
  if (buf instanceof Uint8Array) bytes = buf;
  else if (buf instanceof ArrayBuffer) bytes = new Uint8Array(buf);
  else bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} str @returns {Uint8Array} */
function unb64url(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Generate a fresh base64url-encoded random 24-byte ID. Sync via Web Crypto. */
function randomId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

// ---------------------------------------------------------------------------
// Session class
// ---------------------------------------------------------------------------

/**
 * A session holds data for a specific user across multiple requests.
 *
 * Modeled after Remix's Session: get, set, has, unset, flash, destroy,
 * regenerateId.
 */
export class Session {
  #id;
  #data;
  #flash;
  #dirty = false;
  #destroyed = false;
  #deleteId;

  /**
   * @param {string} [id]
   * @param {{ data?: Record<string, unknown>, flash?: Record<string, unknown> }} [initial]
   */
  constructor(id, initial) {
    this.#id = id || randomId();
    this.#data = new Map(Object.entries(initial?.data || {}));
    this.#flash = new Map(Object.entries(initial?.flash || {}));
    if (this.#flash.size > 0) this.#dirty = true;
  }

  get id() { return this.#id; }
  get dirty() { return this.#dirty; }
  get destroyed() { return this.#destroyed; }
  get deleteId() { return this.#deleteId; }

  /** Serialized data for storage. */
  get data() {
    return {
      data: Object.fromEntries(this.#data),
      flash: Object.fromEntries(this.#flash),
    };
  }

  /** @param {string} key @returns {unknown} */
  get(key) {
    if (this.#destroyed) return undefined;
    return this.#data.get(key) ?? this.#flash.get(key);
  }

  /** @param {string} key @param {unknown} value */
  set(key, value) {
    if (this.#destroyed) throw new Error('Session has been destroyed');
    if (value == null) this.#data.delete(key);
    else this.#data.set(key, value);
    this.#dirty = true;
  }

  /** @param {string} key @returns {boolean} */
  has(key) {
    if (this.#destroyed) return false;
    return this.#data.has(key) || this.#flash.has(key);
  }

  /** @param {string} key */
  unset(key) {
    if (this.#destroyed) throw new Error('Session has been destroyed');
    this.#data.delete(key);
    this.#dirty = true;
  }

  /**
   * Set a value that exists for one request only.
   * @param {string} key @param {unknown} value
   */
  flash(key, value) {
    if (this.#destroyed) throw new Error('Session has been destroyed');
    this.#flash.set(key, value);
    this.#dirty = true;
  }

  /** Destroy the session. Use for logout. */
  destroy() {
    this.#destroyed = true;
    this.#data.clear();
    this.#flash.clear();
    this.#dirty = true;
  }

  /**
   * Regenerate the session ID. Call after login to prevent session fixation.
   * @param {boolean} [deleteOld=false]
   */
  regenerateId(deleteOld = false) {
    if (this.#destroyed) throw new Error('Session has been destroyed');
    if (deleteOld) this.#deleteId = this.#id;
    this.#id = randomId();
    this.#dirty = true;
  }
}

// ---------------------------------------------------------------------------
// SessionStorage interface
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SessionStorage
 * @property {(cookie: string | null) => Promise<Session>} read
 *   Create or restore a Session from the raw (unsigned) cookie value.
 * @property {(session: Session) => Promise<string | null>} save
 *   Persist session and return the raw cookie value to sign and set.
 *   Returns `null` if no cookie change needed, `''` to clear the cookie.
 */

/**
 * Cookie-based session storage. All data lives in the cookie itself.
 * Stateless: no server storage needed.
 *
 * @returns {SessionStorage}
 */
export function cookieSessionStorage() {
  return {
    async read(cookie) {
      if (cookie) {
        try {
          const parsed = JSON.parse(cookie);
          return new Session(parsed.id, { data: parsed.data, flash: parsed.flash });
        } catch {}
      }
      return new Session();
    },
    async save(session) {
      if (session.destroyed) return '';
      if (!session.dirty) return null;
      return JSON.stringify({ id: session.id, ...session.data });
    },
  };
}

/**
 * Server-side session storage. Session ID in cookie, data in cache store.
 *
 * @param {{ store?: import('./cache.js').CacheStore, maxAge?: number }} [opts]
 * @returns {SessionStorage}
 */
export function storeSessionStorage(opts = {}) {
  const store = opts.store || getStore();
  const maxAge = opts.maxAge || 86400_000;

  return {
    async read(cookie) {
      if (cookie) {
        const raw = await store.get(`session:${cookie}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            return new Session(cookie, { data: parsed.data, flash: parsed.flash });
          } catch {}
        }
      }
      return new Session();
    },
    async save(session) {
      if (session.deleteId) await store.delete(`session:${session.deleteId}`);
      if (session.destroyed) {
        await store.delete(`session:${session.id}`);
        return '';
      }
      if (!session.dirty) return null;
      await store.set(`session:${session.id}`, JSON.stringify(session.data), maxAge);
      return session.id;
    },
  };
}

// Backwards-compatible aliases
export const cookieSession = cookieSessionStorage;
export const storeSession = storeSessionStorage;

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

async function sign(value, secret) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(value));
  return `${value}.${b64url(sig)}`;
}

async function unsign(input, secret) {
  const idx = input.lastIndexOf('.');
  if (idx < 1) return null;
  const value = input.slice(0, idx);
  // crypto.subtle.verify is constant-time; replaces node:crypto's
  // explicit timingSafeEqual. Wrap in try/catch because malformed
  // base64 throws inside unb64url.
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      unb64url(input.slice(idx + 1)),
      enc.encode(value),
    );
    return ok ? value : null;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    out[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return out;
}

function serializeCookie(name, value, opts) {
  let str = `${name}=${encodeURIComponent(value)}`;
  str += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
  str += `; Path=${opts.path || '/'}`;
  if (opts.httpOnly !== false) str += '; HttpOnly';
  if (opts.secure !== false) str += '; Secure';
  str += `; SameSite=${opts.sameSite || 'Lax'}`;
  return str;
}

// ---------------------------------------------------------------------------
// WeakMap for attaching Session to Request
// ---------------------------------------------------------------------------

/** @type {WeakMap<Request, Session>} */
const sessionMap = new WeakMap();

// ---------------------------------------------------------------------------
// Session middleware
// ---------------------------------------------------------------------------

/**
 * Session middleware. Storage owns the Session lifecycle:
 * `storage.read(cookie) → Session`, `storage.save(session) → cookie`.
 *
 * @param {{
 *   storage?: SessionStorage,
 *   cookieName?: string,
 *   secret?: string,
 *   maxAge?: number,
 *   path?: string,
 *   httpOnly?: boolean,
 *   secure?: boolean,
 *   sameSite?: string,
 * }} [opts]
 */
export function session(opts = {}) {
  const secret = opts.secret || process.env.SESSION_SECRET;
  if (!secret) throw new Error('session() requires secret option or SESSION_SECRET env var');

  const storage = opts.storage || cookieSessionStorage();
  const cookieName = opts.cookieName || 'webjs.sid';
  const cookieOpts = {
    maxAge: opts.maxAge || 86400_000,
    path: opts.path || '/',
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
  };

  return async function sessionMiddleware(req, next) {
    const cookies = parseCookies(req.headers.get('cookie') || '');
    const rawCookie = cookies[cookieName] || '';
    const unsigned = rawCookie ? await unsign(rawCookie, secret) : null;

    // Storage creates the Session
    const s = await storage.read(unsigned);
    sessionMap.set(req, s);

    const resp = await next();

    // Storage serializes the Session
    const cookieValue = await storage.save(s);

    if (cookieValue === '') {
      // Destroyed: clear the cookie
      try {
        resp.headers.append('set-cookie', `${cookieName}=; Max-Age=0; Path=${cookieOpts.path}`);
      } catch {}
    } else if (cookieValue !== null) {
      // Changed: sign and set
      try {
        resp.headers.append('set-cookie', serializeCookie(cookieName, await sign(cookieValue, secret), cookieOpts));
      } catch {}
    }
    // null = no change

    return resp;
  };
}

// ---------------------------------------------------------------------------
// Read session from request
// ---------------------------------------------------------------------------

/**
 * Get the Session for the current request.
 *
 * ```js
 * const s = getSession(req);
 * s.get('userId');
 * s.set('userId', user.id);
 * s.flash('message', 'Saved!');
 * ```
 *
 * @param {Request} req
 * @returns {Session}
 */
export function getSession(req) {
  const s = sessionMap.get(req);
  if (!s) throw new Error('getSession() called outside of session middleware');
  // A session read is per-user, so mark the request dynamic so the server HTML
  // cache excludes it even when the page declared `revalidate` (#241).
  markDynamicAccess();
  return s;
}
