/**
 * Auth.js conformance: `AUTH_URL` and `basePath` (#1686). From the local clone
 * at `frameworks/next-auth`: `packages/next-auth/src/lib/env.ts` reads
 * `AUTH_URL ?? NEXTAUTH_URL` and sets `basePath ||= pathname` unless the path
 * is `/` (default `/api/auth`), and swaps the request origin for the env URL's
 * (`reqWithEnvURL`); the OAuth callback URL is that origin plus `basePath`
 * (`core/src/lib/utils/providers.ts:28,37-38`). Behind a proxy, AUTH_URL is
 * how the provider gets a callback URL on the public origin.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, GitHub } from '../../../packages/server/index.js';

const SECRET = 'authjs-auth-url-secret-0123456789ab';
const saved = { AUTH_URL: process.env.AUTH_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const github = () => GitHub({ clientId: 'id', clientSecret: 'secret' });
const signInRedirect = async (a, path, base = 'http://internal:3000') => {
  const res = await a.handlers.POST(new Request(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin', origin: base },
    body: '',
  }));
  return new URL(res.headers.get('location')).searchParams.get('redirect_uri');
};

test('without AUTH_URL the callback is on the request origin under /api/auth', async () => {
  delete process.env.AUTH_URL; delete process.env.NEXTAUTH_URL;
  const a = createAuth({ secret: SECRET, providers: [github()] });
  assert.equal(await signInRedirect(a, '/api/auth/signin/github'), 'http://internal:3000/api/auth/callback/github');
});

test('AUTH_URL sets the callback origin, and its path is the base path', async () => {
  process.env.AUTH_URL = 'https://app.example.com/auth';
  const a = createAuth({ secret: SECRET, providers: [github()] });
  assert.equal(await signInRedirect(a, '/auth/signin/github'), 'https://app.example.com/auth/callback/github');
});

test('NEXTAUTH_URL is read too, and an explicit basePath wins over the URL path', async () => {
  delete process.env.AUTH_URL;
  process.env.NEXTAUTH_URL = 'https://public.example.com/ignored';
  const a = createAuth({ secret: SECRET, basePath: '/api/login', providers: [github()] });
  assert.equal(await signInRedirect(a, '/api/login/signin/github'), 'https://public.example.com/api/login/callback/github');
});
