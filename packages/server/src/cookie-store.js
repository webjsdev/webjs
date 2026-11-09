/**
 * The Next.js `cookies()` store: one per request, read from the request's
 * `Cookie` header and writable from anywhere server-side in that request (a
 * server action, a route handler, middleware, a page render). A write is
 * visible to later reads in the same request and is applied to the outgoing
 * response as `Set-Cookie` by the request handler (`applyPendingCookies`),
 * so `cookies().set(...)` works with no `Response` in hand, as in Next.
 *
 * The shape and the serializer are ports of Next's `RequestCookies` /
 * `ResponseCookies` (`@edge-runtime/cookies`): `get(name)` returns
 * `{ name, value }`, `set(name, value, options)` or `set({ name, value, ... })`
 * with `maxAge` in SECONDS, `path` defaulting to `/`, and `delete(name)`
 * expiring the cookie.
 *
 * @module cookie-store
 */

/**
 * @typedef {{
 *   name: string, value: string, expires?: Date | number, maxAge?: number,
 *   domain?: string, path?: string, secure?: boolean, httpOnly?: boolean,
 *   sameSite?: 'lax' | 'strict' | 'none' | 'Lax' | 'Strict' | 'None' | boolean,
 *   partitioned?: boolean, priority?: 'low' | 'medium' | 'high',
 * }} ResponseCookie
 */

/**
 * Parse a `Cookie` request header into name -> value (first occurrence wins,
 * values percent-decoded when they decode cleanly).
 * @param {string | null} header
 * @returns {Map<string, string>}
 */
export function parseCookieHeader(header) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!header) return map;
  for (const pair of header.split(/;\s*/)) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const name = (eq === -1 ? pair : pair.slice(0, eq)).trim();
    if (!name || map.has(name)) continue;
    const raw = eq === -1 ? 'true' : pair.slice(eq + 1).trim();
    let value = raw;
    try { value = decodeURIComponent(raw); } catch { /* keep raw */ }
    map.set(name, value);
  }
  return map;
}

/**
 * Serialize a cookie as a `Set-Cookie` value (port of Next's stringifyCookie).
 * @param {ResponseCookie} c
 * @returns {string}
 */
export function stringifyCookie(c) {
  const sameSite = c.sameSite === true ? 'strict' : c.sameSite;
  const attrs = [
    c.path && `Path=${c.path}`,
    (c.expires || c.expires === 0) && `Expires=${(typeof c.expires === 'number' ? new Date(c.expires) : c.expires).toUTCString()}`,
    typeof c.maxAge === 'number' && `Max-Age=${c.maxAge}`,
    c.domain && `Domain=${c.domain}`,
    c.secure && 'Secure',
    c.httpOnly && 'HttpOnly',
    sameSite && `SameSite=${sameSite}`,
    c.partitioned && 'Partitioned',
    c.priority && `Priority=${c.priority}`,
  ].filter(Boolean);
  const head = `${c.name}=${encodeURIComponent(c.value ?? '')}`;
  return attrs.length ? `${head}; ${attrs.join('; ')}` : head;
}

/**
 * Next's normalizeCookie: a numeric `expires` becomes a Date, `maxAge` also
 * sets `expires`, and `path` defaults to `/`.
 * @param {ResponseCookie} cookie
 * @returns {ResponseCookie}
 */
function normalizeCookie(cookie) {
  const c = { ...cookie };
  if (typeof c.expires === 'number') c.expires = new Date(c.expires);
  if (c.maxAge) c.expires = new Date(Date.now() + c.maxAge * 1000);
  if (c.path == null) c.path = '/';
  return c;
}

/**
 * A request's cookie store. `pending` holds the `Set-Cookie` values to apply
 * to the response, keyed by name so the last write to a name wins.
 */
export class CookieStore {
  /** @param {string | null} cookieHeader */
  constructor(cookieHeader) {
    /** @type {Map<string, string>} */
    this.map = parseCookieHeader(cookieHeader);
    /** @type {Map<string, string>} */
    this.pending = new Map();
  }

