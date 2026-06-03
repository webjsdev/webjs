/**
 * Unit tests for the request body-limit + server-timeout helpers (issue #237):
 * config/env resolution, the node headersTimeout < requestTimeout invariant, and
 * the bounded read (fast Content-Length reject AND a streaming cap that never
 * buffers an over-limit chunked body).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_MAX_MULTIPART_BYTES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_HEADERS_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  readBodyLimits,
  computeServerTimeouts,
  readBytesBounded,
  readTextBounded,
  readFormDataBounded,
  BodyLimitError,
} from '../../src/body-limit.js';

/* ---------------- config resolution ---------------- */

test('readBodyLimits: defaults when nothing configured', () => {
  const limits = readBodyLimits(undefined, { env: {} });
  assert.equal(limits.json, DEFAULT_MAX_BODY_BYTES);
  assert.equal(limits.multipart, DEFAULT_MAX_MULTIPART_BYTES);
});

test('readBodyLimits: package.json webjs.maxBodyBytes / maxMultipartBytes config', () => {
  const limits = readBodyLimits(
    { webjs: { maxBodyBytes: 2048, maxMultipartBytes: 4096 } },
    { env: {} },
  );
  assert.equal(limits.json, 2048);
  assert.equal(limits.multipart, 4096);
});

test('readBodyLimits: env overrides package.json (and 0 disables)', () => {
  const limits = readBodyLimits(
    { webjs: { maxBodyBytes: 2048 } },
    { env: { WEBJS_MAX_BODY_BYTES: '0', WEBJS_MAX_MULTIPART_BYTES: '999' } },
  );
  assert.equal(limits.json, 0, 'env 0 wins over the config and disables the cap');
  assert.equal(limits.multipart, 999);
});

test('readBodyLimits: a malformed config value falls through to the default', () => {
  const limits = readBodyLimits({ webjs: { maxBodyBytes: -5 } }, { env: {} });
  assert.equal(limits.json, DEFAULT_MAX_BODY_BYTES);
});

/* ---------------- server timeouts ---------------- */

