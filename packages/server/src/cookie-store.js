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
 * (or `delete(name, { path, domain })`) expiring the cookie.
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
    /**
     * Set once the response's headers are decided (`sealCookies`). A write
     * after that could never reach the browser, so it throws instead of being
     * dropped, as Next refuses a cookie write during render.
     */
    this.sealed = false;
  }

  /** @param {string} op */
  assertWritable(op) {
    if (!this.sealed) return;
    throw new Error(`[webjs] cookies().${op}() ran after the response headers were sent, so the cookie can never reach the browser. This happens inside a streamed render (a component under Suspense or <webjs-suspense>). Set cookies in a server action, a route handler, middleware, or the page render before anything streams.`);
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
    this.assertWritable('set');
    const cookie = typeof a === 'string' ? { ...(options || {}), name: a, value: String(value ?? '') } : { ...a, value: String(a.value ?? '') };
    if (!cookie.name) throw new Error('cookies().set: a cookie name is required');
    const c = normalizeCookie(/** @type {ResponseCookie} */ (cookie));
    this.map.set(c.name, c.value);
    this.pending.set(c.name, stringifyCookie(c));
    return this;
  }

  /**
   * Expire a cookie: `delete(name)`, `delete(name, { path, domain })` or
   * `delete({ name, path, domain })`. A cookie set on a path or domain is only
   * cleared by a `Set-Cookie` naming the same one, so both forms carry them.
   * @param {string | { name: string, path?: string, domain?: string }} a
   * @param {{ path?: string, domain?: string, secure?: boolean, httpOnly?: boolean, sameSite?: ResponseCookie['sameSite'], partitioned?: boolean }} [options]
   */
  delete(a, options) {
    this.assertWritable('delete');
    const opts = typeof a === 'string' ? { ...(options || {}), name: a } : a;
    this.map.delete(opts.name);
    // A `maxAge` or `expires` the caller passed (options shared with `set`)
    // would otherwise outlive the deletion: `normalizeCookie` lets `maxAge`
    // replace the epoch `expires`, and the cookie stayed alive for that long.
    const { maxAge: _maxAge, expires: _expires, ...scope } = /** @type {any} */ (opts);
    this.pending.set(opts.name, stringifyCookie(normalizeCookie({ ...scope, value: '', expires: new Date(0) })));
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
    delete: (/** @type {any} */ a, /** @type {any} */ o) => { store.delete(a, o); return view; },
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
 * always re-created rather than mutated: a `Response.redirect()` (and any
 * fetched response) has immutable headers, and a handler may return one
 * module-level Response for every request, which would otherwise collect this
 * visitor's session cookie and hand it to the next one.
 * @param {Response} res
 * @param {CookieStore | null | undefined} store
 * @returns {Response}
 */
export function applyPendingCookies(res, store) {
  if (!store || !store.pending.size) return res;
  const headers = new Headers(res.headers);
  for (const v of store.pending.values()) headers.append('set-cookie', v);
  try {
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } catch {
    // A status a Response cannot be constructed with (outside 200 to 599)
    // keeps the old in-place append.
    for (const v of store.pending.values()) res.headers.append('set-cookie', v);
    return res;
  }
}

/**
 * Next.js's `RequestCookies` (`request.cookies` in middleware and a route
 * handler) over a request's cookie store (#1686). Reads are the store's.
 * `set`, `delete` and `clear` change only the cookies the rest of THIS request
 * sees, the page's `cookies()` included, and send nothing to the browser: in
 * Next a response cookie goes on the response (`NextResponse.cookies.set`),
 * which in WebJs is `cookies().set()`.
 * @param {CookieStore} store
 */
export function requestCookiesView(store) {
  /** @param {unknown} a */
  const nameOf = (a) => String(a && typeof a === 'object' ? /** @type any */ (a).name : a);
  const view = {
    /** @param {any} a */
    get: (a) => store.get(a),
    /** @param {any} [a] */
    getAll: (a) => store.getAll(a),
    /** @param {string} name */
    has: (name) => store.has(name),
    get size() { return store.size; },
    /**
     * @param {string | { name: string, value: string }} a
     * @param {string} [value]
     */
    set(a, value) {
      const v = a && typeof a === 'object' ? a.value : value;
      store.map.set(nameOf(a), String(v ?? ''));
      return view;
    },
    /** @param {string | string[]} names */
    delete(names) {
      const removed = (Array.isArray(names) ? names : [names]).map((n) => store.map.delete(nameOf(n)));
      return Array.isArray(names) ? removed : removed[0];
    },
    clear() { store.map.clear(); return view; },
    [Symbol.iterator]: () => store[Symbol.iterator](),
    toString: () => store.toString(),
  };
  return view;
}
