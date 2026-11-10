/**
 * NextAuth/Auth.js-style authentication for WebJs.
 *
 * JWT or database sessions, Credentials + OAuth (Google, GitHub) providers.
 * Uses Web Crypto HMAC-SHA256: no external dependencies.
 *
 * @module auth
 */

import { getStore } from './cache.js';
import { getRequest, getBodyLimits, getAllowedOrigins, markDynamicAccess, requestCookieStore } from './context.js';
import { verifyOrigin } from './csrf.js';
import { redirect } from '@webjsdev/core';
import { readTextBounded, readFormDataBounded, payloadTooLarge, DEFAULT_MAX_BODY_BYTES } from './body-limit.js';
import { devSecret } from './dev-secret.js';
import { encryptSession, decryptSession } from './jwe.js';
import { basePath as appBasePath } from './importmap.js';
import { headerSafeLocation } from './redirect-location.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
// Base names. In production each is sent with the `__Host-` prefix
// (cookieName below); development over http keeps the plain name.
const AUTH_COOKIE = 'webjs.auth';
const STATE_COOKIE = 'webjs.auth.state';
// Carries the post-sign-in target across the OAuth round trip (#1495). Signed
// with the auth secret and short-lived (the same 10 minutes as the state
// cookie), so the callback only ever lands on a path this app chose.
const REDIRECT_COOKIE = 'webjs.auth.redirect';
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (seconds)

// -- Web Crypto helpers -----------------------------------------------------

/** @param {string} secret @returns {Promise<CryptoKey>} */
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** @param {ArrayBuffer} buf @returns {string} */
function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} str @returns {Uint8Array} */
function unb64url(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Sign `value` → `value.sig` */
async function sign(value, secret) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(value));
  return `${value}.${b64url(sig)}`;
}

/** Verify and unsign. Returns original value or null. */
async function unsign(input, secret) {
  const idx = input.lastIndexOf('.');
  if (idx < 1) return null;
  const value = input.slice(0, idx);
  // `unb64url` -> `atob` throws on non-base64 input. A malformed signature
  // (a corrupted or attacker-supplied cookie) must read as "not signed by
  // us", not crash the request. Mirrors the guard in `decodeJwt`.
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(input.slice(idx + 1)), enc.encode(value));
    return ok ? value : null;
  } catch { return null; }
}

function randomId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return b64url(bytes.buffer);
}

/**
 * `path` with `key=value` added to its query, joining one it already has.
 * @param {string} path @param {string} key @param {string} value
 */
function withQuery(path, key, value) {
  const hash = path.indexOf('#');
  const base = hash < 0 ? path : path.slice(0, hash);
  const frag = hash < 0 ? '' : path.slice(hash);
  return `${base}${base.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}${frag}`;
}

/**
 * Accept a post-sign-in target only when it is a same-origin local path: one
 * leading `/`, the next character neither `/` nor `\` (both make a
 * protocol-relative URL a browser follows off-site), and no control
 * characters or whitespace a browser might strip before resolving. Anything
 * else returns `null` and the caller falls back to its default. A bad value is
 * DROPPED, never repaired, since a repaired open redirect is still one.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function safeRedirectPath(value) {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > 2048) return null;
  if (value[0] !== '/') return null;
  if (value[1] === '/' || value[1] === '\\') return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s\\]/.test(value)) return null;
  return value;
}

/**
 * The page a server-side `signIn()` / `signOut()` was called from, as a local
 * path (Auth.js v5: `redirectTo ?? headers.get("Referer") ?? "/"`, #1686). A
 * Referer from another origin is ignored, as Auth.js's default `redirect`
 * callback keeps only same-origin targets.
 * @param {Request | null | undefined} req
 * @returns {string | null}
 */
function refererPath(req) {
  const ref = req && req.headers.get('referer');
  if (!ref) return null;
  try {
    const u = new URL(ref);
    if (u.origin !== new URL(req.url).origin) return null;
    return safeRedirectPath(u.pathname + u.search + u.hash);
  } catch {
    return null;
  }
}

/**
 * Whether `adapter` is an Auth.js database adapter (`@auth/drizzle-adapter`
 * and the rest), rather than WebJs's own session store.
 * @param {unknown} adapter
 */
function isAuthAdapter(adapter) {
  return !!adapter && typeof (/** @type any */ (adapter)).getSessionAndUser === 'function';
}

/** Whether a cookie value is the encrypted session JWT (a compact JWE). @param {string} v */
function isJwe(v) {
  return String(v).split('.').length === 5;
}

// -- Cookie helpers ---------------------------------------------------------

/** @param {string} header @returns {Record<string,string>} */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    // One malformed value (a stray `%`) must not make auth() throw for every
    // request that carries it, so it is skipped (#1686).
    try {
      out[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
    } catch {}
  }
  return out;
}

/**
 * The name a cookie is sent under. In production it carries the `__Host-`
 * prefix (#1538): a browser stores a `__Host-` cookie only when it is
 * `Secure`, has `Path=/` and has NO `Domain` attribute, so an app on a sibling
 * subdomain (two apps on `a.example.app` and `b.example.app`, with
 * `example.app` not on the Public Suffix List) can no longer plant its own
 * `webjs.auth` with `Domain=.example.app` and sign a visitor in to the wrong
 * account (cookie tossing, session fixation). Production never reads the
 * unprefixed name: a fallback would reopen exactly that hole.
 * Development over http keeps the plain name, since `__Host-` needs `Secure`.
 *
 * @param {string} base @param {boolean} secure
 */
export function cookieName(base, secure) {
  return secure ? `__Host-${base}` : base;
}

