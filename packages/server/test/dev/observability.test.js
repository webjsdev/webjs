/**
 * Integration tests for issue #239: per-request access log, correlation /
 * request id (X-Request-Id propagation + requestId() getter), the onError APM
 * hook, and the /__webjs/version build-info probe. Exercised through
 * createRequestHandler against a minimal app fixture, using Web-standard
 * Request/Response so no real HTTP server is needed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(
  resolve(__dirname, '../../../core/src/html.js')
).toString();
const SERVER_INDEX_URL = pathToFileURL(
  resolve(__dirname, '../../index.js')
).toString();
const CORE_INDEX_URL = pathToFileURL(
  resolve(__dirname, '../../../core/index.js')
).toString();

let tmpRoot;

before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-obs-'));
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

/** A capturing logger so a test can assert on the structured access log line. */
function capturingLogger() {
  const infos = [];
  const errors = [];
  return {
    infos,
    errors,
    logger: {
      info: (msg, meta) => infos.push({ msg, meta }),
      warn: () => {},
      error: (msg, meta) => errors.push({ msg, meta }),
    },
  };
}

const PAGE = `import { html } from ${JSON.stringify(HTML_URL)};\n` +
  `export default function P() { return html\`<h1>home</h1>\`; }\n`;

/* ------------ access log ------------ */

test('access log: one structured info line per request with method/path/status/duration/requestId', async () => {
  const { infos, logger } = capturingLogger();
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true, logger });
  await app.handle(new Request('http://x/'));

  const access = infos.filter((l) => l.msg === 'request');
  assert.equal(access.length, 1, 'exactly one access log line for one request');
  const m = access[0].meta;
  assert.equal(m.method, 'GET');
  assert.equal(m.path, '/');
  assert.equal(m.status, 200);
  assert.equal(typeof m.durationMs, 'number');
  assert.ok(m.durationMs >= 0);
  assert.match(m.requestId, /\S/, 'access log carries a non-empty request id');
});

test('access log: the framework /__webjs/* probes are not access-logged (no spam)', async () => {
  const { infos, logger } = capturingLogger();
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true, logger });
  await app.handle(new Request('http://x/__webjs/health'));
  await app.handle(new Request('http://x/__webjs/version'));
  const access = infos.filter((l) => l.msg === 'request');
  assert.equal(access.length, 0, 'probes are suppressed from the access log');
});

/* ------------ request id / X-Request-Id ------------ */

test('request id: minted, set on X-Request-Id, and included in the access log', async () => {
  const { infos, logger } = capturingLogger();
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true, logger });
  const resp = await app.handle(new Request('http://x/'));
  const header = resp.headers.get('x-request-id');
  assert.match(header, /^[0-9a-f-]{36}$/, 'minted a UUID and put it on the response header');
  const access = infos.find((l) => l.msg === 'request');
  assert.equal(access.meta.requestId, header, 'the access log id matches the response header');
});

test('request id: an inbound X-Request-Id is honored (trace propagation)', async () => {
  const { infos, logger } = capturingLogger();
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true, logger });
  const resp = await app.handle(new Request('http://x/', {
    headers: { 'x-request-id': 'trace-abc-123' },
  }));
  assert.equal(resp.headers.get('x-request-id'), 'trace-abc-123', 'upstream id is echoed back');
  const access = infos.find((l) => l.msg === 'request');
  assert.equal(access.meta.requestId, 'trace-abc-123', 'the access log carries the upstream id');
});

test('request id: a junk inbound X-Request-Id is rejected and a fresh id minted', async () => {
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  // A value outside the conservative token charset (spaces, a quote) and an
  // over-long value are both rejected, so a hostile id is never echoed back.
  for (const bad of ['has spaces and "quotes"', 'x'.repeat(500)]) {
    const resp = await app.handle(new Request('http://x/', {
      headers: { 'x-request-id': bad },
    }));
    const header = resp.headers.get('x-request-id');
    assert.match(header, /^[0-9a-f-]{36}$/, `fell back to a minted UUID for invalid inbound id ${JSON.stringify(bad.slice(0, 20))}`);
  }
});

