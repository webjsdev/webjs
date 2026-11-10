/**
 * Auth.js v5 conformance: what the callbacks receive (#1686). From the local
 * clone at `frameworks/next-auth`, `docs/pages/guides/refresh-token-rotation.mdx`:
 *
 *   async jwt({ token, account }) {
 *     if (account) {
 *       // First-time login, save the `access_token`, its expiry and the `refresh_token`
 *
 * An app written that way stored nothing in WebJs, because the jwt callback
 * got only `{ token, user }`. It now gets the account (for OAuth, the
 * provider's token response), the profile and `trigger: 'signIn'`; authorize
 * gets the request as its second argument; and the session carries `expires`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials, GitHub } from '../../../packages/server/index.js';

const SECRET = 'authjs-callbacks-secret-0123456789';
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(/,(?=\s*\w[\w.-]*=)/).map((c) => c.split(';')[0].trim()).join('; ');

test('credentials: jwt gets account and trigger at sign-in, authorize gets the request, the session has expires', async () => {
  const seen = { jwt: [], authorizeReq: null };
  const a = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async (creds, request) => { seen.authorizeReq = request; return { id: '7', email: String(creds.email) }; } })],
    callbacks: {
      jwt: ({ token, user, account, trigger }) => {
        seen.jwt.push({ user: !!user, account, trigger });
        if (account) token.provider = account.provider;
        return token;
      },
    },
  });
  const req = new Request('http://localhost/api/auth/signin/credentials', { method: 'POST' });
  const res = await a.signIn('credentials', { email: 'a@example.com' }, { req });
  assert.equal(seen.authorizeReq, req, 'authorize(credentials, request)');
  assert.deepEqual(seen.jwt[0], { user: true, account: { provider: 'credentials', type: 'credentials', providerAccountId: '7' }, trigger: 'signIn' });
  const session = await a.auth(new Request('http://localhost/', { headers: { cookie: cookieOf(res) } }));
  assert.equal(session.user.provider, 'credentials', 'what jwt stored at sign-in reaches the session');
  assert.equal(seen.jwt[1].account, undefined, 'a later read is not a sign-in');
  assert.ok(!Number.isNaN(Date.parse(session.expires)) && Date.parse(session.expires) > Date.now(), 'session.expires is a future ISO date');
});

test('OAuth: jwt gets the provider token response as account, and the profile', async () => {
  const seen = [];
  const a = createAuth({
    secret: SECRET,
    providers: [GitHub({ clientId: 'id', clientSecret: 'secret' })],
    callbacks: {
      jwt: ({ token, account, profile }) => {
        if (account) { seen.push({ account, profile }); token.accessToken = account.access_token; }
        return token;
      },
    },
  });
  const start = await a.handlers.GET(new Request('http://localhost/api/auth/signin/github'));
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('access_token')) return Response.json({ access_token: 'gho_abc', token_type: 'bearer', scope: 'read:user', refresh_token: 'ghr_def', expires_at: 1900000000 });
    if (u.endsWith('/user')) return Response.json({ id: 42, login: 'octo', email: 'o@example.com', avatar_url: 'x' });
    return new Response('[]', { status: 200 });
  };
  try {
    const res = await a.handlers.GET(new Request(`http://localhost/api/auth/callback/github?code=c&state=${state}`, { headers: { cookie: cookieOf(start) } }));
    assert.equal(res.status, 302, await res.clone().text());
    assert.equal(seen.length, 1);
    assert.equal(seen[0].account.access_token, 'gho_abc');
    assert.equal(seen[0].account.refresh_token, 'ghr_def');
    assert.equal(seen[0].account.provider, 'github');
    assert.equal(seen[0].account.providerAccountId, '42');
    assert.equal(seen[0].profile.login, 'octo', 'the raw profile');
    const session = await a.auth(new Request('http://localhost/', { headers: { cookie: cookieOf(res) } }));
    assert.equal(session.user.accessToken, 'gho_abc', 'the token the jwt callback kept');
  } finally {
    globalThis.fetch = origFetch;
  }
});
