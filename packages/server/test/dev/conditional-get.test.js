/**
 * Integration tests for issue #240: conditional GET (RFC 7232) across pages,
 * static assets, and app source modules. Exercised through createRequestHandler
 * against minimal app fixtures using Web-standard Request/Response, plus direct
 * unit tests of the helper's matcher.
 *
 * The headline behaviours:
 *   - a cacheable page (metadata.cacheControl public) gets an ETag, and a
 *     repeat request with a matching If-None-Match gets a 304 with no body;
 *   - a no-store page gets NO ETag and never 304s (no cross-session 304 on
 *     private content);
 *   - a static asset / app module gets an ETag and 304s on a match;
 *   - a non-matching If-None-Match returns 200 + the full body;
 *   - the ETag is stable for identical content across requests.
 *
 * COUNTERFACTUAL (documented inline): the matcher test asserts that a
 * mismatched If-None-Match does NOT 304, which is exactly the assertion that
 * fails if the If-None-Match check is removed from applyConditionalGet.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { applyConditionalGet, ifNoneMatchSatisfied } from '../../src/conditional-get.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(
  resolve(__dirname, '../../../core/src/html.js')
).toString();

let tmpRoot;

before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-cond-'));
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

const CACHEABLE_PAGE =
  `import { html } from ${JSON.stringify(HTML_URL)};\n` +
  `export const metadata = { cacheControl: 'public, max-age=60' };\n` +
  `export default function P() { return html\`<h1>cacheable</h1>\`; }\n`;

const DYNAMIC_PAGE =
  `import { html } from ${JSON.stringify(HTML_URL)};\n` +
  `export default function P() { return html\`<h1>dynamic</h1>\`; }\n`;

/* ---------------- cacheable page: ETag + 304 ---------------- */

