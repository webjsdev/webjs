/**
 * Integration tests for issue #241: the server HTML response cache (ISR for
 * no-build). Exercised through createRequestHandler against minimal app
 * fixtures using Web-standard Request/Response, plus direct unit tests of the
 * html-cache helpers.
 *
 * Headline behaviours:
 *   - a page WITH `export const revalidate = N` is rendered once, then a
 *     second request within the window serves the CACHED HTML without
 *     re-running the page function (proven by a per-render counter baked into
 *     the HTML), and the cached body equals the fresh render.
 *   - a page WITHOUT `revalidate` is NEVER cached (re-renders each time).
 *   - revalidatePath(path) evicts so the next request re-renders.
 *   - a page that sets a per-user cookie (the cookies()/session contract,
 *     never set revalidate on such a page, and even if it did, a non-framework
 *     Set-Cookie blocks caching) is never cached.
 *   - a CSP-enabled page is not HTML-cached (its body varies per request).
 *
 * COUNTERFACTUAL: removing the cache LOOKUP (the readHtmlCache short-circuit in
 * ssrPage) makes "the page fn is not called twice" fail, because every request
 * would re-run the page and bump the counter. That is exactly the assertion in
 * the first test.
 *
 * The per-render counter survives across requests via globalThis (dev mode
 * cache-busts the module import per request, so a module-scope variable would
 * reset; globalThis does not). It is incremented INSIDE the page function, so
 * it counts page-function invocations, not module loads.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { setStore, memoryStore } from '../../src/cache.js';
import {
  readRevalidate,
  htmlCacheKey,
  isCacheableResponse,
  revalidatePath,
  revalidateAll,
} from '../../src/html-cache.js';
import { STREAM_MARKER } from '../../src/conditional-get.js';
import { setVendorEntries, publishBuildId, publishedBuildId } from '../../src/importmap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(
  resolve(__dirname, '../../../core/src/html.js')
).toString();
// File URL of the server context module, so a page fixture can import the
// real `cookies()` helper (which marks the request dynamic, the #241 defense).
const CONTEXT_URL = pathToFileURL(
  resolve(__dirname, '../../src/context.js')
).toString();
// File URL of the auth module, so a page fixture can call the real `auth()`
// (whose readSession path marks the request dynamic, the #241 auth-path fix).
const AUTH_URL = pathToFileURL(
  resolve(__dirname, '../../src/auth.js')
).toString();

let tmpRoot;

before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-htmlcache-'));
});
after(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

// A page that increments a globalThis counter on every page-function call and
// bakes the current count into the HTML, so a cache HIT (page fn NOT re-run)
// is observable as a stale count in the body. `counterKey` namespaces each
// test's counter so they do not interfere.
function counterPage(counterKey, { revalidate } = {}) {
  return (
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    (revalidate != null ? `export const revalidate = ${revalidate};\n` : '') +
    `export default function P() {\n` +
    `  const k = ${JSON.stringify(counterKey)};\n` +
    `  globalThis.__renders = globalThis.__renders || {};\n` +
    `  globalThis.__renders[k] = (globalThis.__renders[k] || 0) + 1;\n` +
    `  return html\`<h1>render #\${globalThis.__renders[k]}</h1>\`;\n` +
    `}\n`
  );
}

// A page that reads cookies() (the real framework helper, which marks the
// request dynamic) during render AND declares `revalidate`. This is the wrong
// combination the #241 dynamicAccess defense must catch: the page varies per
// user but opted into caching, so the framework must refuse to cache it.
function cookieReadingPage(counterKey, { revalidate } = {}) {
  return (
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `import { cookies } from ${JSON.stringify(CONTEXT_URL)};\n` +
    (revalidate != null ? `export const revalidate = ${revalidate};\n` : '') +
    `export default function P() {\n` +
    `  const k = ${JSON.stringify(counterKey)};\n` +
    `  globalThis.__renders = globalThis.__renders || {};\n` +
    `  globalThis.__renders[k] = (globalThis.__renders[k] || 0) + 1;\n` +
    `  const who = cookies().get('uid') || 'anon';\n` +
    `  return html\`<h1>render #\${globalThis.__renders[k]} for \${who}</h1>\`;\n` +
    `}\n`
  );
}

// A page that calls auth() (the real createAuth current-user accessor, the
// primary per-user read in the saas scaffold) during render AND declares
// `revalidate`. The auth read reaches readSession() (auth.js), which marks the
// request dynamic, so the framework must refuse to cache the page even though
// it sets no new Set-Cookie. This is the residual auth-path leak the #241 fix
// closes. The page branches its body on the logged-in user.
function authReadingPage(counterKey, { revalidate } = {}) {
  return (
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `import { createAuth, Credentials } from ${JSON.stringify(AUTH_URL)};\n` +
    `const { auth } = createAuth({\n` +
    `  secret: 'test-secret-test-secret',\n` +
    `  providers: [Credentials({ authorize: async () => null })],\n` +
    `});\n` +
    (revalidate != null ? `export const revalidate = ${revalidate};\n` : '') +
    `export default async function P() {\n` +
    `  const k = ${JSON.stringify(counterKey)};\n` +
    `  globalThis.__renders = globalThis.__renders || {};\n` +
    `  globalThis.__renders[k] = (globalThis.__renders[k] || 0) + 1;\n` +
    `  const session = await auth();\n` +
    `  const who = session?.user?.name || 'guest';\n` +
    `  return html\`<h1>render #\${globalThis.__renders[k]} for \${who}</h1>\`;\n` +
    `}\n`
  );
}

// Reset the shared default store between tests so cache state does not leak.
function freshStore() {
  setStore(memoryStore());
}

/* ---------------- opt-in: revalidate caches the HTML ---------------- */

