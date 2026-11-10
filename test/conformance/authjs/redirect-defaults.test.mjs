/**
 * Auth.js conformance: where sign-in and sign-out land (#1686). From the local
 * clone at `frameworks/next-auth`, `packages/next-auth/src/lib/actions.ts`:
 *   signIn:  `const callbackUrl = redirectTo?.toString() ?? headers.get("Referer") ?? "/"` (line 25)
 *   signOut: `options?.redirectTo ?? headers.get("Referer") ?? "/"` (line 105)
 * and the default `redirect` callback (`core/src/lib/init.ts:33-37`) keeps a
 * same-origin target only. The HTTP routes take the submitted `callbackUrl`,
 * which WebJs also reads as `redirectTo`. `pages.signOut` is the sign-out page,
 * not where a sign-out lands.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials } from '../../../packages/server/index.js';
import { withRequest } from '../../../packages/server/src/context.js';

const SECRET = 'authjs-redirect-defaults-secret-0123';
const auth = () => createAuth({
  secret: SECRET,
  pages: { signOut: '/goodbye-page' },
  providers: [Credentials({ authorize: async () => ({ id: '1', email: 'a@example.com' }) })],
});
const inPage = (referer, fn) => withRequest(new Request('http://localhost/action', { method: 'POST', headers: referer ? { referer } : {} }), fn);

test('signIn() with no redirectTo returns to the Referer', async () => {
  const a = auth();
  const to = await inPage('http://localhost/posts/7?tab=comments', () => a.signIn('credentials', { email: 'a@example.com' }, { redirect: false }));
  assert.equal(to, '/posts/7?tab=comments');
});

test('an explicit redirectTo wins, and a cross-origin Referer falls back to "/"', async () => {
  const a = auth();
  assert.equal(await inPage('http://localhost/posts/7', () => a.signIn('credentials', { email: 'a@example.com' }, { redirect: false, redirectTo: '/dashboard' })), '/dashboard');
  assert.equal(await inPage('https://evil.example/phish', () => a.signIn('credentials', { email: 'a@example.com' }, { redirect: false })), '/');
  assert.equal(await inPage(null, () => a.signIn('credentials', { email: 'a@example.com' }, { redirect: false })), '/');
});

test('signOut() with no redirectTo returns to the Referer, not pages.signOut', async () => {
  const a = auth();
  assert.equal(await inPage('http://localhost/settings', () => a.signOut({ redirect: false })), '/settings');
  assert.equal(await inPage(null, () => a.signOut({ redirect: false })), '/');
});

test('the HTTP routes take a submitted callbackUrl', async () => {
  const a = auth();
  const form = (fields) => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin', origin: 'http://localhost' },
    body: new URLSearchParams(fields).toString(),
  });
  const signin = await a.handlers.POST(new Request('http://localhost/api/auth/signin/credentials', form({ email: 'a@example.com', callbackUrl: '/welcome' })));
  assert.equal(signin.headers.get('location'), '/welcome');
  const signout = await a.handlers.POST(new Request('http://localhost/api/auth/signout', form({ callbackUrl: '/bye' })));
  assert.equal(signout.headers.get('location'), '/bye');
  const plain = await a.handlers.POST(new Request('http://localhost/api/auth/signout', form({})));
  assert.equal(plain.headers.get('location'), '/', 'pages.signOut is the sign-out page, not the landing');
});