test('requestId(): returns the active id inside the request scope', async () => {
  const appDir = makeApp({
    'app/page.js': PAGE,
    // A route handler reads requestId() and echoes it, proving the getter
    // resolves the same id the response header carries.
    'app/api/whoami/route.js':
      `import { requestId } from ${JSON.stringify(SERVER_INDEX_URL)};\n` +
      `export async function GET() { return Response.json({ id: requestId() }); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/api/whoami', {
    headers: { 'x-request-id': 'trace-xyz' },
  }));
  assert.equal(resp.status, 200);
  assert.equal((await resp.json()).id, 'trace-xyz', 'requestId() returns the in-scope id');
  assert.equal(resp.headers.get('x-request-id'), 'trace-xyz');
});

/* ------------ onError hook ------------ */

test('onError: fires on a 500 with the error + requestId', async () => {
  const captured = [];
  const onError = (error, ctx) => captured.push({ error, ctx });
  const appDir = makeApp({
    'app/page.js': PAGE,
    'app/api/boom/route.js':
      `export async function GET() { throw new Error('kaboom'); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true, onError });
  const resp = await app.handle(new Request('http://x/api/boom', {
    headers: { 'x-request-id': 'err-trace-1' },
  }));
  assert.equal(resp.status, 500);
  assert.equal(captured.length, 1, 'onError fired exactly once on the 500');
  assert.ok(captured[0].error instanceof Error);
  assert.equal(captured[0].error.message, 'kaboom', 'the original error is passed, not a sanitized one');
  assert.equal(captured[0].ctx.requestId, 'err-trace-1', 'the correlation id is passed so the sink can tie the report to the request');
  assert.ok(captured[0].ctx.request instanceof Request);
});

test('onError: counterfactual (a 500 with NO hook wired still 500s cleanly, calling nothing)', async () => {
  // Proves the hook fires BECAUSE it is wired: the same throwing route with no
  // onError still 500s cleanly (no crash), and obviously calls nothing.
  const appDir = makeApp({
    'app/page.js': PAGE,
    'app/api/boom/route.js':
      `export async function GET() { throw new Error('kaboom'); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true }); // no onError
  const resp = await app.handle(new Request('http://x/api/boom'));
  assert.equal(resp.status, 500, 'still a clean 500 without a hook');
});

test('onError: a throwing onError does not crash the response (best-effort)', async () => {
  const onError = () => { throw new Error('sink exploded'); };
  const appDir = makeApp({
    'app/page.js': PAGE,
    'app/api/boom/route.js':
      `export async function GET() { throw new Error('kaboom'); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true, onError });
  const resp = await app.handle(new Request('http://x/api/boom'));
  assert.equal(resp.status, 500, 'a throwing sink is swallowed; the sanitized 500 still returns');
});

test('onError: fires when a server action throws unexpectedly', async () => {
  const captured = [];
  const onError = (error, ctx) => captured.push({ error, ctx });
  const appDir = makeApp({
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import { boom } from '../modules/x/actions.server.js';\n` +
      `export default function P() { return html\`<p>\${boom}</p>\`; }\n`,
    'modules/x/actions.server.js':
      `'use server';\n` +
      `export async function boom() { throw new Error('action-died'); }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true, onError });
  // Discover the action hash + a CSRF token via the page + stub.
  const stub = await (await app.handle(new Request('http://x/modules/x/actions.server.js'))).text();
  const hash = /\/__webjs\/action\/([a-f0-9]+)\//.exec(stub)[1];
  const pageResp = await app.handle(new Request('http://x/'));
  const token = decodeURIComponent(/webjs_csrf=([^;]+)/.exec(pageResp.headers.get('set-cookie') || '')[1]);
  const resp = await app.handle(new Request(`http://x/__webjs/action/${hash}/boom`, {
    method: 'POST',
    headers: {
      'content-type': 'application/vnd.webjs+json',
      'x-webjs-csrf': token,
      cookie: `webjs_csrf=${encodeURIComponent(token)}`,
    },
    body: JSON.stringify([]),
  }));
  assert.equal(resp.status, 500);
  assert.ok(captured.some((c) => c.error instanceof Error && c.error.message === 'action-died'),
    'onError received the original thrown action error');
  assert.ok(captured.some((c) => c.ctx.phase === 'action'), 'the action phase is labeled');
});

test('onError: fires when an expose()d REST handler throws (with the error + requestId)', async () => {
  // Consistency with the RPC action path: an exposed first-class REST endpoint
  // that throws must reach the same APM sink, else an app silently misses
  // errors from its REST surface while catching the RPC ones.
  const captured = [];
  const onError = (error, ctx) => captured.push({ error, ctx });
  const appDir = makeApp({
    'app/page.js': PAGE,
    'api.server.js':
      `'use server';\n` +
      `import { expose } from ${JSON.stringify(CORE_INDEX_URL)};\n` +
      `export const boom = expose('GET /api/boom', async () => { throw new Error('rest-died'); });\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true, onError });
  const resp = await app.handle(new Request('http://x/api/boom', {
    headers: { 'x-request-id': 'rest-trace-9' },
  }));
  assert.equal(resp.status, 500);
  assert.ok(captured.some((c) => c.error instanceof Error && c.error.message === 'rest-died'),
    'onError received the original thrown REST error');
  const hit = captured.find((c) => c.ctx.phase === 'action');
  assert.ok(hit, 'the action phase is labeled');
  assert.equal(hit.ctx.requestId, 'rest-trace-9', 'the correlation id is passed so the sink can tie the report to the request');
  assert.ok(hit.ctx.request instanceof Request);
});

/* ------------ /__webjs/version ------------ */

test('version probe: /__webjs/version returns version + build + node + uptime JSON', async () => {
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/__webjs/version'));
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('cache-control'), 'no-store');
  const body = await resp.json();
  assert.match(body.version, /^\d+\.\d+\.\d+/, 'framework semver version');
  assert.equal(body.node, process.version, 'running node version');
  assert.equal(typeof body.uptime, 'number');
  assert.ok(body.uptime >= 0);
  assert.equal(typeof body.build, 'string', 'published build id (may be empty before vendor resolve)');
});

test('version probe: answered before ensureReady (cold instance)', async () => {
  const appDir = makeApp({ 'app/page.js': PAGE });
  const app = await createRequestHandler({ appDir, dev: true }); // no warmup
  const resp = await app.handle(new Request('http://x/__webjs/version'));
  assert.equal(resp.status, 200);
  // Serving the probe must not have warmed the analysis.
  const ready = await app.handle(new Request('http://x/__webjs/ready'));
  assert.equal(ready.status, 503, 'the version probe did not trigger ensureReady');
});
