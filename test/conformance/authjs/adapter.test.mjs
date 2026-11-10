/**
 * Auth.js conformance: database adapters (#1686). From the local clone at
 * `frameworks/next-auth`: an adapter makes "database" the default strategy
 * (`core/src/lib/init.ts:116-121`); an OAuth sign-in finds the user by its
 * linked account, or creates the user and links the account, and refuses an
 * email another user already has with `OAuthAccountNotLinked` unless the
 * provider allows dangerous email linking (`callback/handle-login.ts`); the
 * session cookie is the raw session token, looked up with
 * `getSessionAndUser`, deleted when expired and extended past `updateAge`
 * (`actions/session.ts`); sign-out deletes the session (`signout.ts`).
 * The adapter here is an in-memory one with Auth.js's method shapes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, GitHub, Credentials } from '../../../packages/server/index.js';

const SECRET = 'authjs-adapter-secret-0123456789abcd';
const cookieOf = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');

function memoryAdapter() {
  const users = new Map(); const accounts = new Map(); const sessions = new Map();
  const calls = [];
  const log = (name, fn) => async (...args) => { calls.push(name); return fn(...args); };
  return {
    users, accounts, sessions, calls,
    createUser: log('createUser', (u) => { users.set(u.id, { ...u }); return users.get(u.id); }),
    getUser: log('getUser', (id) => users.get(id) ?? null),
    getUserByEmail: log('getUserByEmail', (email) => [...users.values()].find((u) => u.email === email) ?? null),
    getUserByAccount: log('getUserByAccount', ({ provider, providerAccountId }) => {
      const a = accounts.get(`${provider}:${providerAccountId}`);
      return a ? users.get(a.userId) ?? null : null;
    }),
    updateUser: log('updateUser', (u) => { users.set(u.id, { ...users.get(u.id), ...u }); return users.get(u.id); }),
    linkAccount: log('linkAccount', (a) => { accounts.set(`${a.provider}:${a.providerAccountId}`, a); return a; }),
    createSession: log('createSession', (s) => { sessions.set(s.sessionToken, { ...s }); return s; }),
    getSessionAndUser: log('getSessionAndUser', (t) => {
      const s = sessions.get(t);
      return s ? { session: s, user: users.get(s.userId) } : null;
    }),
    updateSession: log('updateSession', (s) => { sessions.set(s.sessionToken, { ...sessions.get(s.sessionToken), ...s }); return sessions.get(s.sessionToken); }),
    deleteSession: log('deleteSession', (t) => { sessions.delete(t); }),
  };
}

async function githubSignIn(a, profile, cookie = '') {
  const start = await a.handlers.GET(new Request('http://localhost/api/auth/signin/github', { headers: cookie ? { cookie } : {} }));
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('access_token')) return Response.json({ access_token: 'gho_x', token_type: 'bearer' });
    if (u.endsWith('/user')) return Response.json(profile);
    return new Response('[]');
  };
  try {
    const both = [cookieOf(start), cookie].filter(Boolean).join('; ');
    return await a.handlers.GET(new Request(`http://localhost/api/auth/callback/github?code=c&state=${state}`, { headers: { cookie: both } }));
  } finally {
    globalThis.fetch = origFetch;
  }
}

test('an adapter makes the session a database row; first sign-in creates and links the user', async () => {
  const adapter = memoryAdapter();
  const a = createAuth({ secret: SECRET, adapter, providers: [GitHub({ clientId: 'id', clientSecret: 's' })] });
  const res = await githubSignIn(a, { id: 42, login: 'octo', name: 'Octo', email: 'Octo@Example.com', avatar_url: 'x' });
  assert.equal(res.status, 302);
  assert.equal(adapter.users.size, 1, 'a user was created');
  const [user] = adapter.users.values();
  assert.equal(user.email, 'octo@example.com', 'the email is lower-cased');
  assert.equal(user.emailVerified, null);
  assert.ok(adapter.accounts.has('github:42'), 'the account is linked');
  assert.equal(adapter.accounts.get('github:42').userId, user.id);
  assert.equal(adapter.sessions.size, 1, 'a session row was created');
  const [token] = adapter.sessions.keys();
  assert.match(cookieOf(res), new RegExp(`webjs\\.auth=${token}`), 'the cookie is the raw session token');
  const session = await a.auth(new Request('http://localhost/', { headers: { cookie: cookieOf(res) } }));
  assert.equal(session.user.id, user.id);
  assert.equal(session.user.email, 'octo@example.com');
});

test('a second sign-in finds the user by its account; sign-out deletes the session', async () => {
  const adapter = memoryAdapter();
  const a = createAuth({ secret: SECRET, adapter, providers: [GitHub({ clientId: 'id', clientSecret: 's' })] });
  await githubSignIn(a, { id: 7, login: 'u', email: 'u@example.com' });
  const again = await githubSignIn(a, { id: 7, login: 'u', email: 'u@example.com' });
  assert.equal(adapter.users.size, 1, 'no second user');
  const cookie = cookieOf(again);
  const out = await a.signOut({ req: new Request('http://localhost/', { headers: { cookie } }) });
  assert.equal(out.status, 302);
  assert.equal(await a.auth(new Request('http://localhost/', { headers: { cookie } })), null, 'the session row is gone');
});

test('an email another user has is refused with OAuthAccountNotLinked, unless linking is allowed', async () => {
  const adapter = memoryAdapter();
  adapter.users.set('existing', { id: 'existing', email: 'same@example.com' });
  const strict = createAuth({ secret: SECRET, adapter, pages: { error: '/login' }, providers: [GitHub({ clientId: 'id', clientSecret: 's' })] });
  const refused = await githubSignIn(strict, { id: 9, login: 'x', email: 'same@example.com' });
  assert.equal(refused.headers.get('location'), '/login?error=OAuthAccountNotLinked');
  assert.equal(adapter.sessions.size, 0);
  const lax = createAuth({ secret: SECRET, adapter, providers: [{ ...GitHub({ clientId: 'id', clientSecret: 's' }), allowDangerousEmailAccountLinking: true }] });
  const linked = await githubSignIn(lax, { id: 9, login: 'x', email: 'same@example.com' });
  assert.equal(linked.status, 302);
  assert.equal(adapter.accounts.get('github:9').userId, 'existing', 'linked to the existing user');
});

test('an expired session is deleted; one past updateAge is extended', async () => {
  const adapter = memoryAdapter();
  adapter.users.set('u', { id: 'u', email: 'u@example.com' });
  const a = createAuth({ secret: SECRET, adapter, session: { maxAge: 3600, updateAge: 60 }, providers: [GitHub({ clientId: 'id', clientSecret: 's' })] });
  adapter.sessions.set('old', { sessionToken: 'old', userId: 'u', expires: new Date(Date.now() - 1000) });
  assert.equal(await a.auth(new Request('http://localhost/', { headers: { cookie: 'webjs.auth=old' } })), null);
  assert.equal(adapter.sessions.has('old'), false, 'deleted');
  const nearlyFresh = Date.now() + 3600_000 - 120_000;
  adapter.sessions.set('live', { sessionToken: 'live', userId: 'u', expires: new Date(nearlyFresh) });
  const s = await a.auth(new Request('http://localhost/', { headers: { cookie: 'webjs.auth=live' } }));
  assert.equal(s.user.id, 'u');
  assert.ok(new Date(adapter.sessions.get('live').expires).getTime() > nearlyFresh + 60_000, 'extended');
});

test('credentials under the database strategy get a revocable database session', async () => {
  const adapter = memoryAdapter();
  adapter.users.set('c1', { id: 'c1', email: 'c@example.com' });
  const a = createAuth({ secret: SECRET, adapter, providers: [Credentials({ authorize: async () => ({ id: 'c1', email: 'c@example.com' }) })] });
  const res = await a.signIn('credentials', {});
  assert.equal(adapter.sessions.size, 1);
  const cookie = cookieOf(res);
  assert.equal((await a.auth(new Request('http://localhost/', { headers: { cookie } })))?.user.id, 'c1');
  await a.signOut({ req: new Request('http://localhost/', { headers: { cookie } }) });
  assert.equal(await a.auth(new Request('http://localhost/', { headers: { cookie } })), null, 'revoked');
});
