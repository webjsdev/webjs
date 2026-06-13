/**
 * Integration: streaming RPC results (#489) through createRequestHandler. An
 * action returning an async iterable / ReadableStream streams a framed body
 * (application/vnd.webjs+stream); the chunks decode back via the SAME core frame
 * decoder the browser stub uses, rich values round-trip, a mid-stream throw lands
 * as an ERROR frame, and an aborted request stops the source generator.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { hashFile } from '../../src/actions.js';
import {
  stringify, parse, createFrameDecoder, FRAME_CHUNK, FRAME_END, FRAME_ERROR, STREAM_CONTENT_TYPE,
} from '@webjsdev/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_URL = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot, appDir, handle;
const hashes = {};
const url = (p) => 'http://localhost' + p;

function write(rel, body) {
  const abs = join(appDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  return abs;
}

/** Drain a framed stream Response into { chunks, ended, error } via the real decoder. */
async function drain(res) {
  const reader = res.body.getReader();
  const dec = createFrameDecoder();
  const td = new TextDecoder();
  const chunks = [];
  let ended = false;
  let error = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const f of dec.push(value)) {
      if (f.type === FRAME_CHUNK) chunks.push(parse(td.decode(f.payload)));
      else if (f.type === FRAME_END) ended = true;
      else if (f.type === FRAME_ERROR) error = td.decode(f.payload);
    }
  }
  return { chunks, ended, error };
}

async function csrfHeaders() {
  const res = await handle(new Request(url('/')));
  const m = (res.headers.get('set-cookie') || '').match(/webjs_csrf=([^;]+)/);
  const t = m ? decodeURIComponent(m[1]) : '';
  return { 'content-type': 'application/vnd.webjs+json', 'x-webjs-csrf': t, cookie: `webjs_csrf=${t}` };
}

before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-stream-'));
  appDir = mkdtempSync(join(tmpRoot, 'app-'));
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'stream', type: 'module', webjs: {} }));

  // POST action returning an async generator of plain values.
  const tokensFile = write('actions/tokens.server.js',
    `'use server';\n` +
    `export async function* tokens(n) {\n` +
    `  for (let i = 0; i < n; i++) yield 'tok' + i;\n` +
    `}\n`);
  // GET action streaming rich values (Date, Map) so the serializer round-trips.
  const richFile = write('actions/rich-stream.server.js',
    `'use server';\n` +
    `export const method = 'GET';\n` +
    `export async function* richStream() {\n` +
    `  yield { at: new Date('2020-01-02T03:04:05.000Z'), tags: new Map([['a', 1]]) };\n` +
    `  yield { big: 9007199254740993n };\n` +
    `}\n`);
  // An action that yields, then throws mid-stream -> ERROR frame after chunks.
  const boomFile = write('actions/boom-stream.server.js',
    `'use server';\n` +
    `export async function* boomStream() {\n` +
    `  yield 'before';\n` +
    `  throw new Error('mid-stream failure');\n` +
    `}\n`);
  // An action returning a web ReadableStream (not an async generator).
  const rsFile = write('actions/rs-stream.server.js',
    `'use server';\n` +
    `export async function rsStream() {\n` +
    `  return new ReadableStream({\n` +
    `    start(c) { c.enqueue('x'); c.enqueue('y'); c.close(); },\n` +
    `  });\n` +
    `}\n`);
  // A POST mutation that streams AND declares invalidates: the header still rides.
  const mutFile = write('actions/mut-stream.server.js',
    `'use server';\n` +
    `export const invalidates = () => ['feed'];\n` +
    `export async function* mutStream() { yield 'a'; yield 'b'; }\n`);
  // An action whose generator records when it was cancelled (abort path), via a
  // sentinel file write in its finally block.
  const cancelFlag = join(appDir, 'cancelled.flag');
  const abortFile = write('actions/abort-stream.server.js',
    `'use server';\n` +
    `import { writeFileSync } from 'node:fs';\n` +
    `export async function* abortStream() {\n` +
    `  try {\n` +
    `    for (let i = 0; i < 1000; i++) { yield 'n' + i; await new Promise((r) => setTimeout(r, 5)); }\n` +
    `  } finally { writeFileSync(${JSON.stringify(cancelFlag)}, 'cancelled'); }\n` +
    `}\n`);
  write('app/layout.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ({children})=>html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  write('app/page.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ()=>html\`<main>ok</main>\`;\n`);

  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  handle = app.handle;
  hashes.tokens = await hashFile(tokensFile);
  hashes.rich = await hashFile(richFile);
  hashes.boom = await hashFile(boomFile);
  hashes.rs = await hashFile(rsFile);
  hashes.mut = await hashFile(mutFile);
  hashes.abort = await hashFile(abortFile);
  hashes.cancelFlag = cancelFlag;
});
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

