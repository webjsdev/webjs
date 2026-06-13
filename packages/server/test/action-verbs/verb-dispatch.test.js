/**
 * Integration: HTTP-verb action dispatch through createRequestHandler (#488).
 * A GET action is served at GET /__webjs/action/<hash>/<fn>?a=<args> with a
 * Cache-Control + X-Webjs-Tags + ETag; a method mismatch is 405 + Allow; a
 * mutation evicts tags and reports X-Webjs-Invalidate; a GET is CSRF-exempt
 * while a mutation requires CSRF.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { hashFile } from '../../src/actions.js';
import { stringify, parse } from '@webjsdev/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_URL = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot, appDir, handle;
const hashes = {};

function write(rel, body) {
  const abs = join(appDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  return abs;
}
const url = (p) => 'http://localhost' + p;

before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-verbs-'));
  appDir = mkdtempSync(join(tmpRoot, 'app-'));
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'verbs', type: 'module', webjs: {} }));

  const getFile = write('actions/get-user.server.js',
    `'use server';\n` +
    `export const method = 'GET';\n` +
    `export const cache = 60;\n` +
    `export const tags = (id) => ['user:' + id];\n` +
    `export async function getUser(id) { return { id, name: 'u' + id }; }\n`);
  const putFile = write('actions/replace-user.server.js',
    `'use server';\n` +
    `export const method = 'PUT';\n` +
    `export const invalidates = (id) => ['user:' + id];\n` +
    `export async function replaceUser(id, name) { return { id, name }; }\n`);
  const postFile = write('actions/log-event.server.js',
    `'use server';\n` +
    `export async function logEvent(e) { return { ok: true, e }; }\n`); // no method => POST

  write('app/layout.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ({ children }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  write('app/page.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default () => html\`<main>ok</main>\`;\n`);

  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  handle = app.handle;
  hashes.get = await hashFile(getFile);
  hashes.put = await hashFile(putFile);
  hashes.post = await hashFile(postFile);
});

after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

test('a GET action is served at GET with Cache-Control + X-Webjs-Tags + ETag, no CSRF', async () => {
  const key = await stringify([5]);
  const res = await handle(new Request(url(`/__webjs/action/${hashes.get}/getUser?a=${encodeURIComponent(key)}`)));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') || '', /private, max-age=60/);
  assert.equal(res.headers.get('x-webjs-tags'), 'user:5');
  assert.ok(res.headers.get('etag'), 'conditional-GET funnel attached an ETag');
  assert.deepEqual(parse(await res.text()), { id: 5, name: 'u5' });
});

test('a GET action honors If-None-Match with a 304', async () => {
  const key = await stringify([7]);
  const u = url(`/__webjs/action/${hashes.get}/getUser?a=${encodeURIComponent(key)}`);
  const first = await handle(new Request(u));
  const etag = first.headers.get('etag');
  const second = await handle(new Request(u, { headers: { 'if-none-match': etag } }));
  assert.equal(second.status, 304);
});

test('a method mismatch is 405 + Allow (GET to a PUT action)', async () => {
  const res = await handle(new Request(url(`/__webjs/action/${hashes.put}/replaceUser?a=${encodeURIComponent(await stringify([1, 'x']))}`)));
  assert.equal(res.status, 405);
  assert.match(res.headers.get('allow') || '', /PUT/);
});

test('a PUT mutation reports X-Webjs-Invalidate and requires CSRF', async () => {
  // No CSRF -> 403.
  const body = await stringify([1, 'Renamed']);
  const noCsrf = await handle(new Request(url(`/__webjs/action/${hashes.put}/replaceUser`), { method: 'PUT', body, headers: { 'content-type': 'application/vnd.webjs+json' } }));
  assert.equal(noCsrf.status, 403);

  // With CSRF -> 200 + X-Webjs-Invalidate.
  const csrfRes = await handle(new Request(url('/')));
  const cookie = (csrfRes.headers.get('set-cookie') || '').match(/webjs_csrf=([^;]+)/);
  const token = cookie ? decodeURIComponent(cookie[1]) : '';
  const ok = await handle(new Request(url(`/__webjs/action/${hashes.put}/replaceUser`), {
    method: 'PUT', body,
    headers: { 'content-type': 'application/vnd.webjs+json', 'x-webjs-csrf': token, cookie: `webjs_csrf=${token}` },
  }));
  assert.equal(ok.status, 200, await ok.text());
  assert.equal(ok.headers.get('x-webjs-invalidate'), 'user:1');
});

test('a plain action with no method export still works as a POST', async () => {
  const csrfRes = await handle(new Request(url('/')));
  const cookie = (csrfRes.headers.get('set-cookie') || '').match(/webjs_csrf=([^;]+)/);
  const token = cookie ? decodeURIComponent(cookie[1]) : '';
  const res = await handle(new Request(url(`/__webjs/action/${hashes.post}/logEvent`), {
    method: 'POST', body: await stringify(['hi']),
    headers: { 'content-type': 'application/vnd.webjs+json', 'x-webjs-csrf': token, cookie: `webjs_csrf=${token}` },
  }));
  assert.equal(res.status, 200);
  assert.deepEqual(parse(await res.text()), { ok: true, e: 'hi' });
  // A GET to this POST action is rejected (no method export => POST only).
  const bad = await handle(new Request(url(`/__webjs/action/${hashes.post}/logEvent?a=${encodeURIComponent(await stringify(['x']))}`)));
  assert.equal(bad.status, 405);
});
