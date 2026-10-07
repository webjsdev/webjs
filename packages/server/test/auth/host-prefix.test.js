/**
 * createAuth's cookies carry the `__Host-` prefix in production (#1538).
 *
 * Two apps on sibling subdomains of a domain that is not on the Public Suffix
 * List share a cookie jar for `Domain=` cookies, so one app can toss its own
 * valid `webjs.auth` to a visitor of the other (session fixation). A browser
 * only stores a `__Host-` cookie with Secure, Path=/ and no Domain, so a
 * sibling cannot plant one; production must therefore read ONLY the prefixed
 * name. Development over http keeps the plain names.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials, GitHub, cookieName } from '../../src/auth.js';

const SECRET = 'test-secret-at-least-32-characters-long!!';
const env = process.env.NODE_ENV;
afterEach(() => {
  if (env === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = env;
});

function makeAuth() {
  return createAuth({
    secret: SECRET,
    providers: [
      Credentials({ authorize: async (c) => (c.email === 'a@b.co' ? { id: '1', name: 'A', email: 'a@b.co' } : null) }),
      GitHub({ clientId: 'cid', clientSecret: 'cs' }),
    ],
  });
}

/** The session cookie a sign-in sets, as `name=value`. */
async function signInPair(auth) {
  const res = await auth.signIn('credentials', { email: 'a@b.co', password: 'x' });
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).find((p) => p.includes('webjs.auth='));
}

test('cookieName prefixes only when secure', () => {
  assert.equal(cookieName('webjs.auth', true), '__Host-webjs.auth');
  assert.equal(cookieName('webjs.auth', false), 'webjs.auth');
});

test('production: the session cookie is __Host- prefixed, Secure, Path=/ and has no Domain', async () => {
  process.env.NODE_ENV = 'production';
  const res = await makeAuth().signIn('credentials', { email: 'a@b.co', password: 'x' });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('__Host-webjs.auth='));
  assert.ok(cookie, 'prefixed session cookie set');
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; Path=\//);
  assert.doesNotMatch(cookie, /Domain=/i);
});

test('production: the prefixed session reads back, and a tossed unprefixed one reads as signed out', async () => {
  process.env.NODE_ENV = 'production';
  const auth = makeAuth();
  const pair = await signInPair(auth);
  assert.ok(pair.startsWith('__Host-webjs.auth='));
  const own = await auth.auth(new Request('https://a.example.app/', { headers: { cookie: pair } }));
  assert.equal(own?.user?.id, '1');
  // The same valid token under the plain name, as a sibling subdomain would toss it.
  const tossed = pair.replace(/^__Host-/, '');
  assert.equal(await auth.auth(new Request('https://a.example.app/', { headers: { cookie: tossed } })), null);
});

test('production: sign-out clears the prefixed cookie with Secure, or the browser would keep it', async () => {
  process.env.NODE_ENV = 'production';
  const res = await makeAuth().signOut();
  const cleared = res.headers.getSetCookie().find((c) => c.startsWith('__Host-webjs.auth='));
  assert.ok(cleared);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /; Secure/);
});

test('production: the OAuth state and redirect cookies are prefixed too', async () => {
  process.env.NODE_ENV = 'production';
  const res = await makeAuth().handlers.GET(new Request('https://a.example.app/api/auth/signin/github?redirectTo=/dash'));
  assert.equal(res.status, 302);
  const names = res.headers.getSetCookie().map((c) => c.split('=')[0]);
  assert.ok(names.includes('__Host-webjs.auth.state'), names.join(','));
  assert.ok(names.includes('__Host-webjs.auth.redirect'), names.join(','));
  assert.ok(!names.includes('webjs.auth.state'));
});

test('development: the plain names, unchanged', async () => {
  process.env.NODE_ENV = 'development';
  const auth = makeAuth();
  const pair = await signInPair(auth);
  assert.ok(pair.startsWith('webjs.auth='));
  assert.equal((await auth.auth(new Request('http://localhost/', { headers: { cookie: pair } })))?.user?.id, '1');
});
