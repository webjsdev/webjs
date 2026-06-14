/**
 * Unit tests for the runtime-neutral listener core (#511): the SSE registry +
 * fanout, the live-reload path predicate, the compressible media-type set, the
 * runtime detector, and the WS module loader, all shared by the node:http shell
 * and the Bun.serve shell so the two cannot drift.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SseHub,
  serverRuntime,
  isEventsPath,
  isCompressible,
  EVENTS_PATH,
  loadWsModule,
  negotiateEncoding,
  createCompressor,
  varyWithAcceptEncoding,
} from '../../src/listener-core.js';
import { setBasePath } from '../../src/importmap.js';

/* ---------------- SseHub: registry + fanout ---------------- */

/** A fake transport client recording the frames written to it. */
function fakeClient() {
  const frames = [];
  let closed = false;
  return {
    frames,
    get closed() { return closed; },
    send: (s) => { if (closed) throw new Error('write after close'); frames.push(s); },
    close: () => { closed = true; },
  };
}

test('SseHub.reload fans a reload frame to every registered client', () => {
  const hub = new SseHub({ keepaliveMs: 1_000_000 });
  const a = fakeClient(); const b = fakeClient();
  hub.add(a); hub.add(b);
  hub.reload();
  assert.deepEqual(a.frames, ['event: reload\ndata: now\n\n']);
  assert.deepEqual(b.frames, ['event: reload\ndata: now\n\n']);
  hub.closeAll();
});

test('SseHub.devError fans a JSON overlay frame (#264)', () => {
  const hub = new SseHub({ keepaliveMs: 1_000_000 });
  const a = fakeClient();
  hub.add(a);
  hub.devError({ message: 'boom', file: 'app/page.ts' });
  assert.equal(a.frames.length, 1);
  assert.ok(a.frames[0].startsWith('event: webjs-error\ndata: '));
  const json = a.frames[0].slice('event: webjs-error\ndata: '.length).trimEnd();
  assert.deepEqual(JSON.parse(json), { message: 'boom', file: 'app/page.ts' });
  hub.closeAll();
});

test('SseHub.remove stops delivering to a removed client', () => {
  const hub = new SseHub({ keepaliveMs: 1_000_000 });
  const a = fakeClient(); const b = fakeClient();
  hub.add(a); hub.add(b);
  hub.remove(a);
  hub.reload();
  assert.equal(a.frames.length, 0);
  assert.equal(b.frames.length, 1);
  hub.closeAll();
});

test('SseHub fanout isolates a throwing client from the rest', () => {
  const hub = new SseHub({ keepaliveMs: 1_000_000 });
  const dead = { send: () => { throw new Error('socket gone'); }, close: () => {} };
  const live = fakeClient();
  hub.add(dead); hub.add(live);
  assert.doesNotThrow(() => hub.reload());
  assert.equal(live.frames.length, 1, 'a dead client must not abort the fan-out');
  hub.closeAll();
});

test('SseHub.closeAll closes every client and empties the registry', () => {
  const hub = new SseHub({ keepaliveMs: 1_000_000 });
  const a = fakeClient(); const b = fakeClient();
  hub.add(a); hub.add(b);
  hub.closeAll();
  assert.ok(a.closed && b.closed, 'every client is closed');
  assert.equal(hub.clients.size, 0, 'registry is emptied');
});

test('SseHub keepalive writes a comment frame on the timer', async () => {
  const hub = new SseHub({ keepaliveMs: 5 });
  const a = fakeClient();
  hub.add(a);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(a.frames.some((f) => f === ': ka\n\n'), 'a keepalive comment frame is written');
  hub.closeAll();
});

/* ---------------- isEventsPath (base-path aware) ---------------- */

test('isEventsPath matches the live-reload path, base-path aware', () => {
  assert.equal(isEventsPath('/__webjs/events', ''), true);
  assert.equal(isEventsPath('/', ''), false);
  assert.equal(isEventsPath('/__webjs/version', ''), false);
  assert.equal(EVENTS_PATH, '/__webjs/events');
});

test('isEventsPath honors a configured base path (#256)', () => {
  setBasePath('/app');
  try {
    assert.equal(isEventsPath('/app/__webjs/events', '/app'), true);
    // The bare (un-prefixed) path is not under the base path.
    assert.equal(isEventsPath('/__webjs/events', '/app'), false);
  } finally {
    setBasePath('');
  }
});

/* ---------------- isCompressible ---------------- */

