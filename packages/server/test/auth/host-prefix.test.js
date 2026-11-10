/**
 * createAuth's cookies carry the `__Host-` prefix when they are secure (#1538),
 * and they are secure by Auth.js's rule (core/src/lib/init.ts):
 * `useSecureCookies` when set, else whether the auth URL is https, AUTH_URL's
 * when set, else the request's. Not NODE_ENV: `npm start` over plain http
 * would set cookies the browser drops, and sign-in would loop.
 *
 * Two apps on sibling subdomains of a domain that is not on the Public Suffix
 * List share a cookie jar for `Domain=` cookies, so one app can toss its own
 * valid `webjs.auth` to a visitor of the other (session fixation). A browser
 * only stores a `__Host-` cookie with Secure, Path=/ and no Domain, so a
 * sibling cannot plant one; over https the app therefore reads ONLY the
 * prefixed name. Over http it keeps the plain names.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials, GitHub, cookieName } from '../../src/auth.js';

const SECRET = 'test-secret-at-least-32-characters-long!!';
const saved = { NODE_ENV: process.env.NODE_ENV, AUTH_URL: process.env.AUTH_URL };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const HTTPS = new Request('https://a.example.app/login');
const HTTP = new Request('http://a.example.app/login');

function makeAuth(extra = {}) {
  return createAuth({
    ...extra,
    secret: SECRET,
    providers: [
      Credentials({ authorize: async (c) => (c.email === 'a@b.co' ? { id: '1', name: 'A', email: 'a@b.co' } : null) }),
      GitHub({ clientId: 'cid', clientSecret: 'cs' }),
    ],
  });
}

/** The session cookie a sign-in sets, as `name=value`. */
async function signInPair(auth, req = HTTPS) {
  const res = await auth.signIn('credentials', { email: 'a@b.co', password: 'x' }, { req });
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).find((p) => p.includes('webjs.auth='));
}

test('cookieName prefixes only when secure', () => {
  assert.equal(cookieName('webjs.auth', true), '__Host-webjs.auth');
  assert.equal(cookieName('webjs.auth', false), 'webjs.auth');
});

test('https: the session cookie is __Host- prefixed, Secure, Path=/ and has no Domain', async () => {
  const res = await makeAuth().signIn('credentials', { email: 'a@b.co', password: 'x' }, { req: HTTPS });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('__Host-webjs.auth='));
  assert.ok(cookie, 'prefixed session cookie set');
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; Path=\//);
  assert.doesNotMatch(cookie, /Domain=/i);
});

test('https: the prefixed session reads back, and a tossed unprefixed one reads as signed out', async () => {
  const auth = makeAuth();
  const pair = await signInPair(auth);
  assert.ok(pair.startsWith('__Host-webjs.auth='));
  const own = await auth.auth(new Request('https://a.example.app/', { headers: { cookie: pair } }));
  assert.equal(own?.user?.id, '1');
  // The same valid token under the plain name, as a sibling subdomain would toss it.
  const tossed = pair.replace(/^__Host-/, '');
  assert.equal(await auth.auth(new Request('https://a.example.app/', { headers: { cookie: tossed } })), null);
});

test('https: sign-out clears the prefixed cookie with Secure, or the browser would keep it', async () => {
  const res = await makeAuth().signOut({ req: HTTPS });
  const cleared = res.headers.getSetCookie().find((c) => c.startsWith('__Host-webjs.auth='));
  assert.ok(cleared);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /; Secure/);
});

test('https: the OAuth state and redirect cookies are prefixed too', async () => {
  const res = await makeAuth().handlers.GET(new Request('https://a.example.app/api/auth/signin/github?redirectTo=/dash'));
  assert.equal(res.status, 302);
  const names = res.headers.getSetCookie().map((c) => c.split('=')[0]);
  assert.ok(names.includes('__Host-webjs.auth.state'), names.join(','));
  assert.ok(names.includes('__Host-webjs.auth.redirect'), names.join(','));
  assert.ok(!names.includes('webjs.auth.state'));
});

test('http: the plain names and no Secure flag, in production too', async () => {
  // NODE_ENV does not decide: `npm start` over plain http must still sign in.
  process.env.NODE_ENV = 'production';
  const auth = makeAuth();
  const res = await auth.signIn('credentials', { email: 'a@b.co', password: 'x' }, { req: HTTP });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('webjs.auth='));
  assert.ok(cookie, 'the plain name over http');
  assert.doesNotMatch(cookie, /; Secure/, 'no Secure flag the browser would drop it for');
  const pair = cookie.split(';')[0];
  assert.equal((await auth.auth(new Request('http://a.example.app/', { headers: { cookie: pair } })))?.user?.id, '1');
});

test('AUTH_URL decides when set, and useSecureCookies overrides both', async () => {
  process.env.AUTH_URL = 'https://a.example.app';
  const viaAuthUrl = await signInPair(makeAuth(), HTTP);
  assert.ok(viaAuthUrl.startsWith('__Host-webjs.auth='), 'an https AUTH_URL is secure behind a TLS-terminating proxy that forwards http');
  delete process.env.AUTH_URL;
  const forcedOff = await signInPair(makeAuth({ useSecureCookies: false }), HTTPS);
  assert.ok(forcedOff.startsWith('webjs.auth='), 'useSecureCookies: false keeps the plain names over https');
  const forcedOn = await signInPair(makeAuth({ useSecureCookies: true }), HTTP);
  assert.ok(forcedOn.startsWith('__Host-webjs.auth='), 'useSecureCookies: true prefixes over http');
});