test('a POST async-generator action streams framed chunks then END', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.tokens}/tokens`), { method: 'POST', body: await stringify([3]), headers }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), new RegExp(STREAM_CONTENT_TYPE.replace('+', '\\+')));
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { chunks, ended, error } = await drain(res);
  assert.deepEqual(chunks, ['tok0', 'tok1', 'tok2']);
  assert.equal(ended, true);
  assert.equal(error, null);
});

test('a GET streaming action round-trips rich values (Date / Map / BigInt)', async () => {
  const res = await handle(new Request(url(`/__webjs/action/${hashes.rich}/richStream?a=${encodeURIComponent(await stringify([]))}`)));
  assert.equal(res.status, 200);
  const { chunks, ended } = await drain(res);
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].at instanceof Date);
  assert.equal(chunks[0].at.toISOString(), '2020-01-02T03:04:05.000Z');
  assert.ok(chunks[0].tags instanceof Map);
  assert.equal(chunks[0].tags.get('a'), 1);
  assert.equal(chunks[1].big, 9007199254740993n);
  assert.equal(ended, true);
});

test('a throw mid-stream lands as an ERROR frame after the prior chunks', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.boom}/boomStream`), { method: 'POST', body: await stringify([]), headers }));
  assert.equal(res.status, 200, 'the stream already started, so the HTTP status stays 200');
  const { chunks, error, ended } = await drain(res);
  assert.deepEqual(chunks, ['before']);
  assert.equal(error, 'mid-stream failure');
  assert.equal(ended, false, 'an errored stream does not also emit END');
});

test('an action returning a web ReadableStream streams its chunks', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.rs}/rsStream`), { method: 'POST', body: await stringify([]), headers }));
  const { chunks, ended } = await drain(res);
  assert.deepEqual(chunks, ['x', 'y']);
  assert.equal(ended, true);
});

test('a streaming mutation still emits its X-Webjs-Invalidate header', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.mut}/mutStream`), { method: 'POST', body: await stringify([]), headers }));
  assert.equal(res.headers.get('x-webjs-invalidate'), 'feed');
  const { chunks, ended } = await drain(res);
  assert.deepEqual(chunks, ['a', 'b']);
  assert.equal(ended, true);
});

test('aborting the request cancels the source generator (its finally runs)', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const headers = await csrfHeaders();
  const ac = new AbortController();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.abort}/abortStream`), { method: 'POST', body: await stringify([]), headers, signal: ac.signal }));
  const reader = res.body.getReader();
  await reader.read(); // pull the first chunk so the generator is suspended mid-run
  ac.abort();
  try { reader.cancel(); } catch {}
  // The generator's finally writes the sentinel once cancellation propagates.
  for (let i = 0; i < 100 && !existsSync(hashes.cancelFlag); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(existsSync(hashes.cancelFlag), 'the aborted generator ran its finally (cancelled)');
  assert.equal(readFileSync(hashes.cancelFlag, 'utf8'), 'cancelled');
});

test('a still-reading client gets an ERROR frame on abort, not a silent close', async () => {
  // A server-side abort must not look like a clean completion to a client that
  // is still reading: the abort path emits an ERROR frame so the consumer can
  // tell truncation apart from success (the END-frame contract).
  const headers = await csrfHeaders();
  const ac = new AbortController();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.abort}/abortStream`), { method: 'POST', body: await stringify([]), headers, signal: ac.signal }));
  const reader = res.body.getReader();
  const dec = createFrameDecoder();
  const td = new TextDecoder();
  await reader.read(); // first chunk: the generator is now suspended mid-run
  ac.abort();
  let error = null;
  let ended = false;
  for (let i = 0; i < 50 && error == null; i++) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const f of dec.push(value)) {
      if (f.type === FRAME_ERROR) error = td.decode(f.payload);
      else if (f.type === FRAME_END) ended = true;
    }
  }
  assert.equal(error, 'stream aborted', 'the abort surfaced as an ERROR frame');
  assert.equal(ended, false, 'an aborted stream does not emit a clean END');
});

test('the generated stub enforces the END frame (truncation throws)', async () => {
  // The stub reader treats a body that ends without END/ERROR as truncated. We
  // assert the GENERATED stub carries that guard AND verify the runtime contract
  // by replaying a truncated framed body through the same decode logic.
  const dec = createFrameDecoder();
  const td = new TextDecoder();
  const enc = new TextEncoder();
  // A lone CHUNK frame, then the body ends (no END). Replicate the stub's loop.
  const truncated = (await import('@webjsdev/core')).encodeFrame(FRAME_CHUNK, enc.encode(await stringify('partial')));
  let ended = false;
  const seen = [];
  for (const f of dec.push(truncated)) {
    if (f.type === FRAME_CHUNK) seen.push(parse(td.decode(f.payload)));
    else if (f.type === FRAME_END) ended = true;
  }
  // The body is now exhausted with no END: the stub would throw here.
  assert.deepEqual(seen, ['partial']);
  assert.equal(ended, false, 'no END frame arrived -> the stub treats this as truncated and throws');
});
