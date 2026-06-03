/**
 * Integration tests for request body limits + server timeouts (issue #237):
 *   - the action RPC endpoint returns 413 for an over-limit body, driven through
 *     `createRequestHandler` (the real handle pipeline);
 *   - the `route.{js,ts}` `readBody` path returns 413 via `handleApi`, exercised
 *     with the per-request limit stamped in the request context;
 *   - a real ephemeral `startServer` carries the configured node:http timeouts.
 *
 * tmpdir app fixtures, like dev-handler.test.js. Route fixtures that need the
 * `html` tag import it from core's source by absolute file URL (a random tmpdir
 * can't resolve the `@webjsdev/*` bare specifiers).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler, startServer } from '../../src/dev.js';
import { handleApi } from '../../src/api.js';
import { readBody } from '../../src/json.js';
import { withRequest, setBodyLimits } from '../../src/context.js';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_HEADERS_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
} from '../../src/body-limit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString();
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-bodylimit-')); });
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

/** Build a chunked (no Content-Length) request body of `n` bytes. */
function chunkedBody(n, chunkSize = 1024) {
  let emitted = 0;
  return new ReadableStream({
    pull(controller) {
      if (emitted >= n) { controller.close(); return; }
      const size = Math.min(chunkSize, n - emitted);
      emitted += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
}

/* --------------- server-action RPC endpoint (full pipeline) --------------- */

test('action RPC endpoint: over-limit body is 413, under-limit runs', async () => {
  const appDir = makeApp({
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import { echo } from '../modules/m/act.server.js';\n` +
      `export default function P() { return html\`<p>\${echo}</p>\`; }\n`,
    'modules/m/act.server.js':
      `'use server';\n` +
      `export async function echo(x) { return { got: x }; }\n`,
    'package.json': JSON.stringify({ webjs: { maxBodyBytes: 50 } }),
  });
  const app = await createRequestHandler({ appDir, dev: true });

  const stub = await (await app.handle(new Request('http://x/modules/m/act.server.js'))).text();
  const hashMatch = /\/__webjs\/action\/([a-f0-9]+)\//.exec(stub);
  assert.ok(hashMatch, `stub references action URL, got: ${stub.slice(0, 300)}`);
  const hash = hashMatch[1];
  const rpcUrl = `http://x/__webjs/action/${hash}/echo`;

  // Mint a CSRF pair by hitting the page.
  const pageResp = await app.handle(new Request('http://x/'));
  const token = decodeURIComponent(/webjs_csrf=([^;]+)/.exec(pageResp.headers.get('set-cookie') || '')[1]);
  const headers = {
    'content-type': 'application/vnd.webjs+json',
    'x-webjs-csrf': token,
    cookie: `webjs_csrf=${encodeURIComponent(token)}`,
  };

  // Under the limit: 200.
  const ok = await app.handle(new Request(rpcUrl, { method: 'POST', headers, body: JSON.stringify(['hi']) }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { got: 'hi' });

  // Over the limit (Content-Length fast reject): 413.
  const big = await app.handle(new Request(rpcUrl, {
    method: 'POST', headers, body: JSON.stringify(['z'.repeat(500)]),
  }));
  assert.equal(big.status, 413);
});

test('action RPC endpoint: chunked over-limit body without Content-Length is 413', async () => {
  const appDir = makeApp({
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import { sink } from '../modules/m/act.server.js';\n` +
      `export default function P() { return html\`<p>\${sink}</p>\`; }\n`,
    'modules/m/act.server.js':
      `'use server';\n` +
      `export async function sink() { return { ok: true }; }\n`,
    'package.json': JSON.stringify({ webjs: { maxBodyBytes: 2048 } }),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const stub = await (await app.handle(new Request('http://x/modules/m/act.server.js'))).text();
  const hash = /\/__webjs\/action\/([a-f0-9]+)\//.exec(stub)[1];
  const pageResp = await app.handle(new Request('http://x/'));
  const token = decodeURIComponent(/webjs_csrf=([^;]+)/.exec(pageResp.headers.get('set-cookie') || '')[1]);

  const resp = await app.handle(new Request(`http://x/__webjs/action/${hash}/sink`, {
    method: 'POST',
    headers: {
      'content-type': 'application/vnd.webjs+json',
      'x-webjs-csrf': token,
      cookie: `webjs_csrf=${encodeURIComponent(token)}`,
    },
    body: chunkedBody(8192),
    duplex: 'half',
  }));
  assert.equal(resp.status, 413, 'a chunked RPC body past the limit is rejected mid-stream');
});

/* --------------- route handler readBody via handleApi --------------- */

/** Run a handleApi call with a body-limit stamped in the request context. */
function withLimits(limits, req, fn) {
  return withRequest(req, () => { setBodyLimits(limits); return fn(); });
}

test('readBody via handleApi: over-limit JSON body is 413, under-limit succeeds', async () => {
  const dir = makeApp({
    'echo.js': `
      import { readBody } from ${JSON.stringify(pathToFileURL(resolve(__dirname, '../../src/json.js')).toString())};
      export async function POST(req) { const b = await readBody(req); return Response.json({ got: b }); }
    `,
  });
  const route = { file: join(dir, 'echo.js') };

  // Under the limit: 200.
  const small = new Request('http://x/echo', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 1 }),
  });
  const okResp = await withLimits({ json: 100, multipart: 1000 }, small, () => handleApi(route, {}, small, false));
  assert.equal(okResp.status, 200);
  assert.deepEqual(await okResp.json(), { got: { a: 1 } });

  // Over the limit: 413 (mapped from the BodyLimitError handleApi catches).
  const big = new Request('http://x/echo', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blob: 'z'.repeat(500) }),
  });
  const bigResp = await withLimits({ json: 100, multipart: 1000 }, big, () => handleApi(route, {}, big, false));
  assert.equal(bigResp.status, 413);
});

test('readBody: chunked over-limit body without Content-Length throws BodyLimitError', async () => {
  const req = new Request('http://x/', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: chunkedBody(8192), duplex: 'half',
  });
  await withRequest(req, async () => {
    setBodyLimits({ json: 2048, multipart: 4096 });
    await assert.rejects(() => readBody(req), (e) => e && e.webjsBodyLimit === true);
  });
});

/* --------------- COUNTERFACTUAL --------------- */

test('counterfactual: with the cap off (0) the same over-limit body succeeds', async () => {
  const dir = makeApp({
    'echo.js': `
      import { readBody } from ${JSON.stringify(pathToFileURL(resolve(__dirname, '../../src/json.js')).toString())};
      export async function POST(req) { await readBody(req); return Response.json({ ok: true }); }
    `,
  });
  const route = { file: join(dir, 'echo.js') };
  const req = new Request('http://x/echo', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blob: 'z'.repeat(5000) }),
  });
  const resp = await withLimits({ json: 0, multipart: 0 }, req, () => handleApi(route, {}, req, false));
  assert.equal(resp.status, 200, 'with the cap disabled the large body goes through');
});

