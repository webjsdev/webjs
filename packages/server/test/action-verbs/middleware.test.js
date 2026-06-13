/**
 * Per-action middleware (#490): the chain runs around the action, accumulates
 * typed context the action reads via actionContext(), and short-circuits.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runActionChain, actionContext } from '../../src/action-middleware.js';
import { createRequestHandler } from '../../src/dev.js';
import { hashFile } from '../../src/actions.js';
import { stringify, parse } from '@webjsdev/core';

// --- unit ---
test('empty chain runs the action directly', async () => {
  assert.equal(await runActionChain([], {}, () => 'result'), 'result');
});

test('middleware runs in onion order around the action', async () => {
  const order = [];
  const a = async (ctx, next) => { order.push('a-in'); const r = await next(); order.push('a-out'); return r; };
  const b = async (ctx, next) => { order.push('b-in'); const r = await next(); order.push('b-out'); return r; };
  const r = await runActionChain([a, b], {}, () => { order.push('fn'); return 'x'; });
  assert.equal(r, 'x');
  assert.deepEqual(order, ['a-in', 'b-in', 'fn', 'b-out', 'a-out']);
});

test('a middleware short-circuits by not calling next', async () => {
  let ran = false;
  const r = await runActionChain([async () => ({ success: false, status: 401 })], {}, () => { ran = true; return 'x'; });
  assert.deepEqual(r, { success: false, status: 401 });
  assert.equal(ran, false);
});

test('middleware accumulates context the action reads via actionContext()', async () => {
  const setUser = async (ctx, next) => { ctx.context.user = { id: 7 }; return next(); };
  assert.deepEqual(await runActionChain([setUser], {}, () => actionContext().user), { id: 7 });
});

test('actionContext is empty outside a chain', () => {
  assert.deepEqual(actionContext(), {});
});

test('calling next() twice rejects', async () => {
  await assert.rejects(runActionChain([async (ctx, next) => { await next(); return next(); }], {}, () => 'x'), /next\(\) called multiple times/);
});

// --- integration ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const MW_URL = pathToFileURL(resolve(__dirname, '../../src/action-middleware.js')).toString();
const CORE_URL = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot, appDir, handle, hash;
const hashes = {};
before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-mw-'));
  appDir = mkdtempSync(join(tmpRoot, 'app-'));
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'mw', type: 'module', webjs: {} }));
  const w = (rel, b) => { const abs = join(appDir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, b); return abs; };
  const f = w('actions/secret.server.js',
    `'use server';\n` +
    `import { actionContext } from ${JSON.stringify(MW_URL)};\n` +
    `const auth = async (ctx, next) => {\n` +
    `  if (ctx.args[0] !== 'good-token') return { success: false, error: 'unauthorized', status: 401 };\n` +
    `  ctx.context.user = { id: 1 };\n` +
    `  return next();\n` +
    `};\n` +
    `export const middleware = [auth];\n` +
    `export async function getSecret(token) { return { user: actionContext().user, secret: 42 }; }\n`);
  // An expose()d REST action with middleware (the REST boundary runs it too).
  w('actions/rest-guard.server.js',
    `'use server';\n` +
    `import { expose } from ${JSON.stringify(CORE_URL)};\n` +
    `const block = async (ctx, next) => ({ success: false, status: 403 });\n` +
    `export const middleware = [block];\n` +
    `export const restGuard = expose('GET /api/guard', async () => ({ ok: true }));\n`);
  // A GET action whose middleware short-circuits (the denial must NOT be cached).
  const gf = w('actions/get-gated.server.js',
    `'use server';\n` +
    `export const method = 'GET';\n` +
    `export const cache = 60;\n` +
    `const deny = async () => ({ success: false, status: 401 });\n` +
    `export const middleware = [deny];\n` +
    `export async function getGated() { return { ok: true }; }\n`);
  // A mutation whose middleware short-circuits (must NOT invalidate).
  const mf = w('actions/mut-gated.server.js',
    `'use server';\n` +
    `export const invalidates = () => ['gated'];\n` +
    `const deny = async () => ({ success: false, status: 403 });\n` +
    `export const middleware = [deny];\n` +
    `export async function mutGated() { return { ok: true }; }\n`);
  // A GET with a PASSTHROUGH middleware (calls next): the action runs, so the
  // result is STILL cached (ranAction true via the closure, not the fast path).
  const gpf = w('actions/get-pass.server.js',
    `'use server';\n` +
    `export const method = 'GET';\n` +
    `export const cache = 60;\n` +
    `export const tags = () => ['gp'];\n` +
    `const pass = async (ctx, next) => next();\n` +
    `export const middleware = [pass];\n` +
    `export async function getPass() { return { ok: true }; }\n`);
  // A mutation with a PASSTHROUGH middleware: the action runs, so it invalidates.
  const mpf = w('actions/mut-pass.server.js',
    `'use server';\n` +
    `export const invalidates = () => ['mp'];\n` +
    `const pass = async (ctx, next) => next();\n` +
    `export const middleware = [pass];\n` +
    `export async function mutPass() { return { ok: true }; }\n`);
  w('app/layout.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ({children})=>html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  w('app/page.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ()=>html\`<main>ok</main>\`;\n`);
  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  handle = app.handle;
  hash = await hashFile(f);
  hashes.getGated = await hashFile(gf);
  hashes.mutGated = await hashFile(mf);
  hashes.getPass = await hashFile(gpf);
  hashes.mutPass = await hashFile(mpf);
});
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

async function csrfHeaders() {
  const res = await handle(new Request('http://localhost/'));
  const m = (res.headers.get('set-cookie') || '').match(/webjs_csrf=([^;]+)/);
  const t = m ? decodeURIComponent(m[1]) : '';
  return { 'content-type': 'application/vnd.webjs+json', 'x-webjs-csrf': t, cookie: `webjs_csrf=${t}` };
}

test('middleware runs on the RPC path: short-circuit + context', async () => {
  const headers = await csrfHeaders();
  // Bad token -> the auth middleware short-circuits with a 401 envelope.
  const denied = await handle(new Request(`http://localhost/__webjs/action/${hash}/getSecret`, { method: 'POST', body: await stringify(['nope']), headers }));
  assert.deepEqual(parse(await denied.text()), { success: false, error: 'unauthorized', status: 401 });
  // Good token -> the action runs and reads the context the middleware set.
  const ok = await handle(new Request(`http://localhost/__webjs/action/${hash}/getSecret`, { method: 'POST', body: await stringify(['good-token']), headers }));
  assert.deepEqual(parse(await ok.text()), { user: { id: 1 }, secret: 42 });
});

test('middleware runs on the expose() REST path, mapping the envelope status to HTTP', async () => {
  const res = await handle(new Request('http://localhost/api/guard'));
  assert.equal(res.status, 403, 'the short-circuit status maps to the HTTP status, not 200');
  assert.deepEqual(await res.json(), { success: false });
});

test('a GET action short-circuit is NOT cached (no-store, not max-age)', async () => {
  const res = await handle(new Request(`http://localhost/__webjs/action/${hashes.getGated}/getGated?a=${encodeURIComponent(await stringify([]))}`));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store', 'a denial must not be cached');
  assert.equal(res.headers.get('etag'), null, 'no ETag on a short-circuit');
  assert.deepEqual(parse(await res.text()), { success: false, status: 401 });
});

test('a mutation short-circuit does NOT invalidate (the action never ran)', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(`http://localhost/__webjs/action/${hashes.mutGated}/mutGated`, { method: 'POST', body: await stringify([]), headers }));
  assert.equal(res.headers.get('x-webjs-invalidate'), null, 'a denied mutation does not evict tags');
  assert.deepEqual(parse(await res.text()), { success: false, status: 403 });
});

test('a PASSTHROUGH middleware (calls next) still caches a GET result (ranAction true)', async () => {
  const res = await handle(new Request(`http://localhost/__webjs/action/${hashes.getPass}/getPass?a=${encodeURIComponent(await stringify([]))}`));
  assert.match(res.headers.get('cache-control') || '', /private, max-age=60/, 'the action ran -> cached');
  assert.ok(res.headers.get('etag'), 'ETag on a completed cached GET');
  assert.equal(res.headers.get('x-webjs-tags'), 'gp');
  assert.deepEqual(parse(await res.text()), { ok: true });
});

test('a PASSTHROUGH middleware still invalidates a completed mutation', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(`http://localhost/__webjs/action/${hashes.mutPass}/mutPass`, { method: 'POST', body: await stringify([]), headers }));
  assert.equal(res.headers.get('x-webjs-invalidate'), 'mp', 'the action ran -> invalidates');
  assert.deepEqual(parse(await res.text()), { ok: true });
});