test('isCompressible covers text + the structured-text application types', () => {
  for (const ct of ['text/html', 'text/plain; charset=utf-8', 'application/javascript', 'application/json', 'application/xml', 'image/svg+xml', 'application/manifest+json']) {
    assert.equal(isCompressible(ct), true, `${ct} should compress`);
  }
  for (const ct of ['image/png', 'application/octet-stream', 'video/mp4', 'font/woff2', undefined, null, '']) {
    assert.equal(isCompressible(ct), false, `${String(ct)} should NOT compress`);
  }
  // text/event-stream is text/* but must NOT compress: a compressor would buffer
  // an SSE body that is meant to flush incrementally (both shells guard on this).
  assert.equal(isCompressible('text/event-stream'), false, 'an SSE stream must not be compressed');
  assert.equal(isCompressible('text/event-stream; charset=utf-8'), false, 'SSE with params must not compress');
  // An array-valued header (node's multi-value shape) reads its first entry.
  assert.equal(isCompressible(['text/html', 'x']), true);
});

/* ---------------- compression negotiation (#517) ---------------- */

test('negotiateEncoding prefers brotli, then gzip, then deflate', () => {
  assert.equal(negotiateEncoding('br, gzip, deflate'), 'br');
  assert.equal(negotiateEncoding('gzip, deflate'), 'gzip');
  assert.equal(negotiateEncoding('deflate'), 'deflate');
  assert.equal(negotiateEncoding('gzip, br'), 'br', 'order in the header does not matter; brotli still wins');
  // Token-boundary: a substring must not false-match.
  assert.equal(negotiateEncoding('xbr, notgzip'), '', 'partial tokens do not match');
  assert.equal(negotiateEncoding(''), '');
  assert.equal(negotiateEncoding(undefined), '');
  assert.equal(negotiateEncoding(['br', 'gzip']), 'br', 'an array header (node multi-value) is joined');
});

test('createCompressor returns a node:zlib Transform per encoding, null otherwise', () => {
  for (const enc of ['br', 'gzip', 'deflate']) {
    const c = createCompressor(enc);
    assert.ok(c && typeof c.pipe === 'function' && typeof c.write === 'function', `${enc} yields a stream`);
    c.destroy();
  }
  assert.equal(createCompressor(''), null, 'no encoding yields null');
  assert.equal(createCompressor('identity'), null, 'an unknown encoding yields null');
});

test('createCompressor brotli actually round-trips (and works on this runtime)', async () => {
  const { brotliDecompressSync } = await import('node:zlib');
  const c = createCompressor('br');
  const chunks = [];
  c.on('data', (d) => chunks.push(d));
  const done = new Promise((r) => c.on('end', r));
  c.end(Buffer.from('hello brotli '.repeat(50)));
  await done;
  const out = brotliDecompressSync(Buffer.concat(chunks)).toString();
  assert.ok(out.startsWith('hello brotli'), 'brotli compress -> decompress round-trips');
});

test('varyWithAcceptEncoding merges without duplicating', () => {
  assert.equal(varyWithAcceptEncoding(''), 'Accept-Encoding');
  assert.equal(varyWithAcceptEncoding(null), 'Accept-Encoding');
  assert.equal(varyWithAcceptEncoding('Cookie'), 'Cookie, Accept-Encoding');
  assert.equal(varyWithAcceptEncoding('Accept-Encoding'), 'Accept-Encoding', 'no duplicate');
  assert.equal(varyWithAcceptEncoding('Origin, Accept-Encoding'), 'Origin, Accept-Encoding', 'already present, unchanged');
});

/* ---------------- serverRuntime ---------------- */

test('serverRuntime reports the host runtime', () => {
  const rt = serverRuntime();
  assert.ok(rt === 'node' || rt === 'bun');
  // This suite runs under node:test on Node, so it must report 'node'.
  assert.equal(rt, process.versions.bun ? 'bun' : 'node');
});

test('serverRuntime COUNTERFACTUAL: a faked Bun version flips the verdict', () => {
  const orig = process.versions.bun;
  try {
    process.versions.bun = '1.3.14';
    assert.equal(serverRuntime(), 'bun', 'a present process.versions.bun selects the Bun shell');
  } finally {
    if (orig === undefined) delete process.versions.bun; else process.versions.bun = orig;
  }
});

/* ---------------- loadWsModule ---------------- */

test('loadWsModule imports a route module (shared by both WS shells)', async () => {
  const { fileURLToPath } = await import('node:url');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'webjs-ws-mod-'));
  const file = join(dir, 'route.js');
  writeFileSync(file, 'export function WS() {}\nexport const marker = 42;\n');
  try {
    const mod = await loadWsModule(file, false);
    assert.equal(typeof mod.WS, 'function');
    assert.equal(mod.marker, 42);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // Silence the unused import in environments that tree-shake.
  void fileURLToPath;
});