test('a page WITH revalidate serves cached HTML without re-running the page fn', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('opt-in', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await app.handle(new Request('http://x/'));
  assert.equal(first.status, 200);
  const firstBody = await first.text();
  assert.ok(firstBody.includes('render #1'), 'first request renders the page');

  const second = await app.handle(new Request('http://x/'));
  assert.equal(second.status, 200);
  const secondBody = await second.text();
  // The page fn was NOT called again, so the counter is still 1 (a fresh
  // render would show "render #2"). This is the headline + counterfactual.
  assert.ok(secondBody.includes('render #1'), 'second request serves the cached render (#1, not #2)');
  assert.equal(secondBody, firstBody, 'cached body is byte-identical to the fresh render');
  // The internal cache marker must never leak to the client on either path.
  assert.equal(first.headers.get('x-webjs-html-cache'), null, 'marker stripped on the warming response');
  assert.equal(second.headers.get('x-webjs-html-cache'), null, 'cache hit carries no internal marker');
});

/* ---------------- no opt-in: never cached ---------------- */

test('a page WITHOUT revalidate is never cached (re-renders each time)', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('no-opt-in') });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(first.includes('render #1'), 'first render');
  const second = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(second.includes('render #2'), 'second request re-runs the page (no caching without revalidate)');
});

/* ---------------- on-demand revalidation ---------------- */

test('revalidatePath evicts the cached HTML so the next request re-renders', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('evict', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  await app.handle(new Request('http://x/')); // render #1, cached
  const cached = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(cached.includes('render #1'), 'served from cache (#1)');

  await revalidatePath('/');

  const afterEvict = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(afterEvict.includes('render #2'), 'after revalidatePath the page re-renders (#2)');
});

test('revalidateAll evicts every cached HTML entry', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('evict-all', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  await app.handle(new Request('http://x/'));
  assert.ok((await (await app.handle(new Request('http://x/'))).text()).includes('render #1'), 'cached #1');

  revalidateAll();

  assert.ok(
    (await (await app.handle(new Request('http://x/'))).text()).includes('render #2'),
    'after revalidateAll the page re-renders (#2)'
  );
});

/* ---------------- search params key the cache separately ---------------- */

test('different searchParams are cached under separate keys', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('sp', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  const a1 = await (await app.handle(new Request('http://x/?page=1'))).text();
  const b1 = await (await app.handle(new Request('http://x/?page=2'))).text();
  // Each URL renders once (counter increments per distinct key).
  assert.ok(a1.includes('render #1'), '?page=1 renders #1');
  assert.ok(b1.includes('render #2'), '?page=2 renders #2 (different key, fresh render)');
  // Re-requesting ?page=1 serves its own cached entry (#1), not #2.
  const a2 = await (await app.handle(new Request('http://x/?page=1'))).text();
  assert.ok(a2.includes('render #1'), '?page=1 still served from its own cache (#1)');
});

/* ---------------- per-user cookie page is never cached ---------------- */

test('a page that sets a non-framework Set-Cookie is never HTML-cached', async () => {
  freshStore();
  // A middleware that stamps a per-user session cookie on the response. Even
  // with revalidate set (which the author should NOT do), the non-framework
  // Set-Cookie blocks caching, so the page re-renders every request.
  const middleware =
    `export default async function (req, next) {\n` +
    `  const res = await next();\n` +
    `  res.headers.append('set-cookie', 'sid=abc; Path=/');\n` +
    `  return res;\n` +
    `};\n`;
  const appDir = makeApp({
    'app/page.js': counterPage('cookie', { revalidate: 60 }),
    'middleware.js': middleware,
  });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(first.includes('render #1'), 'first render');
  const second = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(second.includes('render #2'), 'a per-user Set-Cookie response is never cached (re-renders #2)');
});