test('computeServerTimeouts: secure defaults', () => {
  const t = computeServerTimeouts(undefined, { env: {} });
  assert.equal(t.requestTimeout, DEFAULT_REQUEST_TIMEOUT_MS);
  assert.equal(t.headersTimeout, DEFAULT_HEADERS_TIMEOUT_MS);
  assert.equal(t.keepAliveTimeout, DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
  assert.ok(
    t.headersTimeout < t.requestTimeout,
    'default headersTimeout must be under requestTimeout to fire',
  );
});

test('computeServerTimeouts: config + env precedence', () => {
  const t = computeServerTimeouts(
    { webjs: { requestTimeoutMs: 40000, headersTimeoutMs: 10000, keepAliveTimeoutMs: 7000 } },
    { env: { WEBJS_KEEP_ALIVE_TIMEOUT_MS: '3000' } },
  );
  assert.equal(t.requestTimeout, 40000);
  assert.equal(t.headersTimeout, 10000);
  assert.equal(t.keepAliveTimeout, 3000, 'env wins over the config');
});

test('computeServerTimeouts: clamps headersTimeout under requestTimeout (node semantics)', () => {
  // A config that sets headersTimeout >= requestTimeout would ship a dead
  // headers deadline (node measures both from the same request start). Clamp it.
  const t = computeServerTimeouts(
    { webjs: { requestTimeoutMs: 5000, headersTimeoutMs: 9000 } },
    { env: {} },
  );
  assert.ok(t.headersTimeout < t.requestTimeout);
  assert.equal(t.headersTimeout, 4000);
});

test('computeServerTimeouts: 0 disables and is left untouched', () => {
  const t = computeServerTimeouts(
    { webjs: { requestTimeoutMs: 0, headersTimeoutMs: 0 } },
    { env: {} },
  );
  assert.equal(t.requestTimeout, 0);
  assert.equal(t.headersTimeout, 0, 'a disabled requestTimeout means no clamp is applied');
});

/* ---------------- bounded read: fast reject ---------------- */

test('readBytesBounded: Content-Length over the limit is a fast reject, body untouched', async () => {
  // A large declared Content-Length over the limit must reject WITHOUT draining
  // the body. We prove it by leaving the request body unread afterwards: a fast
  // reject returns before `getReader()`, so `req.body` stays unlocked / usable.
  const req = new Request('http://x/', {
    method: 'POST',
    headers: { 'content-length': '5000' },
    body: 'x'.repeat(10),
  });
  const r = await readBytesBounded(req, 1000);
  assert.equal(r.tooLarge, true);
  assert.equal(r.bytes, null);
  assert.equal(req.bodyUsed, false, 'an over-Content-Length body must never be consumed');
  // And the body is still readable (not locked), confirming we never touched it.
  assert.equal(await req.text(), 'x'.repeat(10));
});

test('readBytesBounded: body under the limit succeeds', async () => {
  const req = new Request('http://x/', {
    method: 'POST',
    body: new Uint8Array([1, 2, 3, 4]),
  });
  const r = await readBytesBounded(req, 1000);
  assert.equal(r.tooLarge, false);
  assert.equal(r.bytes.byteLength, 4);
});

/* ---------------- bounded read: streaming cap ---------------- */

test('readBytesBounded: chunked body without Content-Length trips the limit mid-stream, no full buffer', async () => {
  // Stream more bytes than the limit, one chunk at a time, with NO Content-Length
  // header. The reader must bail the instant the running total crosses the cap,
  // never pulling the whole payload into memory.
  const CHUNK = 1000;
  const LIMIT = 2500;
  let chunksEmitted = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (chunksEmitted >= 100) { controller.close(); return; }
      chunksEmitted++;
      controller.enqueue(new Uint8Array(CHUNK));
    },
    cancel() { cancelled = true; },
  });
  const req = new Request('http://x/', { method: 'POST', body, duplex: 'half' });
  // No content-length header is set on a stream body.
  assert.equal(req.headers.get('content-length'), null);

  const r = await readBytesBounded(req, LIMIT);
  assert.equal(r.tooLarge, true);
  assert.equal(r.bytes, null);
  // Crossed the limit at chunk 3 (3000 > 2500); must not have read all 100.
  assert.ok(chunksEmitted <= 4, `bailed early, only pulled ${chunksEmitted} chunks`);
  assert.equal(cancelled, true, 'the stream reader was cancelled to release the socket');
});

test('readTextBounded: decodes an under-limit body, flags an over-limit one', async () => {
  const ok = await readTextBounded(
    new Request('http://x/', { method: 'POST', body: 'hello' }),
    1000,
  );
  assert.equal(ok.tooLarge, false);
  assert.equal(ok.text, 'hello');

  const big = await readTextBounded(
    new Request('http://x/', { method: 'POST', body: 'x'.repeat(50) }),
    10,
  );
  assert.equal(big.tooLarge, true);
  assert.equal(big.text, '');
});

test('readFormDataBounded: parses urlencoded under the limit, flags over', async () => {
  const ok = await readFormDataBounded(
    new Request('http://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=alice&role=admin',
    }),
    1000,
  );
  assert.equal(ok.tooLarge, false);
  assert.equal(ok.formData.get('name'), 'alice');
  assert.equal(ok.formData.get('role'), 'admin');

  const big = await readFormDataBounded(
    new Request('http://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'data=' + 'y'.repeat(500),
    }),
    50,
  );
  assert.equal(big.tooLarge, true);
  assert.equal(big.formData, null);
});

test('readBytesBounded: limit 0 disables the cap', async () => {
  const r = await readBytesBounded(
    new Request('http://x/', {
      method: 'POST',
      headers: { 'content-length': '999999' },
      body: 'x'.repeat(100),
    }),
    0,
  );
  assert.equal(r.tooLarge, false);
  assert.equal(r.bytes.byteLength, 100);
});

test('BodyLimitError carries the webjsBodyLimit marker', () => {
  const e = new BodyLimitError();
  assert.equal(e.webjsBodyLimit, true);
  assert.equal(e.name, 'BodyLimitError');
});
