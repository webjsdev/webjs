/**
 * Streamed Suspense boundary error isolation (#478).
 *
 * The page-level streaming path (`ssr.js` `streamingHtmlResponse`) renders each
 * pending boundary and, when one REJECTS or throws, emits an error placeholder
 * in its slot. That message must follow the same policy as the rest of SSR
 * (`render-server.js` `defaultSSRErrorTemplate`): dev surfaces the message so
 * the failure is obvious, prod stays SILENT so no internal detail (a DB error,
 * a stack-derived path) leaks to the client.
 *
 * Driven through the real `createRequestHandler` pipeline against a fixture
 * page whose top-level `Suspense` boundary rejects with a recognizable secret.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString();
const SUSPENSE_URL = pathToFileURL(resolve(__dirname, '../../../core/src/suspense.js')).toString();

const SECRET = 'SECRET-DB-ERROR-7f3a9';

// A page whose only content is a Suspense boundary that rejects after a tick.
// The deferred rejection (vs an eager `Promise.reject`) keeps it from being an
// unhandled rejection before the streaming loop awaits it. The streaming loop
// awaits `p.promise`, the rejection throws into its catch, and the boundary's
// slot gets the dev/prod-gated error placeholder.
const REJECTING_PAGE =
  `import { html } from ${JSON.stringify(HTML_URL)};\n` +
  `import { Suspense } from ${JSON.stringify(SUSPENSE_URL)};\n` +
  `export default function P() {\n` +
  `  const slow = new Promise((_, reject) => setTimeout(() => reject(new Error('${SECRET}')), 5));\n` +
  `  return html\`<main><h1>page</h1>\${Suspense({ fallback: html\`<p>loading</p>\`, children: slow })}</main>\`;\n` +
  `}\n`;

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-stream-err-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

test('PROD: a rejected streamed boundary does NOT leak the error message', async () => {
  const appDir = makeApp({ 'app/page.js': REJECTING_PAGE });
  const app = await createRequestHandler({ appDir, dev: false });
  const res = await app.handle(new Request('http://x/'));
  assert.equal(res.status, 200, 'the page still streams a 200 (the boundary is isolated)');
  const body = await res.text();
  assert.ok(body.includes('page'), 'the non-suspended content rendered');
  assert.ok(body.includes('loading'), 'the boundary fallback was flushed');
  assert.ok(
    !body.includes(SECRET),
    `prod must NOT leak the boundary error message; body contained it:\n${body}`,
  );
});

test('DEV: a rejected streamed boundary surfaces the error message', async () => {
  const appDir = makeApp({ 'app/page.js': REJECTING_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  const res = await app.handle(new Request('http://x/'));
  assert.equal(res.status, 200, 'the page still streams a 200');
  const body = await res.text();
  assert.ok(
    body.includes(SECRET),
    `dev must surface the boundary error message for debugging; body:\n${body}`,
  );
});