test('cacheable page gets an ETag and 304s on a matching If-None-Match', async () => {
  const appDir = makeApp({ 'app/page.js': CACHEABLE_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await app.handle(new Request('http://x/'));
  assert.equal(first.status, 200);
  const etag = first.headers.get('etag');
  assert.ok(etag, 'cacheable page response carries an ETag');
  assert.match(etag, /^"[a-f0-9]{16}"$/, 'ETag is the quoted 16-char SHA-1 form');
  const body = await first.text();
  assert.ok(body.includes('cacheable'), 'first response carries the full body');

  const second = await app.handle(
    new Request('http://x/', { headers: { 'if-none-match': etag } })
  );
  assert.equal(second.status, 304, 'matching If-None-Match yields 304');
  assert.equal(second.headers.get('etag'), etag, '304 keeps the ETag validator');
  assert.equal(
    second.headers.get('cache-control'),
    'public, max-age=60',
    '304 keeps Cache-Control'
  );
  const emptyBody = await second.text();
  assert.equal(emptyBody, '', '304 has no body');
  assert.equal(second.headers.get('content-length'), null, '304 drops Content-Length');
});

test('cacheable page ETag is stable for identical content across requests', async () => {
  const appDir = makeApp({ 'app/page.js': CACHEABLE_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  const a = await app.handle(new Request('http://x/'));
  const b = await app.handle(new Request('http://x/'));
  assert.equal(
    a.headers.get('etag'),
    b.headers.get('etag'),
    'identical body yields identical ETag across requests'
  );
});

test('cacheable page: a NON-matching If-None-Match returns 200 + full body', async () => {
  const appDir = makeApp({ 'app/page.js': CACHEABLE_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  const res = await app.handle(
    new Request('http://x/', { headers: { 'if-none-match': '"deadbeefdeadbeef"' } })
  );
  assert.equal(res.status, 200, 'a stale validator is not a 304');
  const body = await res.text();
  assert.ok(body.includes('cacheable'), 'full body is served on a mismatch');
});

/* ---------------- no-store page: no ETag, no 304 ---------------- */

test('a no-store (dynamic / per-user) page gets NO ETag and never 304s', async () => {
  const appDir = makeApp({ 'app/page.js': DYNAMIC_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await app.handle(new Request('http://x/'));
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.equal(first.headers.get('etag'), null, 'no-store response has no ETag');

  // Even if a client replays the page's prior body hash, a no-store page must
  // not 304 (no cross-session 304 on private content).
  const replay = await app.handle(
    new Request('http://x/', { headers: { 'if-none-match': '*' } })
  );
  assert.equal(replay.status, 200, 'no-store page never 304s, even on If-None-Match: *');
});

/* ---------------- static asset (public/) ---------------- */

test('a static asset gets an ETag and 304s on a matching If-None-Match', async () => {
  const appDir = makeApp({
    'app/page.js': DYNAMIC_PAGE,
    'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  });
  const app = await createRequestHandler({ appDir, dev: true });

  const first = await app.handle(new Request('http://x/public/logo.svg'));
  assert.equal(first.status, 200);
  const etag = first.headers.get('etag');
  assert.ok(etag, 'static asset carries an ETag');

  const second = await app.handle(
    new Request('http://x/public/logo.svg', { headers: { 'if-none-match': etag } })
  );
  assert.equal(second.status, 304, 'static asset 304s on a matching validator');
  assert.equal((await second.text()), '', '304 asset has no body');

  const mismatch = await app.handle(
    new Request('http://x/public/logo.svg', { headers: { 'if-none-match': '"0000000000000000"' } })
  );
  assert.equal(mismatch.status, 200, 'a non-matching validator returns the full asset');
});

/* ---------------- app source module (.js) ---------------- */

test('an app source module gets an ETag and 304s on a matching If-None-Match', async () => {
  // An interactive component (a @click) ships, so its module is browser-bound
  // and servable. The page imports it so the graph gate admits it.
  const COMPONENT =
    `import { WebComponent, html } from '@webjsdev/core';\n` +
    `class Widget extends WebComponent { render(){ return html\`<button @click=\${() => {}}>x</button>\`; } }\n` +
    `Widget.register('my-widget');\n`;
  const PAGE_WITH_COMPONENT =
    `import { html } from '@webjsdev/core';\n` +
    `import '../components/widget.ts';\n` +
    `export default () => html\`<my-widget></my-widget>\`;\n`;
  const appDir = makeApp({
    'app/page.ts': PAGE_WITH_COMPONENT,
    'components/widget.ts': COMPONENT,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  // Warm the browser-bound graph so the module is servable.
  await app.handle(new Request('http://x/app/page.ts'));

  const first = await app.handle(new Request('http://x/components/widget.ts'));
  assert.equal(first.status, 200, 'app module is served');
  const etag = first.headers.get('etag');
  assert.ok(etag, 'app module carries an ETag');
  const body = await first.text();
  assert.ok(body.length > 0, 'first request transfers the full module body');

  const second = await app.handle(
    new Request('http://x/components/widget.ts', { headers: { 'if-none-match': etag } })
  );
  assert.equal(second.status, 304, 'app module 304s on a matching validator');
  assert.equal((await second.text()), '', '304 module has no body');
});

/* ---------------- HEAD method ---------------- */

test('HEAD on a cacheable page also 304s on a matching validator', async () => {
  const appDir = makeApp({ 'app/page.js': CACHEABLE_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  const get = await app.handle(new Request('http://x/'));
  const etag = get.headers.get('etag');
  const head = await app.handle(
    new Request('http://x/', { method: 'HEAD', headers: { 'if-none-match': etag } })
  );
  assert.equal(head.status, 304, 'HEAD honors conditional GET');
});

/* ---------------- streaming (Suspense) page is NOT conditional-GET cached ---------------- */

test('a streamed Suspense page is not ETagged and never 304s (marker stripped)', async () => {
  // A loading.js sibling wraps the async page in Suspense, so a page that
  // awaits produces a genuinely streamed body. Even with a public
  // cacheControl, the stream cannot be hashed without buffering, so the
  // funnel skips it and strips the internal x-webjs-stream marker.
  const ASYNC_PAGE =
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export const metadata = { cacheControl: 'public, max-age=60' };\n` +
    `export default async function P() {\n` +
    `  await new Promise((r) => setTimeout(r, 5));\n` +
    `  return html\`<h1>streamed</h1>\`;\n` +
    `}\n`;
  const LOADING =
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export default () => html\`<p>loading</p>\`;\n`;
  const appDir = makeApp({ 'app/page.js': ASYNC_PAGE, 'app/loading.js': LOADING });
  const app = await createRequestHandler({ appDir, dev: true });

  const res = await app.handle(new Request('http://x/'));
  assert.equal(res.status, 200, 'streamed page is served');
  assert.equal(res.headers.get('etag'), null, 'a streamed body is not ETagged');
  assert.equal(res.headers.get('x-webjs-stream'), null, 'internal stream marker never leaks to the client');
  const body = await res.text();
  assert.ok(body.includes('streamed'), 'the streamed content is delivered');
});

/* ---------------- helper unit tests (matcher + counterfactual) ---------------- */

test('ifNoneMatchSatisfied matches exact, list, wildcard, and weak validators', () => {
  assert.equal(ifNoneMatchSatisfied('"abc"', '"abc"'), true, 'exact match');
  assert.equal(ifNoneMatchSatisfied('"x", "abc", "y"', '"abc"'), true, 'list member match');
  assert.equal(ifNoneMatchSatisfied('*', '"abc"'), true, 'wildcard matches any');
  assert.equal(ifNoneMatchSatisfied('W/"abc"', '"abc"'), true, 'weak validator compares equal');
  // COUNTERFACTUAL: a non-matching validator must NOT satisfy. This is the
  // assertion that fails if the If-None-Match check is dropped (everything
  // would then 304 indiscriminately).
  assert.equal(ifNoneMatchSatisfied('"nope"', '"abc"'), false, 'mismatch does not match');
  assert.equal(ifNoneMatchSatisfied(null, '"abc"'), false, 'absent header does not match');
});

test('applyConditionalGet skips a streaming-flagged response untouched (marker stripped)', async () => {
  const streamed = new Response('partial', {
    status: 200,
    headers: { 'cache-control': 'public, max-age=60', 'x-webjs-stream': '1' },
  });
  const out = await applyConditionalGet(new Request('http://x/'), streamed);
  assert.equal(out.status, 200, 'streamed response is not turned into a 304');
  assert.equal(out.headers.get('etag'), null, 'streamed response is not ETagged');
  assert.equal(out.headers.get('x-webjs-stream'), null, 'internal stream marker is stripped');
});

test('applyConditionalGet leaves a no-store response alone', async () => {
  const res = new Response('secret', {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  });
  const out = await applyConditionalGet(
    new Request('http://x/', { headers: { 'if-none-match': '*' } }),
    res
  );
  assert.equal(out.status, 200, 'no-store is never 304');
  assert.equal(out.headers.get('etag'), null, 'no-store is never ETagged');
});