function setCookie(name, value, maxAge, secure) {
  let s = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; HttpOnly; SameSite=Lax`;
  if (secure) s += '; Secure';
  return s;
}

// A `__Host-` cookie is cleared only by a Set-Cookie that also says Secure;
// a browser ignores one without it, and the cookie would stay.
function clearCookie(name, secure = false) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// -- JWT --------------------------------------------------------------------

/**
 * Encrypt a session payload as Auth.js does (#1686): a JWE (`dir`,
 * `A256CBC-HS512`) keyed by HKDF over the secret with the session cookie's
 * name as salt, so the browser holding the cookie cannot read what is in it.
 * It used to be a signed (HS256) JWT, readable as base64. See `jwe.js`.
 * @param {Record<string,unknown>} payload
 * @param {string | string[]} secret
 * @param {string} [salt] the session cookie's name
 */
export async function encodeJwt(payload, secret, salt = AUTH_COOKIE) {
  return encryptSession(payload, secret, salt);
}

/**
 * Decrypt a session token, or null when it is malformed, tampered with,
 * expired, or made with another secret or salt. A garbage cookie never throws.
 * @param {string} token
 * @param {string | string[]} secret
 * @param {string} [salt]
 * @returns {Promise<Record<string,unknown>|null>}
 */
export async function decodeJwt(token, secret, salt = AUTH_COOKIE) {
  return decryptSession(token, secret, salt);
}

// -- Providers --------------------------------------------------------------

/**
 * @typedef {Object} ProviderConfig
 * @property {string} id
 * @property {string} type
 * @property {string} [name]
 * @property {string} [authorizationUrl]
 * @property {string} [tokenUrl]
 * @property {string} [userinfoUrl]
 * @property {string} [clientId]
 * @property {string} [clientSecret]
 * @property {string[]} [scope]
 * @property {((creds: Record<string,unknown>) => Promise<Record<string,unknown>|null>)} [authorize]
 * @property {((profile: Record<string,unknown>) => Record<string,unknown>)} [profile]
 */

/**
 * Credentials provider: email/password or custom logic.
 * @param {{ authorize: (creds: Record<string,unknown>) => Promise<Record<string,unknown>|null> }} opts
 * @returns {ProviderConfig}
 */
export function Credentials(opts) {
  return { id: 'credentials', type: 'credentials', name: 'Credentials', authorize: opts.authorize };
}

/**
 * Google OAuth 2.0 provider.
 * @param {{ clientId?: string, clientSecret?: string }} [opts]
 * @returns {ProviderConfig}
 */
export function Google(opts = {}) {
  return {
    id: 'google', type: 'oauth', name: 'Google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    clientId: opts.clientId || process.env.AUTH_GOOGLE_ID,
    clientSecret: opts.clientSecret || process.env.AUTH_GOOGLE_SECRET,
    scope: ['openid', 'email', 'profile'],
    profile: (p) => ({ id: p.sub == null ? undefined : String(p.sub), name: p.name, email: p.email, image: p.picture }),
  };
}

/**
 * GitHub OAuth 2.0 provider.
 * @param {{ clientId?: string, clientSecret?: string }} [opts]
 * @returns {ProviderConfig}
 */
export function GitHub(opts = {}) {
  return {
    id: 'github', type: 'oauth', name: 'GitHub',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
    clientId: opts.clientId || process.env.AUTH_GITHUB_ID,
    clientSecret: opts.clientSecret || process.env.AUTH_GITHUB_SECRET,
    scope: ['read:user', 'user:email'],
    profile: (p) => ({ id: p.id == null ? undefined : String(p.id), name: p.name || p.login, email: p.email, image: p.avatar_url }),
  };
}

// -- createAuth -------------------------------------------------------------

/**
 * @typedef {Object} AuthConfig
 * @property {ProviderConfig[]} providers
 * @property {{ strategy?: 'jwt'|'database', maxAge?: number }} [session]
 * @property {string} [secret] defaults to `process.env.AUTH_SECRET`, as in Auth.js
 * @property {{ session?: Function, jwt?: Function, signIn?: Function, redirect?: Function }} [callbacks]
 * @property {{ load?: Function, save?: Function, destroy?: Function }} [adapter]
 * @property {{ signIn?: string, signOut?: string, error?: string }} [pages]
 * @property {boolean} [useSecureCookies] Auth.js's: force secure cookies on or
 *   off; unset, the auth URL's protocol decides (never NODE_ENV)
 */

/**
 * Create the auth system.
 *
 * The session-user shape is typed via the `@webjsdev/server` overlay: augment
 * its `AuthUser` interface (NextAuth/Auth.js style) for global typing, or call
 * `createAuth<MyUser>(...)` from TypeScript for per-instance typing. See #451
 * and the auth recipe. This JSDoc keeps the loose runtime shape; the precise
 * typing lives in `index.d.ts` (types-only, no runtime effect).
 *
 * @param {AuthConfig} config
 * @returns {{
 *   auth: (req?: Request) => Promise<{ user: Record<string,unknown> }|null>,
 *   signIn: (provider: string, data?: Record<string,unknown>, opts?: { redirectTo?: string, req?: Request }) => Promise<Response>,
 *   signOut: (opts?: { redirectTo?: string, req?: Request }) => Promise<Response>,
 *   handlers: { GET: (req: Request) => Promise<Response>, POST: (req: Request) => Promise<Response> },
 * }}
 */
export function createAuth(config) {
  // Auth.js reads AUTH_SECRET when `secret` is left out, so an app can write
  // createAuth({ providers }) or pass process.env.AUTH_SECRET (string | undefined)
  // without a cast.
  // In development and tests a missing secret falls back to a generated one
  // kept in .webjs/dev-secret (dev-secret.js), so a fresh clone or worktree works.
  const secret = config.secret || process.env.AUTH_SECRET || devSecret('AUTH_SECRET');
  if (!secret) throw new Error('createAuth() needs a secret to sign its session: set AUTH_SECRET in .env (webjs create writes one), or pass createAuth({ secret }). Only a development or test process (NODE_ENV=development or test) gets a generated one.');

  // An Auth.js database adapter (`DrizzleAdapter(db)` and the rest) switches
  // the default strategy to "database", as in Auth.js (#1686). WebJs's own
  // session store ({ load, save, destroy }) is the other `adapter` shape.
  const authAdapter = isAuthAdapter(config.adapter) ? /** @type {any} */ (config.adapter) : null;
  const strategy = config.session?.strategy || (authAdapter ? 'database' : 'jwt');
  /** Seconds between database session extensions, Auth.js's `updateAge`. */
  const updateAge = /** @type {any} */ (config.session)?.updateAge ?? 24 * 60 * 60;
  const maxAge = config.session?.maxAge || DEFAULT_MAX_AGE;
  const maxAgeMs = maxAge * 1000;
  const cb = config.callbacks || {};
  const pages = config.pages || {};
  // Where the auth routes live and the origin their callback URLs use, as in
  // Auth.js v5 (#1686): `AUTH_URL` (or the older `NEXTAUTH_URL`) gives the
  // origin, and its path is the base path unless `basePath` is set; without it
  // the request's own origin is used. The default base path is /api/auth.
  const envAuthUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || '';
  /** @type {string | null} */
  let authOrigin = null;
  let rawBase = /** @type {any} */ (config).basePath;
  if (envAuthUrl) {
    try {
      const u = new URL(envAuthUrl);
      authOrigin = u.origin;
      if (!rawBase && u.pathname !== '/') rawBase = u.pathname;
    } catch { /* an unparsable AUTH_URL leaves the request origin in charge */ }
  }
  const basePath = '/' + String(rawBase || '/api/auth').replace(/^\/+|\/+$/g, '');
  /** @param {Request | null | undefined} req */
  const authBase = (req) => `${authOrigin || (req ? new URL(req.url).origin : 'http://localhost:8080')}${basePath}`;
  // Secure cookies (the Secure flag and the __Secure- / __Host- names) follow
  // Auth.js's rule (core/src/lib/init.ts): `useSecureCookies` when set, else
  // whether the auth URL is https, AUTH_URL's when set, else the request's.
  // Not NODE_ENV: `npm start` over plain http (a LAN address, a staging host)
  // would set cookies the browser drops, and sign-in would loop. A request
  // and every cookie it reads or writes share one answer, and so do the two
  // legs of an OAuth round trip, which share a protocol.
  /** @param {Request | null | undefined} req */
  const secure = (req) => {
    if (typeof config.useSecureCookies === 'boolean') return config.useSecureCookies;
    if (authOrigin) return authOrigin.startsWith('https:');
    if (req) { try { return new URL(req.url).protocol === 'https:'; } catch { /* unparsable: not secure */ } }
    return false;
  };

  /** @type {Map<string, ProviderConfig>} */
  const providers = new Map();
  // Auth.js takes a provider called or bare (`providers: [GitHub]`), so a
  // function is called with no options to get its config (#1686).
  for (const entry of config.providers) {
    const p = typeof entry === 'function' ? entry() : entry;
    providers.set(p.id, p);
  }

  /**
   * What the signIn callback decided, Auth.js's rule: a string redirects there
   * (and does not sign in), any other falsy value denies, truthy allows.
   * @returns {Promise<Response | null>} the refusal, or null to continue
   */
  async function signInRefusal(user, account, extraCookies = [], req = getRequest()) {
    if (!cb.signIn) return null;
    const ok = await cb.signIn({ user, account });
    if (ok && typeof ok !== 'string') return null;
    const hdrs = new Headers();
    // A returned string is where to send the user instead. As in Auth.js it
    // goes through callbacks.redirect, whose default allows only this origin,
    // so the callback cannot become an open redirect; a target the redirect
    // callback drops is refused like a false.
    const denied = withQuery(pages.error || '/', 'error', 'AccessDenied');
    const target = typeof ok === 'string' ? await resolveRedirect(ok, req, null) : null;
    hdrs.set('location', headerSafeLocation(target || denied));
    for (const c of extraCookies) hdrs.append('set-cookie', c);
    return new Response(null, { status: 302, headers: hdrs });
  }

  const dbStore = strategy === 'database' && !authAdapter ? (config.adapter || defaultAdapter()) : null;

  // -- Session read/write ---------------------------------------------------

  async function readSession(req) {
    // Reading the auth session is per-user (the body branches on the logged-in
    // user), so mark the request dynamic so the server HTML cache excludes the
    // page even when it wrongly set `revalidate`, mirroring getSession() /
    // cookies() / headers(). This closes the auth-path leak (#241): `auth()`
    // reaches here, reads the auth cookie raw, and would otherwise leave the
    // page cacheable so a logged-in body could be served to the next visitor.
    markDynamicAccess();
    const cookies = parseCookies(req.headers.get('cookie') || '');
    const raw = cookies[cookieName(AUTH_COOKIE, secure(req))];
    if (!raw) return null;

    // A credentials sign-in always writes the encrypted JWT, as in Auth.js, so
    // under the database strategy that cookie is read as one too: Auth.js
    // itself cannot read it back there, and the sign-in silently fails.
    if (strategy === 'jwt' || isJwe(raw)) {
      const payload = await decodeJwt(raw, secret, cookieName(AUTH_COOKIE, secure(req)));
      if (!payload) return null;
      let token = cb.jwt ? await cb.jwt({ token: payload, user: undefined }) : payload;
      // Returning null (or anything but an object) from the jwt callback ends
      // the session, as in Auth.js.
      if (!token || typeof token !== 'object') {
        // The cookie goes too, so later requests do not decrypt it and run the
        // callback again until it expires. Best effort: a read outside a
        // request, or after the headers were sent, cannot set a cookie.
        try { if (getRequest()) queueSetCookie(clearCookie(cookieName(AUTH_COOKIE, secure(req)), secure(req))); } catch {}
        return null;
      }
      const exp = typeof token.exp === 'number' ? token.exp : Math.floor(Date.now() / 1000) + maxAge;
      let session = { user: { id: token.sub, name: token.name, email: token.email, image: token.image, ...token }, expires: new Date(exp * 1000).toISOString() };
      delete session.user.iat; delete session.user.exp; delete session.user.sub;
      return cb.session ? cb.session({ session, token, user: undefined }) : session;
    }

    if (authAdapter) return readAdapterSession(raw, req);
    const sid = await unsign(raw, secret);
    if (!sid || !dbStore) return null;
    const data = await dbStore.load(sid);
    if (!data) return null;
    let session = { user: data };
    return cb.session ? cb.session({ session, token: undefined, user: data }) : session;
  }

  // The jwt callback at sign-in gets what Auth.js passes it (#1686): the
  // account (for OAuth, the provider's token response: access_token,
  // refresh_token, expires_at, ...) and the raw profile, with trigger
  // 'signIn', so `if (account) token.accessToken = account.access_token` works.
  async function writeSession(user, account, profile, req = getRequest()) {
    if (strategy === 'jwt') return writeJwtSession(user, account, profile, req);
    if (authAdapter) {
      // Under the database strategy a credentials sign-in gets a database
      // session too, so it can be revoked. Auth.js writes a JWT here that its
      // own database read cannot find, so the sign-in silently fails; WebJs
      // keeps it working, and falls back to the encrypted JWT only when the
      // adapter refuses the session (a user not in its users table).
      try {
        const sessionToken = crypto.randomUUID();
        await authAdapter.createSession({ sessionToken, userId: user.id, expires: new Date(Date.now() + maxAgeMs) });
        return setCookie(cookieName(AUTH_COOKIE, secure(req)), sessionToken, maxAgeMs, secure(req));
      } catch (e) {
        if (account?.type !== 'credentials') throw e;
        console.warn('[webjs] createAuth: the adapter refused a session for a credentials user, so a JWT session is used instead:', /** @type any */ (e)?.message || e);
        return writeJwtSession(user, account, profile, req);
      }
    }
    const sid = randomId();
    await dbStore.save(sid, user, maxAgeMs);
    return setCookie(cookieName(AUTH_COOKIE, secure(req)), await sign(sid, secret), maxAgeMs, secure(req));
  }

  /**
   * The encrypted JWT session cookie, with the jwt callback run at sign-in.
   * @param {any} user @param {any} account @param {any} profile
   */
  async function writeJwtSession(user, account, profile, req = getRequest()) {
    let token = { sub: user.id, name: user.name, email: user.email, image: user.image, role: user.role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + maxAge };
    if (cb.jwt) token = await cb.jwt({ token, user, account, profile, trigger: 'signIn' });
    // Anything but an object from the jwt callback denies the sign-in: no
    // cookie is written, and the caller answers with AccessDenied.
    if (!token || typeof token !== 'object') return null;
    // The session's lifetime is the cookie's, as Auth.js's encode() sets it,
    // whatever object the jwt callback returned.
    const now = Math.floor(Date.now() / 1000);
    token = { ...token, iat: typeof token.iat === 'number' ? token.iat : now, exp: typeof token.exp === 'number' ? token.exp : now + maxAge };
    return setCookie(cookieName(AUTH_COOKIE, secure(req)), await encodeJwt(token, secret, cookieName(AUTH_COOKIE, secure(req))), maxAgeMs, secure(req));
  }

  /**
   * A database session through an Auth.js adapter, as Auth.js reads one
   * (`core/src/lib/actions/session.ts`): an unknown token is no session, an
   * expired one is deleted, and one past its `updateAge` is extended and its
   * cookie re-set. The `session` callback receives `{ session, user }`.
   * @param {string} sessionToken
   */
  async function readAdapterSession(sessionToken, req = getRequest()) {
    const found = await authAdapter.getSessionAndUser(sessionToken);
    if (!found) return null;
    const { session: row, user } = found;
    const expires = new Date(row.expires).getTime();
    if (expires < Date.now()) {
      await authAdapter.deleteSession?.(sessionToken);
      return null;
    }
    let until = expires;
    if (expires - maxAgeMs + updateAge * 1000 <= Date.now()) {
      until = Date.now() + maxAgeMs;
      await authAdapter.updateSession?.({ sessionToken, expires: new Date(until) });
      try { if (getRequest()) queueSetCookie(setCookie(cookieName(AUTH_COOKIE, secure(req)), sessionToken, maxAgeMs, secure(req))); } catch { /* headers already sent: the row is extended, the cookie catches up next time */ }
    }
    const session = { user: { id: user.id, name: user.name, email: user.email, image: user.image }, expires: new Date(until).toISOString() };
    return cb.session ? cb.session({ session, user, token: undefined }) : session;
  }

  /**
   * Who an OAuth sign-in is, through an Auth.js adapter, as Auth.js decides it
   * (`core/src/lib/actions/callback/handle-login.ts`): a linked account is
   * its user; otherwise the account is linked to the signed-in user, or to a
   * new user, and an email another user already has is refused unless the
   * provider allows dangerous email linking. Returns the user, or the
   * `OAuthAccountNotLinked` error code.
   * @param {Request} req
   * @param {any} user the provider's profile, normalised
   * @param {any} account
   * @param {any} provider
   */
  async function adapterUserFor(req, user, account, provider) {
    const raw = parseCookies(req.headers.get('cookie') || '')[cookieName(AUTH_COOKIE, secure(req))];
    const current = raw && !isJwe(raw) ? (await authAdapter.getSessionAndUser(raw))?.user ?? null : null;
    const { accessToken: _legacy, ...accountRow } = account;
    const linked = await authAdapter.getUserByAccount({ provider: account.provider, providerAccountId: account.providerAccountId });
    if (linked) {
      if (current && current.id !== linked.id) return 'OAuthAccountNotLinked';
      return linked;
    }
    if (current) {
      await authAdapter.linkAccount({ ...accountRow, userId: current.id });
      return current;
    }
    const email = typeof user.email === 'string' ? user.email.toLowerCase() : user.email;
    const byEmail = email ? await authAdapter.getUserByEmail(email) : null;
    if (byEmail) {
      if (!provider.allowDangerousEmailAccountLinking) return 'OAuthAccountNotLinked';
      await authAdapter.linkAccount({ ...accountRow, userId: byEmail.id });
      return byEmail;
    }
    const created = await authAdapter.createUser({ ...user, id: crypto.randomUUID(), email, emailVerified: null });
    await authAdapter.linkAccount({ ...accountRow, userId: created.id });
    return created;
  }

  // -- auth() ---------------------------------------------------------------

  // Auth.js's three shapes (#1686): `auth()` / `auth(req)` reads the session;
  // `export { auth as middleware }` runs with `(req, next)` and must answer as
  // middleware, never with the session object; `auth((req) => ...)` wraps a
  // middleware, which sees the session on `req.auth`. Both middleware shapes
  // run `callbacks.authorized` first when the app set one.
  async function guard(req) {
    const session = await readSession(req);
    try { /** @type {any} */ (req).auth = session; } catch {}
    if (!cb.authorized) return null;
    const verdict = await cb.authorized({ auth: session, request: req });
    if (verdict instanceof Response) return verdict;
    if (verdict) return null;
    const url = new URL(req.url);
    const target = new URL(pages.signIn || `${basePath}/signin`, url.origin);
    target.searchParams.set('callbackUrl', url.pathname + url.search);
    return Response.redirect(target.toString(), 302);
  }

  function auth(arg, next) {
    if (typeof arg === 'function') {
      const handler = arg;
      return async (req, ...rest) => (await guard(req)) ?? handler(req, ...rest);
    }
    if (arg instanceof Request && next !== undefined) {
      return guard(arg).then((res) => res ?? (typeof next === 'function' ? next() : undefined));
    }
    const r = arg || getRequest();
    return r ? readSession(r) : Promise.resolve(null);
  }

  // -- Where a sign-in or sign-out lands --------------------------------------

  /**
   * Auth.js's `callbacks.redirect({ url, baseUrl })` (#1686): every target a
   * sign-in or sign-out lands on goes through it, whether the app's server
   * code passed it or a form submitted it. The default keeps a local path or a
   * same-origin URL (as its path) and sends anything else to "/", so no
   * caller can become an open redirect; an app that needs another origin (an
   * identity provider's end-session URL) returns it from the callback.
   * @template F
   * @param {unknown} url
   * @param {Request | null | undefined} req
   * @param {F} [fallback] what a dropped target becomes ("/" by default; the
   *   OAuth leg passes null so it stores nothing and clears a stale target)
   * @returns {Promise<string | F>}
   */
  async function resolveRedirect(url, req, fallback = /** @type {any} */ ('/')) {
    if (typeof url !== 'string' || url === '') return fallback;
    const baseUrl = authOrigin || (req ? new URL(req.url).origin : '');
    if (typeof cb.redirect === 'function') {
      const out = await cb.redirect({ url, baseUrl });
      return typeof out === 'string' && out !== '' ? out : fallback;
    }
    const local = safeRedirectPath(url);
    if (local) return local;
    try {
      const u = new URL(url);
      // Its path must itself be a safe local path: https://app//evil.com has
      // the path //evil.com, which a browser reads as another host.
      if (baseUrl && u.origin === baseUrl) return safeRedirectPath(u.pathname + u.search + u.hash) || fallback;
    } catch { /* not a URL: dropped */ }
    return fallback;
  }

  // -- signIn() -------------------------------------------------------------

  async function signInFn(providerId, data, opts = {}) {
    const provider = providers.get(providerId);
    if (!provider) return new Response('Unknown provider', { status: 400 });

    if (provider.type === 'credentials') {
      if (!provider.authorize) return new Response('No authorize function', { status: 500 });
      // Auth.js passes the request as authorize's second argument.
      const user = await provider.authorize(data || {}, opts.req || getRequest() || undefined);
      if (!user) {
        return new Response(null, { status: 302, headers: { location: withQuery(pages.error || pages.signIn || '/', 'error', 'CredentialsSignin') } });
      }
      const account = { provider: providerId, type: 'credentials', providerAccountId: String(user.id ?? '') };
      const refused = await signInRefusal(user, account, [], opts.req || getRequest());
      if (refused) return refused;
      const cookie = await writeSession(user, account, undefined, opts.req || getRequest());
      if (!cookie) return new Response(null, { status: 302, headers: { location: withQuery(pages.error || '/', 'error', 'AccessDenied') } });
      // The app's own value and a submitted one both go through the redirect
      // callback (its default allows only this origin), as in Auth.js.
      const redirectTo = await resolveRedirect(opts.redirectTo || (data && data.redirectTo), opts.req || getRequest());
      return new Response(null, { status: 302, headers: { location: headerSafeLocation(redirectTo), 'set-cookie': cookie } });
    }

    if (provider.type === 'oauth') {
      return oauthRedirect(provider, { ...opts, redirectTo: opts.redirectTo || (data && data.redirectTo) });
    }
    return new Response('Unsupported provider type', { status: 400 });
  }

  // -- signOut() ------------------------------------------------------------

  async function signOutFn(opts = {}) {
    const hdrs = new Headers();
    const req = opts.req || getRequest();
    // Through the redirect callback, as every sign-in target is: the default
    // keeps this origin only, and an app allows an identity provider's
    // end-session URL by returning it from `callbacks.redirect`.
    hdrs.set('location', headerSafeLocation(await resolveRedirect(opts.redirectTo, opts.req || getRequest())));
    hdrs.append('set-cookie', clearCookie(cookieName(AUTH_COOKIE, secure(req)), secure(req)));

    if (strategy === 'database' && dbStore) {
      const r = opts.req || getRequest();
      if (r) {
        const raw = parseCookies(r.headers.get('cookie') || '')[cookieName(AUTH_COOKIE, secure(req))];
        if (raw) { const sid = await unsign(raw, secret); if (sid) await dbStore.destroy(sid); }
      }
    }
    if (authAdapter) {
      const r = opts.req || getRequest();
      const raw = r && parseCookies(r.headers.get('cookie') || '')[cookieName(AUTH_COOKIE, secure(req))];
      if (raw && !isJwe(raw)) {
        try { await authAdapter.deleteSession(raw); } catch (e) { console.error('[webjs] signOut: deleteSession failed:', e); }
      }
    }
    return new Response(null, { status: 302, headers: hdrs });
  }

  // -- OAuth helpers --------------------------------------------------------

  async function oauthRedirect(provider, opts) {
    const req = opts.req || getRequest();
    const state = randomId();

    const url = new URL(provider.authorizationUrl);
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', `${authBase(req)}/callback/${provider.id}`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', (provider.scope || []).join(' '));
    url.searchParams.set('state', state);

    const hdrs = new Headers();
    hdrs.set('location', url.toString());
    hdrs.append('set-cookie', setCookie(cookieName(STATE_COOKIE, secure(req)), await sign(state, secret), 600_000, secure(req)));
    // The post-sign-in target rides in its own signed cookie (#1495). With no
    // valid target, any leftover cookie from an abandoned earlier attempt is
    // cleared so it cannot steer this sign-in somewhere stale.
    const target = await resolveRedirect(opts.redirectTo, req, null);
    hdrs.append('set-cookie', target
      ? setCookie(cookieName(REDIRECT_COOKIE, secure(req)), await sign(target, secret), 600_000, secure(req))
      : clearCookie(cookieName(REDIRECT_COOKIE, secure(req)), secure(req)));
    return new Response(null, { status: 302, headers: hdrs });
  }

  /**
   * Read the signed post-sign-in target the redirect leg stored. It went
   * through callbacks.redirect before it was signed, so the signature proves
   * it is a target this app allowed, and it is used as is, exactly as the
   * credentials path uses the callback's answer. Null when absent or forged.
   *
   * @param {Request} req
   * @returns {Promise<string | null>}
   */
  async function readRedirectCookie(req) {
    const raw = parseCookies(req.headers.get('cookie') || '')[cookieName(REDIRECT_COOKIE, secure(req))];
    if (!raw) return null;
    const value = await unsign(raw, secret);
    return typeof value === 'string' && value !== '' ? value : null;
  }

  async function oauthCallback(req, provider) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return new Response('Missing code or state', { status: 400 });

    const rawState = parseCookies(req.headers.get('cookie') || '')[cookieName(STATE_COOKIE, secure(req))];
    if (!rawState) return new Response('Missing state cookie', { status: 403 });
    const verified = await unsign(rawState, secret);
    if (!verified || verified !== state) return new Response('Invalid state', { status: 403 });

    // Exchange code for token
    const callbackUrl = `${authBase(req)}/callback/${provider.id}`;
    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ client_id: provider.clientId, client_secret: provider.clientSecret, code, redirect_uri: callbackUrl, grant_type: 'authorization_code' }),
    });
    if (!tokenRes.ok) return new Response('Token exchange failed', { status: 502 });
    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    if (!accessToken) return new Response('No access token', { status: 502 });

    // Fetch profile
    const profileRes = await fetch(provider.userinfoUrl, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
    if (!profileRes.ok) return new Response('Profile fetch failed', { status: 502 });
    const rawProfile = await profileRes.json();

    // GitHub private email fallback
    if (provider.id === 'github' && !rawProfile.email) {
      try {
        const r = await fetch('https://api.github.com/user/emails', { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
        if (r.ok) { const emails = await r.json(); const p = emails.find(/** @param {any} e */ e => e.primary && e.verified); if (p) rawProfile.email = p.email; }
      } catch { /* non-critical */ }
    }

    const user = provider.profile ? provider.profile(rawProfile) : rawProfile;

    // Auth.js's account: the provider's token response, plus who it is for.
    // `accessToken` stays alongside `access_token` for the earlier shape.
    const flowCookies = [
      clearCookie(cookieName(STATE_COOKIE, secure(req)), secure(req)),
      clearCookie(cookieName(REDIRECT_COOKIE, secure(req)), secure(req)),
    ];
    /** A refused OAuth sign-in: the error page with its code, the flow's cookies cleared. */
    const oauthError = (code) => {
      const h = new Headers({ location: withQuery(pages.error || pages.signIn || `${basePath}/signin`, 'error', code) });
      for (const c of flowCookies) h.append('set-cookie', c);
      return new Response(null, { status: 302, headers: h });
    };
    // The account is keyed by the profile's id, so a profile without one is
    // refused rather than linked under an empty id every such user would share.
    if (user?.id == null || String(user.id) === '') return oauthError('OAuthProfileParseError');
    const account = { ...tokens, provider: provider.id, type: 'oauth', providerAccountId: String(user.id), accessToken };
    const refused = await signInRefusal(user, account, flowCookies, req);
    if (refused) return refused;

    let sessionUser = user;
    if (authAdapter) {
      const resolved = await adapterUserFor(req, user, account, provider);
      if (typeof resolved === 'string') return oauthError(resolved);
      sessionUser = resolved;
    }
    const sessionCookie = await writeSession(sessionUser, account, rawProfile, req);
    if (!sessionCookie) return oauthError('AccessDenied');
    const hdrs = new Headers();
    hdrs.set('location', headerSafeLocation((await readRedirectCookie(req)) || '/'));
    hdrs.append('set-cookie', sessionCookie);
    hdrs.append('set-cookie', clearCookie(cookieName(STATE_COOKIE, secure(req)), secure(req)));
    hdrs.append('set-cookie', clearCookie(cookieName(REDIRECT_COOKIE, secure(req)), secure(req)));
    return new Response(null, { status: 302, headers: hdrs });
  }

  // -- Built-in pages ------------------------------------------------------

  /** @param {string} title @param {string} body */
  function htmlPage(title, body) {
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>`
      + `<body style="font-family:system-ui;max-width:24rem;margin:4rem auto">${body}</body></html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }

  function signOutPage() {
    return htmlPage('Sign out', '<h1>Sign out</h1><p>Are you sure you want to sign out?</p>'
      + `<form method="post" action="${basePath}/signout"><button type="submit">Sign out</button></form>`);
  }

  /** @param {string | null} callbackUrl */
  function signInPage(callbackUrl) {
    if (pages.signIn) {
      const target = new URL(pages.signIn, 'http://x');
      if (callbackUrl) target.searchParams.set('callbackUrl', callbackUrl);
      return new Response(null, { status: 302, headers: { location: target.pathname + target.search } });
    }
    const back = safeRedirectPath(callbackUrl) || '/';
    const esc = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const buttons = [...providers.values()].filter((p) => p.type === 'oauth').map((p) =>
      `<form method="post" action="${basePath}/signin/${esc(p.id)}"><input type="hidden" name="redirectTo" value="${esc(back)}">`
      + `<button type="submit">Sign in with ${esc(p.name)}</button></form>`).join('');
    return htmlPage('Sign in', `<h1>Sign in</h1>${buttons || '<p>Set <code>pages.signIn</code> to your sign-in page.</p>'}`);
  }

  // -- Route handlers (mount at app/api/auth/[...path]/route.js) ------------

  // The request's path has lost the app's `webjs.basePath` mount prefix at
  // ingress, while a base path taken from AUTH_URL is the public one and may
  // still carry it, so both spellings are tried. A base only matches at a
  // segment boundary: /api/authx/signin is not under /api/auth.
  function parseSegments(req) {
    const path = new URL(req.url).pathname;
    const mount = appBasePath();
    const bases = [basePath];
    if (mount && basePath.startsWith(mount + '/')) bases.push(basePath.slice(mount.length));
    if (!bases.includes('/api/auth')) bases.push('/api/auth');
    for (const b of bases) {
      if (path === b || path.startsWith(b + '/')) return path.slice(b.length).split('/').filter(Boolean);
    }
    return [];
  }

  async function GET(req) {
    const seg = parseSegments(req);

    if (seg[0] === 'session') {
      return new Response(JSON.stringify(await readSession(req)), { headers: { 'content-type': 'application/json' } });
    }
    if (seg[0] === 'signin' && seg[1]) {
      const p = providers.get(seg[1]);
      if (!p || p.type !== 'oauth') return new Response('Unknown OAuth provider', { status: 404 });
      return oauthRedirect(p, { req, redirectTo: new URL(req.url).searchParams.get('redirectTo') });
    }
    if (seg[0] === 'callback' && seg[1]) {
      const p = providers.get(seg[1]);
      if (!p || p.type !== 'oauth') return new Response('Unknown OAuth provider', { status: 404 });
      return oauthCallback(req, p);
    }
    // A GET never signs out (#1686): a link prefetch, a crawler or an image
    // tag would. As in Auth.js it answers a page whose button POSTs.
    if (seg[0] === 'signout') return pages.signOut ? Response.redirect(new URL(pages.signOut, req.url).toString(), 302) : signOutPage();
    if (seg[0] === 'signin' && !seg[1]) return signInPage(new URL(req.url).searchParams.get('callbackUrl'));
    if (seg[0] === 'providers') {
      const list = {};
      for (const [id, p] of providers) list[id] = { id: p.id, name: p.name, type: p.type, signinUrl: `${basePath}/signin/${id}` };
      return new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  /**
   * The bounded JSON or form body an auth POST carries, or a 413 Response.
   * Auth.js names the post-auth target `callbackUrl`; it is read as
   * `redirectTo` when that is not given (#1686).
   * @param {Request} req
   * @returns {Promise<Record<string, unknown> | Response>}
   */
  async function readAuthBody(req) {
    const limits = getBodyLimits();
    const limit = limits ? limits.json : DEFAULT_MAX_BODY_BYTES;
    /** @type {Record<string, unknown>} */
    let body = {};
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('json')) {
      const { tooLarge, text } = await readTextBounded(req, limit);
      if (tooLarge) return payloadTooLarge();
      try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    } else if (ct.includes('form')) {
      const { tooLarge, formData } = await readFormDataBounded(req, limit);
      if (tooLarge) return payloadTooLarge();
      for (const [k, v] of formData.entries()) body[k] = v;
    }
    if (body.redirectTo == null && typeof body.callbackUrl === 'string') body.redirectTo = body.callbackUrl;
    return body;
  }

  async function POST(req) {
    const seg = parseSegments(req);
    // Sign-in and sign-out change who the visitor is, so a cross-site form
    // posting here is refused, as the action endpoint refuses one (#1686).
    const origin = verifyOrigin(req, getAllowedOrigins());
    if (!origin.ok) return new Response('Forbidden: ' + origin.reason, { status: 403 });

    if (seg[0] === 'signin' && seg[1]) {
      const provider = providers.get(seg[1]);
      if (!provider) return new Response('Unknown provider', { status: 404 });
      // Bounded body read (issue #237): the sign-in endpoint is public and
      // unauthenticated, so cap its body to defend against memory exhaustion.
      // Credentials (and an OAuth form's `redirectTo`, #1495) are small
      // fixed-shape JSON / form data, so the JSON / RPC limit applies. An
      // over-limit body is a 413 before any parse, and is never buffered
      // whole (see body-limit.js).
      const body = await readAuthBody(req);
      if (body instanceof Response) return body;
      if (provider.type === 'credentials') return signInFn('credentials', body, { req });
      if (provider.type === 'oauth') {
        const redirectTo = body.redirectTo ?? new URL(req.url).searchParams.get('redirectTo');
        return oauthRedirect(provider, { req, redirectTo });
      }
    }
    if (seg[0] === 'signout') {
      // The form's own target, as Auth.js's sign-out route honours its
      // submitted callbackUrl (#1686); otherwise "/".
      const body = await readAuthBody(req);
      if (body instanceof Response) return body;
      return signOutFn({ req, redirectTo: /** @type {any} */ (body.redirectTo) });
    }
    return new Response('Not found', { status: 404 });
  }

  // -- The public signIn() / signOut(): Auth.js v5 semantics ----------------
  //
  // Inside a request (a server action, a route handler, middleware) they act
  // the way Auth.js's do in a Next server action: the session cookie goes onto
  // this request's response through the cookie store, and success THROWS a
  // redirect, so the habit `await signIn('credentials', formData)` works and
  // so does `return signIn(...)`. A credentials failure throws
  // `CredentialsSignin` (an `AuthError`), which an action can catch to return
  // a message; uncaught, it is also a redirect to the error page, as the
  // `/api/auth/*` route does. `{ redirect: false }` returns the target url
  // instead of throwing. With no request in scope (a script, a unit test that
  // calls it bare) they return the Response the route handlers send.

  async function signIn(providerId, data, opts = {}) {
    const fields = data instanceof FormData ? formFields(data) : (data || {});
    // No target given: back to the page signIn was called from, as Auth.js.
    if (!opts.redirectTo && !fields.redirectTo) {
      const back = refererPath(opts.req || getRequest());
      if (back) opts = { ...opts, redirectTo: back };
    }
    const noRedirect = opts.redirect === false || fields.redirect === false || fields.redirect === 'false';
    if (!getRequest()) return signInFn(providerId, fields, opts);
    const res = await signInFn(providerId, fields, opts);
    const location = res.headers.get('location');
    // getSetCookie(): get('set-cookie') joins several cookies with commas, which
    // breaks an Expires date and a second cookie (the OAuth state and redirect).
    const cookies = res.headers.getSetCookie();
    if (cookies.length === 0 && /[?&]error=CredentialsSignin\b/.test(location || '')) throw credentialsSignin(location);
    for (const cookie of cookies) queueSetCookie(cookie);
    if (res.status !== 302 || !location) return res;
    if (noRedirect) return location;
    return redirect(location);
  }

  async function signOut(opts = {}) {
    if (!opts.redirectTo) {
      const back = refererPath(opts.req || getRequest());
      if (back) opts = { ...opts, redirectTo: back };
    }
    if (!getRequest()) return signOutFn(opts);
    const res = await signOutFn(opts);
    for (const c of res.headers.getSetCookie()) queueSetCookie(c);
    const location = /** @type {string} */ (res.headers.get('location'));
    if (opts.redirect === false) return location;
    return redirect(location);
  }

  return { auth, signIn, signOut, handlers: { GET, POST } };
}

