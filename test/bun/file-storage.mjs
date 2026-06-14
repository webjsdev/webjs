/**
 * Cross-runtime FileStore streaming proof (#509). The full `diskStore` suite
 * (packages/server/test/file-storage/disk-store.test.js) is denylisted in the
 * Bun matrix because Bun's `node:test` runner mis-attributes the intentional
 * mid-stream ReadableStream error across its tests. So that the streaming
 * behavior is NOT actually unverified on Bun, this standalone assert script
 * exercises the two invariants that depend on the `Readable.fromWeb` ->
 * `createWriteStream` -> `pipeline` path (the stream/fs surface most likely to
 * diverge across runtimes) under WHICHEVER runtime runs it:
 *
 *   node test/bun/file-storage.mjs
 *   bun  test/bun/file-storage.mjs
 *
 * (1) a Blob put/get round-trips identical bytes + size + content type, and
 * (2) a mid-stream write failure rejects AND leaves NO orphan partial file.
 * Run from the repo root so the bare `@webjsdev/server` specifier resolves to
 * the workspace package.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diskStore } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const dir = mkdtempSync(join(tmpdir(), 'webjs-filestore-x-'));
try {
  const store = diskStore({ dir });

  // 1. Blob put/get round-trip through the streaming write + read path.
  await store.put('x.bin', new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'application/octet-stream' }));
  const handle = await store.get('x.bin');
  assert.ok(handle, 'get returns a handle');
  assert.equal(handle.size, 5, 'size is reported');
  assert.equal(handle.contentType, 'application/octet-stream', 'content type is preserved');
  const chunks = [];
  for await (const c of handle.body) chunks.push(Buffer.from(c));
  const bytes = Buffer.concat(chunks);
  assert.deepEqual([...bytes], [1, 2, 3, 4, 5], 'bytes round-trip identically');

  // 2. A mid-stream write failure rejects and leaves no orphan partial file.
  let pulls = 0;
  const failing = new ReadableStream({
    pull(controller) {
      if (pulls++ === 0) controller.enqueue(new Uint8Array([1, 2, 3]));
      else controller.error(new Error('boom mid-stream'));
    },
  });
  await assert.rejects(() => store.put('partial.bin', failing), /boom/, 'put rejects on a mid-stream error');
  assert.equal(await store.has('partial.bin'), false, 'the truncated partial file was cleaned up');
  assert.equal(await store.get('partial.bin'), null, 'get returns null (no partial bytes)');

  console.log(`OK  webjs FileStore streaming passed on ${runtime} (put/get round-trip + no-orphan-on-mid-stream-error)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