  /**
   * @param {string | { name: string }} [arg]
   * @returns {{ name: string, value: string } | undefined}
   */
  get(arg) {
    const name = typeof arg === 'string' ? arg : arg && arg.name;
    if (name == null || !this.map.has(name)) return undefined;
    return { name, value: /** @type {string} */ (this.map.get(name)) };
  }

  /**
   * @param {string | { name: string }} [arg]
   * @returns {{ name: string, value: string }[]}
   */
  getAll(arg) {
    const all = [...this.map].map(([name, value]) => ({ name, value }));
    const name = typeof arg === 'string' ? arg : arg && arg.name;
    return name == null ? all : all.filter((c) => c.name === name);
  }

  /** @param {string} name */
  has(name) { return this.map.has(name); }

  get size() { return this.map.size; }

  /**
   * `set(name, value, options?)` or `set({ name, value, ...options })`.
   * @param {string | ResponseCookie} a
   * @param {string} [value]
   * @param {Omit<ResponseCookie, 'name' | 'value'>} [options]
   */
  set(a, value, options) {
    const cookie = typeof a === 'string' ? { ...(options || {}), name: a, value: String(value ?? '') } : { ...a, value: String(a.value ?? '') };
    if (!cookie.name) throw new Error('cookies().set: a cookie name is required');
    const c = normalizeCookie(/** @type {ResponseCookie} */ (cookie));
    this.map.set(c.name, c.value);
    this.pending.set(c.name, stringifyCookie(c));
    return this;
  }

  /**
   * Expire a cookie: `delete(name)` or `delete({ name, path, domain })`.
   * @param {string | { name: string, path?: string, domain?: string }} a
   */
  delete(a) {
    const opts = typeof a === 'string' ? { name: a } : a;
    this.map.delete(opts.name);
    this.pending.set(opts.name, stringifyCookie(normalizeCookie({ ...opts, value: '', expires: new Date(0) })));
    return this;
  }

  /** @returns {IterableIterator<[string, { name: string, value: string }]>} */
  [Symbol.iterator]() {
    return [...this.map].map(([name, value]) => /** @type {[string, { name: string, value: string }]} */ ([name, { name, value }]))[Symbol.iterator]();
  }

  toString() {
    return [...this.map].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
  }
}

/**
 * The view `cookies()` returns: the store's methods, also awaitable, so both
 * `cookies().get('x')` and `(await cookies()).get('x')` (Next 15) work.
 * @param {CookieStore} store
 */
export function cookiesView(store) {
  const view = {
    get: store.get.bind(store),
    getAll: store.getAll.bind(store),
    has: store.has.bind(store),
    set: (/** @type {any} */ a, /** @type {any} */ v, /** @type {any} */ o) => { store.set(a, v, o); return view; },
    delete: (/** @type {any} */ a) => { store.delete(a); return view; },
    toString: () => store.toString(),
    [Symbol.iterator]: () => store[Symbol.iterator](),
  };
  Object.defineProperty(view, 'size', { get: () => store.size, enumerable: true });
  const p = Promise.resolve(view);
  for (const key of Reflect.ownKeys(view)) {
    if (key === 'size') continue;
    Object.defineProperty(p, key, { value: /** @type {any} */ (view)[key], enumerable: false, configurable: true });
  }
  Object.defineProperty(p, 'size', { get: () => store.size, enumerable: false });
  return /** @type {Promise<typeof view> & typeof view} */ (/** @type {unknown} */ (p));
}

/**
 * Add the store's pending `Set-Cookie` values to a response. The response is
 * re-created rather than mutated, because a `Response.redirect()` (and any
 * fetched response) has immutable headers.
 * @param {Response} res
 * @param {CookieStore | null | undefined} store
 * @returns {Response}
 */
export function applyPendingCookies(res, store) {
  if (!store || !store.pending.size) return res;
  let out = res;
  try {
    for (const v of store.pending.values()) out.headers.append('set-cookie', v);
    return out;
  } catch {
    out = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
    for (const v of store.pending.values()) out.headers.append('set-cookie', v);
    return out;
  }
}
