/**
 * diskStore round-trip + streaming-write proof (issue #247).
 *
 * Covers: put/get bytes equality, the returned { size, contentType }, a
 * moderately large blob round-tripping (streaming, no full buffer), delete
 * idempotence, has(), and a structural assertion that the impl uses
 * createWriteStream + pipeline (NOT writeFile(await blob.arrayBuffer())).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

import { diskStore } from '../../src/file-storage.js';

function tmpDir() {
  const d = mkdtempSync(join(tmpdir(), 'webjs-fs-'));
  return d;
}

/** Drain a web ReadableStream / Node Readable to a Buffer. */
async function drain(body) {
  const chunks = [];
  // Node Readable is async-iterable; a web ReadableStream needs a reader.
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } else {
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

test('put then get returns identical bytes + size + contentType', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    const bytes = Buffer.from('hello webjs file storage éè', 'utf8');
    const blob = new Blob([bytes], { type: 'text/plain' });

    const result = await store.put('a.txt', blob);
    assert.equal(result.key, 'a.txt');
    assert.equal(result.size, bytes.length);
    assert.equal(result.contentType, 'text/plain');

    const handle = await store.get('a.txt');
    assert.ok(handle, 'get returns a handle');
    assert.equal(handle.size, bytes.length);
    assert.equal(handle.contentType, 'text/plain');
    const out = await drain(handle.body);
    assert.deepEqual(out, bytes, 'bytes round-trip exactly');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('get returns null for a missing key', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    assert.equal(await store.get('nope.txt'), null);
    assert.equal(await store.has('nope.txt'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('moderately large blob round-trips without error (streaming)', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    // 4 MiB of pseudo-random-ish bytes.
    const big = Buffer.alloc(4 * 1024 * 1024);
    for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) & 0xff;
    const blob = new Blob([big], { type: 'application/octet-stream' });
    const result = await store.put('big.bin', blob);
    assert.equal(result.size, big.length);

    // Confirm it landed on disk correctly.
    const onDisk = readFileSync(join(dir, 'big.bin'));
    assert.deepEqual(onDisk, big);

    const handle = await store.get('big.bin');
    const out = await drain(handle.body);
    assert.deepEqual(out, big);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('put accepts a Uint8Array and a ReadableStream', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    const u8 = new Uint8Array([1, 2, 3, 4, 5]);
    const r1 = await store.put('u8.bin', u8);
    assert.equal(r1.size, 5);
    assert.deepEqual(await drain((await store.get('u8.bin')).body), Buffer.from(u8));

    const rs = new Blob([Buffer.from('stream-source')]).stream();
    const r2 = await store.put('rs.bin', rs, { contentType: 'text/x' });
    assert.equal(r2.contentType, 'text/x');
    assert.deepEqual(await drain((await store.get('rs.bin')).body), Buffer.from('stream-source'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('nested keys create intermediate directories', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    await store.put('a/b/c.txt', new Blob([Buffer.from('nested')]));
    const out = await drain((await store.get('a/b/c.txt')).body);
    assert.equal(out.toString(), 'nested');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('delete is idempotent', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    await store.put('x.txt', new Blob([Buffer.from('x')]));
    assert.equal(await store.has('x.txt'), true);
    await store.delete('x.txt');
    assert.equal(await store.has('x.txt'), false);
    // Deleting again does not throw.
    await store.delete('x.txt');
    assert.equal(await store.get('x.txt'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('url(key) maps to <baseUrl>/<key>', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir, baseUrl: '/files' });
    assert.equal(store.url('a/b.png'), '/files/a/b.png');
    const dflt = diskStore({ dir });
    assert.equal(dflt.url('a.png'), '/uploads/a.png');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('STRUCTURAL: put streams (createWriteStream + pipeline, no arrayBuffer)', async () => {
  // Read the implementation source and assert the put hot path uses streaming
  // primitives and never buffers the whole file via arrayBuffer().
  const raw = await readFile(new URL('../../src/file-storage.js', import.meta.url), 'utf8');
  // Strip comments so a prose mention of `.arrayBuffer()` in the JSDoc does not
  // count as a real call; we assert on CODE only.
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(src, /createWriteStream/, 'uses createWriteStream');
  assert.match(src, /pipeline\(/, 'uses stream pipeline');
  assert.match(src, /Readable\.fromWeb/, 'converts the web stream without buffering');
  assert.doesNotMatch(src, /\.arrayBuffer\(\)/, 'never calls arrayBuffer() on the put path');
  assert.doesNotMatch(src, /writeFile\(/, 'never uses writeFile for the object body');
});

test('a mid-stream write failure leaves NO partial file behind', async () => {
  const dir = tmpDir();
  try {
    const store = diskStore({ dir });
    // A source stream that emits one chunk on the first pull then errors on the
    // next, simulating a truncated upload / disk error mid-write. Erroring in
    // `pull` (not `start`) keeps it asynchronous, so it propagates through the
    // pipeline to `put` rather than throwing at construction time.
    let pulls = 0;
    const failing = new ReadableStream({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(new Uint8Array([1, 2, 3]));
        else controller.error(new Error('boom mid-stream'));
      },
    });
    await assert.rejects(() => store.put('partial.bin', failing), /boom/);
    // The truncated object must have been removed (no orphan under a key the
    // caller never received).
    assert.equal(await store.has('partial.bin'), false, 'partial file was cleaned up');
    assert.equal(await store.get('partial.bin'), null, 'get returns null, no partial bytes');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