/**
 * Put a `Set-Cookie` the auth flow built onto the in-flight response.
 * @param {string} setCookie
 */
function queueSetCookie(setCookie) {
  const store = requestCookieStore();
  if (store.sealed) throw new Error('signIn()/signOut(): the response headers were already sent, so the session cookie cannot be set. Call it from a server action, a route handler or middleware.');
  store.pending.set(setCookie.slice(0, setCookie.indexOf('=')), setCookie);
}

/**
 * A FormData as the plain credentials object Auth.js hands `authorize`.
 * @param {FormData} fd
 * @returns {Record<string, unknown>}
 */
function formFields(fd) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of fd.entries()) out[k] = v;
  return out;
}

/**
 * Auth.js's base error class: `error instanceof AuthError` and `error.type`
 * tell an action why a sign-in failed.
 */
export class AuthError extends Error {
  /** @param {string} [message] */
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    /** @type {string} */
    this.type = 'AuthError';
  }
}

/** Thrown by `signIn('credentials', ...)` when `authorize` returns null. */
export class CredentialsSignin extends AuthError {
  /** @param {string} [message] */
  constructor(message = 'Invalid credentials.') {
    super(message);
    this.name = 'CredentialsSignin';
    this.type = 'CredentialsSignin';
    /** Auth.js's `code`, the value of the `error` query parameter. */
    this.code = 'credentials';
  }
}

/**
 * A `CredentialsSignin` that is ALSO a redirect to the error page, so an
 * action that does not catch it sends the user where the route handler would.
 * @param {string} location
 */
function credentialsSignin(location) {
  const err = new CredentialsSignin();
  try {
    redirect(location);
  } catch (r) {
    const rr = /** @type {any} */ (r);
    Object.assign(err, { __webjs: rr.__webjs, url: rr.url, status: rr.status, redirectType: rr.redirectType });
  }
  return err;
}

// -- Default database adapter (cache store) ---------------------------------

function defaultAdapter() {
  const store = getStore();
  return {
    async load(id) { const r = await store.get(`auth:session:${id}`); if (!r) return null; try { return JSON.parse(r); } catch { return null; } },
    async save(id, data, maxAgeMs) { await store.set(`auth:session:${id}`, JSON.stringify(data), maxAgeMs); },
    async destroy(id) { await store.delete(`auth:session:${id}`); },
  };
}
