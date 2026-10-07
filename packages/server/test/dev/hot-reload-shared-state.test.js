/**
 * After a `bun --hot` dev reload the app's modules come from a fresh module
 * registry while the first run's server keeps serving (#1575), so an app
 * module that imports `@webjsdev/server` gets a SECOND copy of the package.
 * Before #1590 every copy had its own AsyncLocalStorage, so a request bound by
 * the server's copy was invisible to the app's copy: `auth()`, `cookies()` and
 * `headers()` inside a page or a `'use server'` query saw no request, and a
 * signed-in page listed nothing.
 *
 * A second copy is made here the same way the reload makes it: the same
 * module file under a URL the loader has not seen. Each test binds state with
 * one copy and reads it with the other.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const fresh = (rel) => import(new URL(`../../src/${rel}?copy=${Math.random()}`, import.meta.url).href);

test('a request bound by one copy is the request another copy reads (#1590)', async () => {
  const server = await import('../../src/context.js');
  const app = await fresh('context.js');
  // Node gives a query-suffixed file URL its own instance, which is the split
  // under test. Bun's loader ignores the query and hands back the same one, so
  // there the precondition (and the split) does not arise in this harness.
  if (!process.versions.bun) assert.notEqual(app.getRequest, server.getRequest, 'precondition: two module instances');
  const req = new Request('http://x/studio', { headers: { cookie: 'webjs.session=abc' } });
  await server.withRequest(req, async () => {
    await Promise.resolve();
    assert.equal(app.getRequest(), req, 'getRequest() from the fresh copy sees the request');
    assert.equal(app.cookies().get('webjs.session'), 'abc', 'cookies() too');
    assert.equal(app.headers().get('cookie'), 'webjs.session=abc', 'headers() too');
  });
});

test('auth() from a fresh copy reads the session the server is handling (#1590)', async () => {
  const { withRequest } = await import('../../src/context.js');
  const serverAuth = await import('../../src/auth.js');
  // The end-to-end shape of the report: a JWT cookie written by signIn reads
  // back through auth() while a fresh copy of the context is loaded mid-request.
  const { auth, signIn } = serverAuth.createAuth({
    secret: '0123456789abcdef0123456789abcdef',
    providers: [serverAuth.Credentials({ authorize: async (c) => (c.email ? { id: '1', email: c.email } : null) })],
  });
  const res = await signIn('credentials', { email: 'ada@x.io' });
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const req = new Request('http://x/studio', { headers: { cookie } });
  const seen = await withRequest(req, async () => {
    const app = await fresh('context.js');
    assert.equal(app.getRequest(), req);
    return auth();
  });
  assert.equal(seen?.user?.email, 'ada@x.io');
});

test('the action signal, cache store and html-cache generation are shared too (#1590)', async () => {
  const cacheA = await import('../../src/cache.js');
  const cacheB = await fresh('cache.js');
  assert.equal(cacheB.getStore(), cacheA.getStore(), 'one default cache store per process');

  const htmlA = await import('../../src/html-cache.js');
  const htmlB = await fresh('html-cache.js');
  const before = htmlA.htmlCacheGeneration();
  htmlB.revalidateAll();
  assert.equal(htmlA.htmlCacheGeneration(), before + 1, "a fresh copy's revalidateAll reaches the server's keys");

  const seedA = await import('../../src/action-seed.js');
  const seedB = await fresh('action-seed.js');
  assert.equal(seedB.seedingEnabled(), seedA.seedingEnabled());
  assert.equal(seedB.identityHookInstalled(), seedA.identityHookInstalled());
});