/* ---------------- CSP-enabled page is never cached ---------------- */

test('a CSP-enabled page is not HTML-cached (body varies per request)', async () => {
  freshStore();
  const appDir = makeApp({
    'app/page.js': counterPage('csp', { revalidate: 60 }),
    'package.json': JSON.stringify({ name: 'csp-app', webjs: { csp: true } }),
  });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(first.includes('render #1'), 'first render');
  const second = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(second.includes('render #2'), 'CSP page re-renders each request (never cached)');
});

/* ---------------- CSRF cookie is re-minted on a cache hit ---------------- */

test('a cache hit still issues the CSRF cookie to a new visitor', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('csrf', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  // Warm the cache with a first request (no cookie -> gets one).
  const warm = await app.handle(new Request('http://x/'));
  assert.ok(warm.headers.get('set-cookie'), 'first visitor is issued the CSRF cookie');

  // A SECOND, distinct new visitor (no cookie) hits the cache but must still
  // be minted a fresh CSRF cookie: it is a response header, never part of the
  // cached body.
  const hit = await app.handle(new Request('http://x/'));
  const body = await hit.text();
  assert.ok(body.includes('render #1'), 'served from cache (#1)');
  assert.ok(hit.headers.get('set-cookie')?.includes('webjs_csrf'), 'cache hit re-mints the CSRF cookie for a new visitor');
});

/* ---------------- X-Webjs-Have partial nav is never cached ---------------- */

