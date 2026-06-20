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
  const delFile = write('actions/delete-thing.server.js',
    `'use server';\n` +
    `export const method = 'DELETE';\n` +
    `export const invalidates = (id) => ['thing:' + id];\n` +
    `export async function deleteThing(id) { return { deleted: id }; }\n`);
  const pubFile = write('actions/get-public.server.js',
    `'use server';\n` +
    `export const method = 'GET';\n` +
    `export const cache = { maxAge: 30, public: true };\n` +
    `export async function getPublic() { return { v: 1 }; }\n`);

  write('app/layout.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ({ children }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  write('app/page.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default () => html\`<main>ok</main>\`;\n`);

  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  handle = app.handle;
  hashes.get = await hashFile(getFile);
  hashes.put = await hashFile(putFile);
  hashes.post = await hashFile(postFile);
  hashes.del = await hashFile(delFile);
  hashes.pub = await hashFile(pubFile);
});

// Action CSRF is an Origin / Sec-Fetch-Site check (#659): a same-origin
// request needs only this header, no token or cookie.
async function csrf() {
  return { 'sec-fetch-site': 'same-origin' };
}

after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

test('a GET action is served at GET with Cache-Control + X-Webjs-Tags + ETag, no CSRF', async () => {
  const key = await stringify([5]);
  const res = await handle(new Request(url(`/__webjs/action/${hashes.get}/getUser?a=${encodeURIComponent(key)}`)));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') || '', /private, max-age=60/);
  assert.equal(res.headers.get('x-webjs-tags'), 'user:5');
  assert.ok(res.headers.get('etag'), 'the GET action attached a weak ETag');
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

test('a PUT mutation reports X-Webjs-Invalidate and requires same-origin', async () => {
  // A cross-site request -> 403.
  const body = await stringify([1, 'Renamed']);
  const crossSite = await handle(new Request(url(`/__webjs/action/${hashes.put}/replaceUser`), { method: 'PUT', body, headers: { 'content-type': 'application/vnd.webjs+json', 'sec-fetch-site': 'cross-site' } }));
  assert.equal(crossSite.status, 403);

  // Same-origin -> 200 + X-Webjs-Invalidate.
  const ok = await handle(new Request(url(`/__webjs/action/${hashes.put}/replaceUser`), {
    method: 'PUT', body,
    headers: { 'content-type': 'application/vnd.webjs+json', ...(await csrf()) },
  }));
  assert.equal(ok.status, 200, await ok.text());
  assert.equal(ok.headers.get('x-webjs-invalidate'), 'user:1');
});

test('a DELETE action rides the URL, requires same-origin, and invalidates', async () => {
  const a = encodeURIComponent(await stringify([9]));
  // A cross-site request -> 403.
  const crossSite = await handle(new Request(url(`/__webjs/action/${hashes.del}/deleteThing?a=${a}`), { method: 'DELETE', headers: { 'sec-fetch-site': 'cross-site' } }));
  assert.equal(crossSite.status, 403);
  // With CSRF -> 200 + X-Webjs-Invalidate, args read from the URL.
  const ok = await handle(new Request(url(`/__webjs/action/${hashes.del}/deleteThing?a=${a}`), { method: 'DELETE', headers: await csrf() }));
  const okBody = await ok.text();
  assert.equal(ok.status, 200, okBody);
  assert.equal(ok.headers.get('x-webjs-invalidate'), 'thing:9');
  assert.deepEqual(parse(okBody), { deleted: 9 });
});

test('a GET action accepts the POST fallback (over-large args), still CSRF-exempt', async () => {
  // The stub falls back to POST when the URL args exceed the cap. The endpoint
  // accepts POST for a GET action and reads the body, staying CSRF-exempt.
  const res = await handle(new Request(url(`/__webjs/action/${hashes.get}/getUser`), {
    method: 'POST', body: await stringify([3]),
    headers: { 'content-type': 'application/vnd.webjs+json' }, // no CSRF
  }));
  const body = await res.text();
  assert.equal(res.status, 200, body);
  assert.deepEqual(parse(body), { id: 3, name: 'u3' });
});

test('a public GET action is served with a public Cache-Control', async () => {
  const res = await handle(new Request(url(`/__webjs/action/${hashes.pub}/getPublic?a=${encodeURIComponent(await stringify([]))}`)));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') || '', /public, max-age=30/);
});

test('a plain action with no method export still works as a POST', async () => {
  const res = await handle(new Request(url(`/__webjs/action/${hashes.post}/logEvent`), {
    method: 'POST', body: await stringify(['hi']),
    headers: { 'content-type': 'application/vnd.webjs+json', ...(await csrf()) },
  }));
  assert.equal(res.status, 200);
  assert.deepEqual(parse(await res.text()), { ok: true, e: 'hi' });
  // A GET to this POST action is rejected (no method export => POST only).
  const bad = await handle(new Request(url(`/__webjs/action/${hashes.post}/logEvent?a=${encodeURIComponent(await stringify(['x']))}`)));
  assert.equal(bad.status, 405);
});
