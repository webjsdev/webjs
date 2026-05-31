import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildActionIndex,
  resolveServerModule,
  serveActionStub,
  invokeAction,
  isServerFile,
  RPC_CONTENT_TYPE,
} from '../../src/actions.js';
import { stringify as wjStringify, parse as wjParse } from '../../../core/src/serialize.js';

async function scaffold(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(join(p, '..'), { recursive: true });
    await writeFile(p, body);
  }
  return dir;
}

test('webjs wire format round-trips Date / Map / BigInt across invokeAction', async () => {
  const dir = await scaffold({
    'actions/rich.server.js': `'use server';
      export async function now() { return new Date(1234567890000); }
      export async function bag() {
        return { big: 9007199254740993n, set: new Set(['a','b']), map: new Map([[1, 'one']]) };
      }
    `,
  });
  try {
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/rich.server.js');
    const hash = idx.fileToHash.get(file);
    const tok = 't';
    const headers = { 'content-type': RPC_CONTENT_TYPE, cookie: `webjs_csrf=${tok}`, 'x-webjs-csrf': tok };
    const r1 = await invokeAction(idx, hash, 'now',
      new Request('http://x/__webjs/action/' + hash + '/now',
        { method: 'POST', headers, body: await wjStringify([]) }));
    const d = wjParse(await r1.text());
    assert.ok(d instanceof Date, 'Date survived the wire');
    assert.equal(d.getTime(), 1234567890000);

    const r2 = await invokeAction(idx, hash, 'bag',
      new Request('http://x/__webjs/action/' + hash + '/bag',
        { method: 'POST', headers, body: await wjStringify([]) }));
    const bag = wjParse(await r2.text());
    assert.equal(typeof bag.big, 'bigint');
    assert.equal(bag.big, 9007199254740993n);
    assert.ok(bag.set instanceof Set); assert.ok(bag.set.has('a'));
    assert.ok(bag.map instanceof Map); assert.equal(bag.map.get(1), 'one');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('isServerFile is path-only: .server.* yes, anything else no', async () => {
  const dir = await scaffold({
    'actions/a.server.js': 'export const hello = async () => 1',
    'actions/b.js': `'use server';\nexport const bye = async () => 2`,
    'actions/c.js': 'export const plain = () => 3',
  });
  try {
    // .server.{js,ts} extension is the only path-level marker.
    assert.equal(isServerFile(join(dir, 'actions/a.server.js')), true);
    // 'use server' WITHOUT the extension is no longer server-only. The
    // lint rule `use-server-needs-extension` flags it instead; the file
    // serves to the browser as plain source.
    assert.equal(isServerFile(join(dir, 'actions/b.js')), false);
    assert.equal(isServerFile(join(dir, 'actions/c.js')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('stubs server module and invokes action by hash/fn', async () => {
  const dir = await scaffold({
    'actions/math.server.js': `'use server';
      export async function add(a, b) { return a + b; }
      export async function mul(a, b) { return a * b; }
    `,
  });
  try {
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/math.server.js');
    assert.ok(file);

    const stub = await serveActionStub(idx, file);
    assert.match(stub, /export const add = /);
    assert.match(stub, /export const mul = /);
    assert.match(stub, /\/__webjs\/action\/[a-f0-9]+\//);

    const hash = idx.fileToHash.get(file);
    // Action RPC is CSRF-protected: must present matching cookie + header.
    const tok = 'test-csrf-token';
    const req = new Request('http://x/__webjs/action/' + hash + '/add', {
      method: 'POST',
      headers: {
        'content-type': RPC_CONTENT_TYPE,
        cookie: `webjs_csrf=${tok}`,
        'x-webjs-csrf': tok,
      },
      body: await wjStringify([2, 3]),
    });
    const res = await invokeAction(idx, hash, 'add', req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), RPC_CONTENT_TYPE);
    assert.equal(wjParse(await res.text()), 5);

    // Without CSRF token → 403
    const unsafe = new Request('http://x/__webjs/action/' + hash + '/add', {
      method: 'POST',
      headers: { 'content-type': RPC_CONTENT_TYPE },
      body: await wjStringify([2, 3]),
    });
    const rejected = await invokeAction(idx, hash, 'add', unsafe);
    assert.equal(rejected.status, 403);

    // Mismatched header vs cookie → 403
    const mismatched = new Request('http://x/__webjs/action/' + hash + '/add', {
      method: 'POST',
      headers: {
        'content-type': RPC_CONTENT_TYPE,
        cookie: `webjs_csrf=${tok}`,
        'x-webjs-csrf': 'different',
      },
      body: await wjStringify([2, 3]),
    });
    const rejected2 = await invokeAction(idx, hash, 'add', mismatched);
    assert.equal(rejected2.status, 403);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('hashFile: returns a 10-char hex string, stable per input', async () => {
  // Regression coverage for the createHash → crypto.subtle.digest
  // migration. hashFile is the RPC-route key derivation: every
  // server action's URL embeds this hash, so any drift in shape or
  // determinism would break action routing across deploys.
  const { hashFile } = await import('../../src/actions.js');
  const a1 = await hashFile('/abs/path/to/some-action.server.ts');
  const a2 = await hashFile('/abs/path/to/some-action.server.ts');
  const b1 = await hashFile('/abs/path/to/other.server.ts');
  assert.match(a1, /^[0-9a-f]{10}$/, `hashFile must produce 10 hex chars; got ${a1}`);
  assert.equal(a1, a2, 'hashFile must be deterministic for the same input');
  assert.notEqual(a1, b1, 'hashFile must differ for different inputs');
});

test('a pure-RPC server module is hashed at boot but NOT executed until first call', async () => {
  // Runtime-first boot (#141): buildActionIndex must not import every server
  // module (which would fire Prisma init etc.). It hashes them so RPC dispatch
  // can resolve them, and the module loads on the first invoke.
  const dir = await scaffold({
    'actions/side.server.js': `'use server';
      globalThis.__webjs_boot_probe = (globalThis.__webjs_boot_probe || 0) + 1;
      export async function ping() { return 'pong'; }
    `,
  });
  try {
    delete globalThis.__webjs_boot_probe;
    const idx = await buildActionIndex(dir, true);
    const file = resolveServerModule(idx, '/actions/side.server.js');
    assert.ok(idx.fileToHash.get(file), 'module is in the hash index after boot');
    assert.equal(globalThis.__webjs_boot_probe, undefined, 'module must NOT execute at boot');

    const hash = idx.fileToHash.get(file);
    const tok = 't';
    const headers = { 'content-type': RPC_CONTENT_TYPE, cookie: `webjs_csrf=${tok}`, 'x-webjs-csrf': tok };
    const r = await invokeAction(idx, hash, 'ping',
      new Request('http://x/__webjs/action/' + hash + '/ping',
        { method: 'POST', headers, body: await wjStringify([]) }));
    assert.equal(wjParse(await r.text()), 'pong');
    assert.equal(globalThis.__webjs_boot_probe, 1, 'module executes on first call, not at boot');
  } finally {
    delete globalThis.__webjs_boot_probe;
    await rm(dir, { recursive: true, force: true });
  }
});
