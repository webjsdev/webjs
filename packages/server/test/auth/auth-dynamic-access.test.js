/**
 * Unit test for the #241 auth-path leak fix: reading the auth session via
 * `auth()` (which reaches `readSession()` in auth.js) must mark the request
 * dynamic, so the server HTML cache excludes a page that wrongly set
 * `revalidate` while branching its body on the logged-in user.
 *
 * This mirrors the getSession() / cookies() / headers() dynamicAccess fixes:
 * a per-user read through a framework helper auto-excludes the page from the
 * HTML cache, the core data-leak defense.
 *
 * COUNTERFACTUAL: a request scope where `auth()` is NOT called leaves
 * `dynamicAccessed()` false (so a genuinely static page stays cacheable),
 * which is exactly the assertion that fails if `markDynamicAccess()` were
 * called unconditionally instead of from `readSession`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials } from '../../src/auth.js';
import { withRequest, dynamicAccessed } from '../../src/context.js';

const SECRET = 'test-secret-at-least-32-chars-long!!';

function makeAuth() {
  return createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => null })],
  });
}

test('auth() marks the request dynamic (no cookie present)', async () => {
  const { auth } = makeAuth();
  const req = new Request('http://localhost/');
  await withRequest(req, async () => {
    assert.equal(dynamicAccessed(), false, 'not dynamic before the auth read');
    const session = await auth();
    assert.equal(session, null, 'no cookie yields a null session');
    assert.equal(dynamicAccessed(), true, 'auth() marked the request dynamic even with no cookie');
  });
});

test('auth() marks the request dynamic (cookie present)', async () => {
  const { auth } = makeAuth();
  // A request carrying a (malformed) auth cookie still reaches readSession's
  // cookie read, so it is per-user input and must mark dynamic.
  const req = new Request('http://localhost/', {
    headers: { cookie: 'webjs.auth=not-a-valid-jwt' },
  });
  await withRequest(req, async () => {
    await auth();
    assert.equal(dynamicAccessed(), true, 'auth() with a cookie present marked the request dynamic');
  });
});

test('a request that never calls auth() stays non-dynamic', async () => {
  const req = new Request('http://localhost/');
  await withRequest(req, async () => {
    assert.equal(dynamicAccessed(), false, 'a static request scope is never marked dynamic (counterfactual)');
  });
});