/* --------------- page-action form path --------------- */

test('page action form: over-limit multipart/urlencoded body is 413, under-limit runs', async () => {
  const appDir = makeApp({
    'app/signup/page.js': `
      import { html } from ${CORE};
      export async function action({ formData }) {
        return { success: true, redirect: '/welcome', data: { email: formData.get('email') } };
      }
      export default function P({ actionData }) { return html\`<form method="POST"></form>\`; }
    `,
    // Form/multipart cap deliberately tiny so a small urlencoded body trips it.
    'package.json': JSON.stringify({ webjs: { maxMultipartBytes: 30 } }),
  });
  const app = await createRequestHandler({ appDir, dev: true });

  // Under the limit: success => 303 PRG.
  const ok = await app.handle(new Request('http://x/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'email=a@b.co',
  }));
  assert.equal(ok.status, 303);

  // Over the limit: 413 before the action runs.
  const big = await app.handle(new Request('http://x/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'email=' + 'z'.repeat(200),
  }));
  assert.equal(big.status, 413);
});

/* --------------- server timeouts on the real node:http server --------------- */

test('startServer applies node:http timeouts (secure defaults)', async () => {
  const appDir = makeApp({ 'app/page.js': `export default () => 'home';` });
  const { server, close } = await startServer({ appDir, port: 0, dev: false });
  try {
    assert.equal(server.requestTimeout, DEFAULT_REQUEST_TIMEOUT_MS);
    assert.equal(server.headersTimeout, DEFAULT_HEADERS_TIMEOUT_MS);
    assert.equal(server.keepAliveTimeout, DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
    assert.ok(server.headersTimeout < server.requestTimeout, 'headersTimeout must be under requestTimeout');
  } finally {
    await close();
  }
});

test('startServer honors webjs.* timeout config', async () => {
  const appDir = makeApp({
    'app/page.js': `export default () => 'home';`,
    'package.json': JSON.stringify({
      webjs: { requestTimeoutMs: 45000, headersTimeoutMs: 12000, keepAliveTimeoutMs: 8000 },
    }),
  });
  const { server, close } = await startServer({ appDir, port: 0, dev: false });
  try {
    assert.equal(server.requestTimeout, 45000);
    assert.equal(server.headersTimeout, 12000);
    assert.equal(server.keepAliveTimeout, 8000);
  } finally {
    await close();
  }
});
