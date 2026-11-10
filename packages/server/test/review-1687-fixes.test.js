/**
 * The eight findings of the owner's review of PR #1687, each pinned by a test
 * that fails without its fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, GitHub, Credentials } from '../src/auth.js';
import { withRequest, currentCookieStore, requestCookieStore } from '../src/context.js';
import { applyPendingCookies } from '../src/cookie-store.js';
import { searchParamsRecord } from '../src/thenable-params.js';
import { encryptSession, decryptSession } from '../src/jwe.js';
import { refreshCovers } from '../../core/src/refresh-header.js';

const SECRET = 'review-1687-secret-at-least-32-bytes-long';

test('server-side signIn() queues every Set-Cookie on its own, never the comma-joined header', async () => {
  const { signIn } = createAuth({ secret: SECRET, providers: [GitHub({ clientId: 'id', clientSecret: 's' })] });
  const req = new Request('https://app.example/login', { method: 'POST' });
  await withRequest(req, async () => {
    await assert.rejects(() => signIn('github', { redirectTo: '/inbox' }));
    const pending = [...currentCookieStore().pending.values()];
    assert.ok(pending.length >= 2, `expected the state and redirect cookies, got ${pending.length}`);
    for (const c of pending) assert.doesNotMatch(c, /,\s*[\w.-]+=/, `one cookie per value: ${c}`);
    assert.ok(pending.some((c) => /^[\w.-]*auth\.state=/.test(c.replace(/^__Host-/, ''))), 'the state cookie is queued');
  });
});

test('a jwt callback that returns a new object still gets a session with an expiry', async () => {
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => ({ id: '1', email: 'a@b.c' }) })],
    callbacks: { jwt: ({ token }) => ({ sub: token.sub, role: 'admin' }) },
  });
  const res = await auth.handlers.POST(new Request('https://app.example/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://app.example' },
    body: 'email=a%40b.c&password=x',
  }));
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  assert.ok(cookie, 'a session cookie is set');
  const session = await auth.auth(new Request('https://app.example/', { headers: { cookie } }));
  assert.ok(session, 'auth() reads the session instead of throwing');
  assert.ok(!Number.isNaN(Date.parse(session.expires)), 'expires is a real date');
});

test('a query key named like an Object.prototype member is just a key', () => {
  const out = searchParamsRecord(new URLSearchParams('constructor=x&toString=y&__proto__=z&__proto__=w&tag=a&tag=b'));
  assert.equal(out.constructor, 'x');
  assert.equal(out.toString, 'y');
  assert.deepEqual(out.__proto__, ['z', 'w']);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
  assert.deepEqual(out.tag, ['a', 'b']);
});

test('the session key is derived once per secret and cookie name', async () => {
  const realDerive = crypto.subtle.deriveBits.bind(crypto.subtle);
  let calls = 0;
  crypto.subtle.deriveBits = (...a) => { calls++; return realDerive(...a); };
  try {
    const salt = 'review-1687.session-token';
    const token = await encryptSession({ sub: '1', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET + 'k', salt);
    const before = calls;
    for (let i = 0; i < 5; i++) assert.equal((await decryptSession(token, SECRET + 'k', salt)).sub, '1');
    assert.equal(calls - before, 0, 'no HKDF on a later decrypt with the same secret');
  } finally {
    crypto.subtle.deriveBits = realDerive;
  }
});

test('a required catch-all in revalidatePath needs at least one segment', () => {
  assert.equal(refreshCovers({ path: '/blog/[...slug]', layout: false }, '/blog'), false);
  assert.equal(refreshCovers({ path: '/blog/[...slug]', layout: false }, '/blog/a/b'), true);
  assert.equal(refreshCovers({ path: '/blog/[[...slug]]', layout: false }, '/blog'), true);
});

test('a shared Response never collects a request\'s Set-Cookie', async () => {
  const shared = new Response(null, { status: 204 });
  await withRequest(new Request('https://app.example/'), async () => {
    requestCookieStore().set('sid', 'visitor-a');
    const out = applyPendingCookies(shared, currentCookieStore());
    assert.notEqual(out, shared);
    assert.match(out.headers.get('set-cookie') || '', /sid=visitor-a/);
  });
  assert.equal(shared.headers.get('set-cookie'), null, 'the shared object is untouched');
});

test('a signIn callback string that is not a local path is refused like false', async () => {
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => ({ id: '1' }) })],
    callbacks: { signIn: () => 'https://evil.example/' },
    pages: { error: '/login' },
  });
  const res = await auth.handlers.POST(new Request('https://app.example/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://app.example' }, body: 'x=1',
  }));
  assert.equal(res.headers.get('location'), '/login?error=AccessDenied');
});

test('the error redirect joins a query the error page already has', async () => {
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => null })],
    pages: { error: '/login?tab=password' },
  });
  const res = await auth.handlers.POST(new Request('https://app.example/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://app.example' }, body: 'x=1',
  }));
  assert.equal(res.headers.get('location'), '/login?tab=password&error=CredentialsSignin');
});
