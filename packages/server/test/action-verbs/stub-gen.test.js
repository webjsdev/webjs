/**
 * Unit: serveActionStub generates a verb-aware client stub (#488). A GET file
 * gets a GET stub (args in the URL, reads the SSR seed); a PUT a body stub.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { serveActionStub, hashFile } from '../../src/actions.js';

let dir;
before(() => { dir = mkdtempSync(join(tmpdir(), 'webjs-stubgen-')); });
after(() => { rmSync(dir, { recursive: true, force: true }); });

async function stubFor(filename, src) {
  const abs = join(dir, filename);
  writeFileSync(abs, src);
  const hash = await hashFile(abs);
  const idx = { fileToHash: new Map([[abs, hash]]), hashToFile: new Map([[hash, abs]]), dev: false, appDir: dir };
  return serveActionStub(idx, abs);
}

test('a GET action stub rides the URL, reads the seed, no CSRF on the read', async () => {
  const stub = await stubFor('get-user.server.js',
    `'use server';\nexport const method='GET';\nexport const cache=60;\nexport async function getUser(id){return {id};}\n`);
  assert.match(stub, /generated server-action stub \(GET\)/);
  assert.match(stub, /'\?a=' \+ encodeURIComponent/, 'GET args ride the URL');
  assert.match(stub, /__seedTake/, 'GET reads the SSR seed (#472)');
  assert.match(stub, /__stale\(key\)/, 'GET consults the tag-stale cache');
  assert.match(stub, /const sig = __sig\(\)/, 'the active abort signal is captured synchronously (#492)');
  assert.match(stub, /signal: sig/, 'the fetch binds the captured abort signal');
  assert.match(stub, /export const getUser = /);
});

test('a PUT action stub sends a body with CSRF (and still reads the SSR seed)', async () => {
  const stub = await stubFor('replace.server.js',
    `'use server';\nexport const method='PUT';\nexport async function replace(id,d){return {id};}\n`);
  assert.match(stub, /generated server-action stub \(PUT\)/);
  // Every verb reads the seed (#472): a default-POST async-render read is seeded
  // regardless of verb; a true mutation simply misses.
  assert.match(stub, /__seedTake/, 'all verbs read the SSR seed');
  assert.doesNotMatch(stub, /__stale\(key\)/, 'a mutation does not consult the browser-cache staleness');
  assert.match(stub, /export const replace = /);
});

test('a DELETE action stub rides the URL and sends no CSRF token', async () => {
  const stub = await stubFor('del.server.js',
    `'use server';\nexport const method='DELETE';\nexport async function del(id){return {ok:1};}\n`);
  assert.match(stub, /generated server-action stub \(DELETE\)/);
  assert.match(stub, /'\?a=' \+ encodeURIComponent/);
  // CSRF is enforced server-side by an Origin / Sec-Fetch-Site check (#659),
  // so the stub reads no cookie and sends no x-webjs-csrf header.
  assert.doesNotMatch(stub, /__csrf\(\)|x-webjs-csrf/);
});

test('config exports are excluded from the action function list', async () => {
  const stub = await stubFor('cfg.server.js',
    `'use server';\nexport const method='GET';\nexport const tags=(id)=>['t'+id];\nexport const validate=(x)=>x;\nexport async function getThing(id){return {id};}\n`);
  assert.match(stub, /export const getThing = /);
  assert.doesNotMatch(stub, /export const tags = \(\.\.\.args\)/, 'tags is config, not an action');
  assert.doesNotMatch(stub, /export const validate = \(\.\.\.args\)/, 'validate is config, not an action');
});

test('a default-POST action (no method) sends a body', async () => {
  const stub = await stubFor('log.server.js',
    `'use server';\nexport async function logEvent(e){return {ok:1};}\n`);
  assert.match(stub, /generated server-action stub \(POST\)/);
  assert.match(stub, /export const logEvent = /);
});

test('every stub can decode a streamed result (#489): imports + __readStream', async () => {
  // Streaming is detected on the RESPONSE content type at runtime, so EVERY
  // stub (regardless of verb) carries the decode path.
  const stub = await stubFor('s.server.js',
    `'use server';\nexport async function* s(){ yield 1; }\n`);
  assert.match(stub, /createFrameDecoder as __frameDec/, 'the frame decoder is imported');
  assert.match(stub, /STREAM_CONTENT_TYPE as __STREAM_CT/, 'the stream MIME constant is imported');
  assert.match(stub, /ct\.includes\(__STREAM_CT\)/, '__handle branches on the stream content type');
  assert.match(stub, /async function\* __readStream/, 'the stub defines the stream reader');
  assert.match(stub, /f\.type === __F_CHUNK\) yield __p/, 'a CHUNK frame yields a deserialized value');
  assert.match(stub, /f\.type === __F_ERR\) throw/, 'an ERROR frame throws');
});