test('a partial-nav (X-Webjs-Have) request bypasses the HTML cache', async () => {
  freshStore();
  const appDir = makeApp({ 'app/page.js': counterPage('have', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  // A partial-nav request carries a have-marker; its bytes depend on the
  // header, so it must neither read nor write the full-URL cache.
  const partial = await (await app.handle(
    new Request('http://x/', { headers: { 'x-webjs-have': '/' } })
  )).text();
  assert.ok(partial.includes('render #1'), 'partial render runs the page');
  // A subsequent FULL GET is a fresh render (the partial did not populate the
  // cache), so the counter advances.
  const full = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(full.includes('render #2'), 'full GET after a partial is a fresh render (partial did not cache)');
});

/* ---------------- direct unit tests of the helpers ---------------- */

test('readRevalidate reads a positive numeric export, rejects 0/negative/non-number', () => {
  assert.equal(readRevalidate({ revalidate: 60 }), 60);
  assert.equal(readRevalidate({ revalidate: 0 }), null, '0 means always-dynamic (no cache)');
  assert.equal(readRevalidate({ revalidate: -5 }), null);
  assert.equal(readRevalidate({ revalidate: Infinity }), null);
  assert.equal(readRevalidate({ revalidate: 'x' }), null);
  assert.equal(readRevalidate({}), null, 'no opt-in => no caching');
  assert.equal(readRevalidate(null), null);
});

test('htmlCacheKey normalizes query order and namespaces the key', () => {
  const a = htmlCacheKey(new URL('http://x/p?b=2&a=1'));
  const b = htmlCacheKey(new URL('http://x/p?a=1&b=2'));
  assert.equal(a, b, 'query order does not change the key');
  assert.ok(a.startsWith('webjs:html:'), 'namespaced');
  assert.notEqual(
    htmlCacheKey(new URL('http://x/p')),
    htmlCacheKey(new URL('http://x/p?a=1')),
    'a query variant is a distinct key'
  );
});

test('isCacheableResponse gates on status, streaming, CSP, and non-framework cookies', () => {
  const ok = new Response('<h1>x</h1>', { status: 200, headers: { 'content-type': 'text/html' } });
  assert.equal(isCacheableResponse(ok), true, 'a plain 200 html response is cacheable');

  assert.equal(
    isCacheableResponse(new Response('x', { status: 500 })),
    false,
    'non-200 is not cacheable'
  );

  const streamed = new Response('x', { status: 200, headers: { [STREAM_MARKER]: '1' } });
  assert.equal(isCacheableResponse(streamed), false, 'a streamed Suspense body is not cacheable');

  assert.equal(isCacheableResponse(ok, { cspEnabled: true }), false, 'CSP-on response is not cacheable');

  const csrfOnly = new Response('x', { status: 200 });
  csrfOnly.headers.append('set-cookie', 'webjs_csrf=abc; Path=/');
  assert.equal(isCacheableResponse(csrfOnly), true, 'the framework CSRF cookie alone does not block caching');

  const sessionCookie = new Response('x', { status: 200 });
  sessionCookie.headers.append('set-cookie', 'sid=xyz; Path=/');
  assert.equal(isCacheableResponse(sessionCookie), false, 'a non-framework Set-Cookie blocks caching');
});

/* ---------------- dynamicAccess defense: cookie-reading page (#241) ---------------- */

test('a page that reads cookies() AND sets revalidate is NOT cached (dynamicAccess defense)', async () => {
  freshStore();
  // This page reads cookies() during render (per-user output) but wrongly
  // declared `revalidate` and sets NO new Set-Cookie, so the Set-Cookie guard
  // alone would not catch it. The framework's dynamicAccess flag must, so the
  // page re-renders every request (never cached) and a logged-out visitor can
  // never be served a logged-in body.
  const appDir = makeApp({ 'app/page.js': cookieReadingPage('dyn', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  try {
    // A logged-in visitor (uid cookie) warms first. If this were cached, the
    // NEXT (logged-out) visitor would see "for alice".
    const first = await (await app.handle(
      new Request('http://x/', { headers: { cookie: 'uid=alice' } })
    )).text();
    assert.ok(first.includes('render #1 for alice'), 'first render reads the cookie');

    // A second, logged-OUT visitor: a fresh render (#2 for anon), proving the
    // logged-in body was never cached and never leaked.
    const second = await (await app.handle(new Request('http://x/'))).text();
    assert.ok(second.includes('render #2 for anon'), 'logged-out visitor gets a fresh render, not the cached logged-in body');
    assert.ok(!second.includes('alice'), 'the logged-in body never leaks to a logged-out visitor');
  } finally {
    console.warn = origWarn;
  }

  // The author is warned once, naming the offending path.
  assert.ok(
    warnings.some((w) => w.includes('/') && w.includes('revalidate') && w.toLowerCase().includes('per-user')),
    'a one-time warning names the per-user revalidate page'
  );
});

test('a page that calls auth() AND sets revalidate is NOT cached (auth-path dynamicAccess defense)', async () => {
  freshStore();
  // The page calls auth() during render (the saas-dashboard pattern). auth()
  // reaches readSession(), which now marks the request dynamic, so the page
  // must never be cached even though it sets no new Set-Cookie. Without the
  // fix the logged-in body would be cached and served to the next visitor.
  const appDir = makeApp({ 'app/page.js': authReadingPage('auth', { revalidate: 60 }) });
  const app = await createRequestHandler({ appDir, dev: true });

  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const first = await (await app.handle(new Request('http://x/'))).text();
    assert.ok(first.includes('render #1'), 'first render calls auth()');
    // A second request re-renders (#2), proving the auth-reading page was never
    // cached. If readSession did not mark dynamic, this would serve cached #1.
    const second = await (await app.handle(new Request('http://x/'))).text();
    assert.ok(second.includes('render #2'), 'an auth()-reading page re-renders each request (never cached)');
  } finally {
    console.warn = origWarn;
  }
});

/* ---------------- build-id key folding: a deploy invalidates (#241) ---------------- */

test('the cache key changes when the published build id changes (a deploy invalidates)', () => {
  const url = new URL('http://x/blog');
  const before = htmlCacheKey(url);
  assert.ok(before.includes(publishedBuildId() || 'nobuild'), 'the key embeds the published build id');

  // Simulate a deploy: a new importmap hash promoted to the published build id.
  return (async () => {
    try {
      await setVendorEntries({ 'deploy-marker-pkg': 'https://cdn.example/deploy-marker.js' });
      publishBuildId();
      const after = htmlCacheKey(url);
      assert.notEqual(after, before, 'a new published build id yields a different cache key');
      assert.ok(after.includes(publishedBuildId()), 'the new key embeds the new build id');
    } finally {
      // Restore the empty vendor map so other tests are unaffected.
      await setVendorEntries({});
      publishBuildId();
    }
  })();
});

/* ---------------- getSetCookie-absent fallback fails safe (#241) ---------------- */

test('isCacheableResponse fails safe when getSetCookie is unavailable', () => {
  // Simulate an older runtime lacking Headers.prototype.getSetCookie: a
  // combined "webjs_csrf=..., sid=..." must be judged non-cacheable rather
  // than parsing only the first cookie and wrongly passing.
  const res = new Response('x', { status: 200 });
  res.headers.set('set-cookie', 'webjs_csrf=abc, sid=xyz');
  const orig = res.headers.getSetCookie;
  // Remove the method on this instance to exercise the fallback branch.
  res.headers.getSetCookie = undefined;
  try {
    assert.equal(
      isCacheableResponse(res),
      false,
      'a response with a Set-Cookie is non-cacheable when getSetCookie is unavailable (fail safe)'
    );
  } finally {
    res.headers.getSetCookie = orig;
  }

  // And a response with NO Set-Cookie is still cacheable under the fallback.
  const clean = new Response('x', { status: 200, headers: { 'content-type': 'text/html' } });
  clean.headers.getSetCookie = undefined;
  assert.equal(isCacheableResponse(clean), true, 'no Set-Cookie stays cacheable under the fallback');
});
