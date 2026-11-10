/**
 * Auth.js v5 behaviours that were security gaps (#1686), each asserted against
 * what Auth.js does, so an app written from Auth.js habits is safe as written:
 * `auth` as middleware (and as a middleware wrapper), the signIn callback's
 * allow / deny / redirect contract, an origin check on the auth POST routes, a
 * malformed cookie, and a provider passed uncalled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials, GitHub } from '../../src/auth.js';
import { withRequest, setAllowedOrigins } from '../../src/context.js';

const SECRET = 'authjs-security-secret-0123456789';
const alice = { id: '1', email: 'a@example.com', name: 'Alice' };

/** A signed-in cookie header for `instance`. */
async function signedInCookie(instance) {
  const res = await instance.signIn('credentials', { email: alice.email });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

function make(extra = {}) {
  return createAuth({ secret: SECRET, providers: [Credentials({ authorize: async () => alice })], ...extra });
}

test('export { auth as middleware }: answers as middleware, never with the session', async () => {
  const a = make();
  const cookie = await signedInCookie(a);
  let nexted = 0;
  const next = async () => { nexted++; return new Response('page'); };
  // Signed in: before the fix this returned the session object, a 500.
  const req = new Request('http://localhost/dash', { headers: { cookie } });
  const res = await a.auth(req, next);
  assert.ok(res instanceof Response, 'a Response, not the session');
  assert.equal(await res.text(), 'page');
  assert.equal(/** @type {any} */ (req).auth.user.email, alice.email, 'req.auth carries the session');
  // Signed out, no authorized callback: Auth.js lets the request through.
  assert.equal(await (await a.auth(new Request('http://localhost/dash'), next)).text(), 'page');
  assert.equal(nexted, 2);
});

test('callbacks.authorized gates the middleware: false redirects to sign in with callbackUrl', async () => {
  const a = make({
    pages: { signIn: '/login' },
    callbacks: { authorized: ({ auth, request }) => !!auth || !new URL(request.url).pathname.startsWith('/dash') },
  });
  const next = async () => new Response('page');
  const out = await a.auth(new Request('http://localhost/dash/x?y=1'), next);
  assert.equal(out.status, 302);
  assert.equal(new URL(out.headers.get('location')).pathname, '/login');
  assert.equal(new URL(out.headers.get('location')).searchParams.get('callbackUrl'), '/dash/x?y=1');
  assert.equal(await (await a.auth(new Request('http://localhost/about'), next)).text(), 'page', 'public pages pass');
  const cookie = await signedInCookie(a);
  assert.equal(await (await a.auth(new Request('http://localhost/dash', { headers: { cookie } }), next)).text(), 'page');
});

test('auth((req) => ...) wraps a middleware that reads req.auth', async () => {
  const a = make();
  const mw = a.auth((req) => (req.auth ? undefined : Response.redirect(new URL('/login', req.url), 302)));
  const out = await mw(new Request('http://localhost/dash'));
  assert.equal(out.status, 302, 'the wrapped handler saw no session');
  const cookie = await signedInCookie(a);
  assert.equal(await mw(new Request('http://localhost/dash', { headers: { cookie } })), undefined, 'signed in, it continues');
});

test('auth(req) and auth() still read the session', async () => {
  const a = make();
  const cookie = await signedInCookie(a);
  const req = new Request('http://localhost/', { headers: { cookie } });
  assert.equal((await a.auth(req)).user.email, alice.email);
  assert.equal((await withRequest(req, () => a.auth())).user.email, alice.email);
});

test('signIn callback: a string redirects without signing in, any falsy value denies, as in Auth.js', async () => {
  for (const [verdict, location] of [['/verify-email', '/verify-email'], [undefined, '/?error=AccessDenied'], [false, '/?error=AccessDenied']]) {
    const a = make({ callbacks: { signIn: () => verdict } });
    const res = await a.signIn('credentials', {});
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), location, `verdict ${String(verdict)}`);
    assert.equal(res.headers.get('set-cookie'), null, `verdict ${String(verdict)} sets no session`);
  }
  const ok = await make({ callbacks: { signIn: () => true } }).signIn('credentials', {});
  assert.match(ok.headers.get('set-cookie') || '', /webjs\.auth=/, 'true signs in');
});

test('the auth POST routes refuse a cross-site request (login CSRF)', async () => {
  const a = make();
  const post = (headers) => withRequest(new Request('http://localhost/'), () => a.handlers.POST(new Request('http://localhost/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}',
  })));
  assert.equal((await post({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({ 'sec-fetch-site': 'same-origin' })).status, 302);
  assert.equal((await post({})).status, 302, 'a script or test with no origin headers is not a browser');
  const allowed = await withRequest(new Request('http://localhost/'), () => {
    setAllowedOrigins(['https://app.example']);
    return a.handlers.POST(new Request('http://localhost/api/auth/signout', {
      method: 'POST', headers: { 'sec-fetch-site': 'cross-site', origin: 'https://app.example' },
    }));
  });
  assert.equal(allowed.status, 302, 'webjs.allowedOrigins is honoured');
});

test('a malformed cookie does not make auth() throw', async () => {
  const a = make();
  const cookie = await signedInCookie(a);
  const req = new Request('http://localhost/', { headers: { cookie: `junk=%E0%A4%A; ${cookie}` } });
  assert.equal((await a.auth(req)).user.email, alice.email);
});

test('providers: [GitHub] (the function, uncalled) is keyed github, as Auth.js accepts', async () => {
  const a = createAuth({ secret: SECRET, providers: [GitHub] });
  const list = await (await a.handlers.GET(new Request('http://localhost/api/auth/providers'))).json();
  assert.deepEqual(Object.keys(list), ['github']);
});

test('GET /api/auth/signin lists the OAuth providers, or redirects to pages.signIn', async () => {
  const page = await createAuth({ secret: SECRET, providers: [GitHub] }).handlers.GET(new Request('http://localhost/api/auth/signin?callbackUrl=/dash'));
  const body = await page.text();
  assert.match(body, /action="\/api\/auth\/signin\/github"/);
  assert.match(body, /name="redirectTo" value="\/dash"/);
  const custom = await make({ pages: { signIn: '/login' } }).handlers.GET(new Request('http://localhost/api/auth/signin?callbackUrl=/dash'));
  assert.equal(custom.headers.get('location'), '/login?callbackUrl=%2Fdash');
});
