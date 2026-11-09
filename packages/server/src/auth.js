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

/** @param {Record<string,unknown>} payload @param {string} secret */
export async function encodeJwt(payload, secret) {
  const h = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${h}.${p}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

/** @param {string} token @param {string} secret @returns {Promise<Record<string,unknown>|null>} */
export async function decodeJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  // `unb64url` → `atob` throws InvalidCharacterError on non-base64 input.
  // Any failure here (bad base64, bad HMAC verify) means the cookie is
  // garbage; treat it as "no session" rather than crashing the request.
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(unb64url(parts[1])));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
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
    profile: (p) => ({ id: String(p.sub), name: p.name, email: p.email, image: p.picture }),
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
    profile: (p) => ({ id: String(p.id), name: p.name || p.login, email: p.email, image: p.avatar_url }),
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
  // Outside production a missing secret falls back to a generated one kept in
  // .webjs/dev-secret (dev-secret.js), so a fresh clone or worktree works.
  const secret = config.secret || process.env.AUTH_SECRET || devSecret('AUTH_SECRET');
  if (!secret) throw new Error('createAuth() needs a secret to sign its session in production: set AUTH_SECRET in .env (webjs create writes one), or pass createAuth({ secret }).');

  const strategy = config.session?.strategy || 'jwt';
  const maxAge = config.session?.maxAge || DEFAULT_MAX_AGE;
  const maxAgeMs = maxAge * 1000;
  const cb = config.callbacks || {};
  const pages = config.pages || {};
  const secure = () => process.env.NODE_ENV === 'production';

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
  async function signInRefusal(user, account, extraCookies = []) {
    if (!cb.signIn) return null;
    const ok = await cb.signIn({ user, account });
    if (ok && typeof ok !== 'string') return null;
    const hdrs = new Headers();
    hdrs.set('location', typeof ok === 'string' ? (safeRedirectPath(ok) || ok) : (pages.error || '/?error=AccessDenied'));
    for (const c of extraCookies) hdrs.append('set-cookie', c);
    return new Response(null, { status: 302, headers: hdrs });
  }

  const dbStore = strategy === 'database' ? (config.adapter || defaultAdapter()) : null;

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
    const raw = cookies[cookieName(AUTH_COOKIE, secure())];
    if (!raw) return null;

    if (strategy === 'jwt') {
      const payload = await decodeJwt(raw, secret);
      if (!payload) return null;
      let token = cb.jwt ? await cb.jwt({ token: payload, user: undefined }) : payload;
      let session = { user: { id: token.sub, name: token.name, email: token.email, image: token.image, ...token } };
      delete session.user.iat; delete session.user.exp; delete session.user.sub;
      return cb.session ? cb.session({ session, token, user: undefined }) : session;
    }

    const sid = await unsign(raw, secret);
    if (!sid || !dbStore) return null;
    const data = await dbStore.load(sid);
    if (!data) return null;
    let session = { user: data };
    return cb.session ? cb.session({ session, token: undefined, user: data }) : session;
  }

  async function writeSession(user) {
    if (strategy === 'jwt') {
      let token = { sub: user.id, name: user.name, email: user.email, image: user.image, role: user.role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + maxAge };
      if (cb.jwt) token = await cb.jwt({ token, user });
      return setCookie(cookieName(AUTH_COOKIE, secure()), await encodeJwt(token, secret), maxAgeMs, secure());
    }
    const sid = randomId();
    await dbStore.save(sid, user, maxAgeMs);
    return setCookie(cookieName(AUTH_COOKIE, secure()), await sign(sid, secret), maxAgeMs, secure());
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
    const target = new URL(pages.signIn || '/api/auth/signin', url.origin);
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

  // -- signIn() -------------------------------------------------------------

  async function signInFn(providerId, data, opts = {}) {
    const provider = providers.get(providerId);
    if (!provider) return new Response('Unknown provider', { status: 400 });

    if (provider.type === 'credentials') {
      if (!provider.authorize) return new Response('No authorize function', { status: 500 });
      const user = await provider.authorize(data || {});
      if (!user) {
        return new Response(null, { status: 302, headers: { location: `${pages.error || pages.signIn || '/'}?error=CredentialsSignin` } });
      }
      const refused = await signInRefusal(user, { provider: providerId });
      if (refused) return refused;
      const cookie = await writeSession(user);
      // `opts.redirectTo` is the app's own server-side choice and is trusted.
      // `data.redirectTo` usually arrives from a submitted form, so it goes
      // through the same local-path check the OAuth flow uses (#1495).
      const redirectTo = opts.redirectTo || safeRedirectPath(data && data.redirectTo) || '/';
      return new Response(null, { status: 302, headers: { location: /** @type {string} */ (redirectTo), 'set-cookie': cookie } });
    }

    if (provider.type === 'oauth') {
      return oauthRedirect(provider, { ...opts, redirectTo: opts.redirectTo || (data && data.redirectTo) });
    }
    return new Response('Unsupported provider type', { status: 400 });
  }

  // -- signOut() ------------------------------------------------------------

  async function signOutFn(opts = {}) {
    const hdrs = new Headers();
    hdrs.set('location', opts.redirectTo || pages.signOut || '/');
    hdrs.append('set-cookie', clearCookie(cookieName(AUTH_COOKIE, secure()), secure()));

    if (strategy === 'database' && dbStore) {
      const r = opts.req || getRequest();
      if (r) {
        const raw = parseCookies(r.headers.get('cookie') || '')[cookieName(AUTH_COOKIE, secure())];
        if (raw) { const sid = await unsign(raw, secret); if (sid) await dbStore.destroy(sid); }
      }
    }
    return new Response(null, { status: 302, headers: hdrs });
  }

  // -- OAuth helpers --------------------------------------------------------

  async function oauthRedirect(provider, opts) {
    const req = opts.req || getRequest();
    const origin = req ? new URL(req.url).origin : 'http://localhost:8080';
    const state = randomId();

    const url = new URL(provider.authorizationUrl);
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', `${origin}/api/auth/callback/${provider.id}`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', (provider.scope || []).join(' '));
    url.searchParams.set('state', state);

    const hdrs = new Headers();
    hdrs.set('location', url.toString());
    hdrs.append('set-cookie', setCookie(cookieName(STATE_COOKIE, secure()), await sign(state, secret), 600_000, secure()));
    // The post-sign-in target rides in its own signed cookie (#1495). With no
    // valid target, any leftover cookie from an abandoned earlier attempt is
    // cleared so it cannot steer this sign-in somewhere stale.
    const target = safeRedirectPath(opts.redirectTo);
    hdrs.append('set-cookie', target
      ? setCookie(cookieName(REDIRECT_COOKIE, secure()), await sign(target, secret), 600_000, secure())
      : clearCookie(cookieName(REDIRECT_COOKIE, secure()), secure()));
    return new Response(null, { status: 302, headers: hdrs });
  }

  /**
   * Read the signed post-sign-in target the redirect leg stored, re-checking it
   * as a local path (defence in depth: the signature proves this app wrote it,
   * the check proves it is still a safe target). Null when absent or invalid.
   *
   * @param {Request} req
   * @returns {Promise<string | null>}
   */
  async function readRedirectCookie(req) {
    const raw = parseCookies(req.headers.get('cookie') || '')[cookieName(REDIRECT_COOKIE, secure())];
    if (!raw) return null;
    return safeRedirectPath(await unsign(raw, secret));
  }

  async function oauthCallback(req, provider) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return new Response('Missing code or state', { status: 400 });

    const rawState = parseCookies(req.headers.get('cookie') || '')[cookieName(STATE_COOKIE, secure())];
    if (!rawState) return new Response('Missing state cookie', { status: 403 });
    const verified = await unsign(rawState, secret);
    if (!verified || verified !== state) return new Response('Invalid state', { status: 403 });

    // Exchange code for token
    const callbackUrl = `${url.origin}/api/auth/callback/${provider.id}`;
    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ client_id: provider.clientId, client_secret: provider.clientSecret, code, redirect_uri: callbackUrl, grant_type: 'authorization_code' }),
    });
    if (!tokenRes.ok) return new Response('Token exchange failed', { status: 502 });
    const { access_token: accessToken } = await tokenRes.json();
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

    const refused = await signInRefusal(user, { provider: provider.id, accessToken }, [
      clearCookie(cookieName(STATE_COOKIE, secure()), secure()),
      clearCookie(cookieName(REDIRECT_COOKIE, secure()), secure()),
    ]);
    if (refused) return refused;

    const hdrs = new Headers();
    hdrs.set('location', (await readRedirectCookie(req)) || '/');
    hdrs.append('set-cookie', await writeSession(user));
    hdrs.append('set-cookie', clearCookie(cookieName(STATE_COOKIE, secure()), secure()));
    hdrs.append('set-cookie', clearCookie(cookieName(REDIRECT_COOKIE, secure()), secure()));
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
      + '<form method="post" action="/api/auth/signout"><button type="submit">Sign out</button></form>');
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
      `<form method="post" action="/api/auth/signin/${esc(p.id)}"><input type="hidden" name="redirectTo" value="${esc(back)}">`
      + `<button type="submit">Sign in with ${esc(p.name)}</button></form>`).join('');
    return htmlPage('Sign in', `<h1>Sign in</h1>${buttons || '<p>Set <code>pages.signIn</code> to your sign-in page.</p>'}`);
  }

  // -- Route handlers (mount at app/api/auth/[...path]/route.js) ------------

  function parseSegments(req) {
    return new URL(req.url).pathname.replace(/^\/api\/auth\/?/, '').split('/').filter(Boolean);
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
      for (const [id, p] of providers) list[id] = { id: p.id, name: p.name, type: p.type, signinUrl: `/api/auth/signin/${id}` };
      return new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
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
      const limits = getBodyLimits();
      const limit = limits ? limits.json : DEFAULT_MAX_BODY_BYTES;
      /** @type {Record<string, unknown>} */
      let body = {};
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const { tooLarge, text } = await readTextBounded(req, limit);
        if (tooLarge) return payloadTooLarge();
        body = text ? JSON.parse(text) : {};
      } else if (ct.includes('form')) {
        const { tooLarge, formData } = await readFormDataBounded(req, limit);
        if (tooLarge) return payloadTooLarge();
        for (const [k, v] of formData.entries()) body[k] = v;
      }
      if (provider.type === 'credentials') return signInFn('credentials', body, { req });
      if (provider.type === 'oauth') {
        const redirectTo = body.redirectTo ?? new URL(req.url).searchParams.get('redirectTo');
        return oauthRedirect(provider, { req, redirectTo });
      }
    }
    if (seg[0] === 'signout') return signOutFn({ req });
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
    const noRedirect = opts.redirect === false || fields.redirect === false || fields.redirect === 'false';
    if (!getRequest()) return signInFn(providerId, fields, opts);
    const res = await signInFn(providerId, fields, opts);
    const location = res.headers.get('location');
    const cookie = res.headers.get('set-cookie');
    if (!cookie && /[?&]error=CredentialsSignin\b/.test(location || '')) throw credentialsSignin(location);
    if (cookie) queueSetCookie(cookie);
    if (res.status !== 302 || !location) return res;
    if (noRedirect) return location;
    return redirect(location);
  }

  async function signOut(opts = {}) {
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
