/**
 * Integration: a serving handler that verifies a signed url then streams
 * get(key) (issue #247).
 *
 * Models the recipe's `route.js`: it parses the request URL, verifies the
 * signature, and on success returns `new Response(handle.body, { headers })`.
 * An unsigned / expired / tampered request gets 403. This proves the
 * round-trip + signed-url + content-type all compose into a real Response,
 * without standing up a full createRequestHandler app (the helper + handler is
 * the must-have).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { diskStore, generateKey, signedUrl, verifySignedUrl } from '../../src/file-storage.js';

const SECRET = 'route-signing-secret';

/** The serving handler the recipe documents, as a pure (store) -> handler fn. */
function makeServeHandler(store) {
  return async function GET(request) {
    const url = new URL(request.url);
    const check = verifySignedUrl(url.searchParams, SECRET);
    if (!check.valid) return new Response('Forbidden', { status: 403 });
    const handle = await store.get(check.key);
    if (!handle) return new Response('Not Found', { status: 404 });
    return new Response(handle.body, {
      status: 200,
      headers: {
        'content-type': handle.contentType,
        'content-length': String(handle.size),
      },
    });
  };
}

test('signed request returns 200 + bytes + content-type', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-serve-'));
  try {
    const store = diskStore({ dir, baseUrl: '/uploads' });
    const bytes = Buffer.from('the served payload', 'utf8');
    const key = generateKey('payload.png');
    await store.put(key, new Blob([bytes], { type: 'image/png' }));

    const GET = makeServeHandler(store);
    const signed = signedUrl(key, { secret: SECRET, base: `http://app.test/uploads/${key}` });
    const resp = await GET(new Request(signed));

    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type'), 'image/png');
    const out = Buffer.from(await resp.arrayBuffer());
    assert.deepEqual(out, bytes, 'served bytes equal the stored bytes');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unsigned request gets 403', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-serve403-'));
  try {
    const store = diskStore({ dir });
    const key = generateKey('x.txt');
    await store.put(key, new Blob([Buffer.from('secret')]));
    const GET = makeServeHandler(store);
    const resp = await GET(new Request(`http://app.test/uploads/${key}`));
    assert.equal(resp.status, 403);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tampered-key request gets 403', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-servetamper-'));
  try {
    const store = diskStore({ dir });
    const key = generateKey('a.txt');
    await store.put(key, new Blob([Buffer.from('a')]));
    const GET = makeServeHandler(store);
    const signed = signedUrl(key, { secret: SECRET, base: `http://app.test/uploads/${key}` });
    // Swap the key param to a different value; signature no longer matches.
    const u = new URL(signed);
    u.searchParams.set('key', 'b.txt');
    const resp = await GET(new Request(u.toString()));
    assert.equal(resp.status, 403);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('expired request gets 403', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-fs-serveexp-'));
  try {
    const store = diskStore({ dir });
    const key = generateKey('a.txt');
    await store.put(key, new Blob([Buffer.from('a')]));
    const GET = makeServeHandler(store);
    const signed = signedUrl(key, { secret: SECRET, expiresIn: 1, base: `http://app.test/uploads/${key}` });
    await new Promise((r) => setTimeout(r, 2100));
    const resp = await GET(new Request(signed));
    assert.equal(resp.status, 403);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
