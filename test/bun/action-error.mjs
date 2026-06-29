/**
 * Cross-runtime proof that server-action error sanitization (#749) behaves
 * identically on Node and Bun. webjs runs on Node 24+ OR Bun, and the sanitizer
 * computes a correlation digest via Web Crypto (`crypto.subtle.digest`, in
 * crypto-utils.js) and runs through the serializer + the streaming frame
 * channel, all runtime-sensitive surfaces. Run from the repo root:
 *
 *   node test/bun/action-error.mjs
 *   bun  test/bun/action-error.mjs
 *
 * Asserts, on whichever runtime executes it: the buffered RPC path returns a
 * GENERIC message + a digest (never the raw thrown message), and the streaming
 * error frame is sanitized the same way.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import {
  buildActionIndex, resolveServerModule, invokeAction, RPC_CONTENT_TYPE,
} from '../../packages/server/src/actions.js';
import { streamActionResponse } from '../../packages/server/src/action-stream.js';
import { stringify as wjStringify, parse as wjParse } from '../../packages/core/src/serialize.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const SECRET = 'pg: violates unique constraint "users_email_key"';

const dir = mkdtempSync(join(tmpdir(), 'webjs-749-bun-'));
const f = join(dir, 'actions', 'boom.server.js');
mkdirSync(dirname(f), { recursive: true });
writeFileSync(f, `'use server';\nexport async function boom() { throw new Error(${JSON.stringify(SECRET)}); }\n`);

// Buffered RPC path: prod (dev=false) returns generic message + digest.
{
  const idx = await buildActionIndex(dir, false);
  const file = resolveServerModule(idx, '/actions/boom.server.js');
  const hash = idx.fileToHash.get(file);
  const headers = { 'content-type': RPC_CONTENT_TYPE, 'sec-fetch-site': 'same-origin' };
  const origErr = console.error; console.error = () => {};
  let body;
  try {
    const res = await invokeAction(idx, hash, 'boom',
      new Request('http://x/__webjs/action/' + hash + '/boom',
        { method: 'POST', headers, body: await wjStringify([]) }));
    assert.equal(res.status, 500);
    body = wjParse(await res.text());
  } finally { console.error = origErr; }
  assert.equal(body.error, 'Internal server error', `[${runtime}] generic message`);
  assert.ok(typeof body.digest === 'string' && body.digest.length >= 6, `[${runtime}] digest present`);
  assert.ok(!JSON.stringify(body).includes('users_email_key'), `[${runtime}] no raw message leak`);
}

// Streaming path: prod mid-stream throw is sanitized in the error frame.
{
  async function* gen() { yield 1; throw new Error(SECRET); }
  const origErr = console.error; console.error = () => {};
  let text;
  try {
    text = await streamActionResponse(gen(), { dev: false }).text();
  } finally { console.error = origErr; }
  assert.ok(text.includes('Internal server error'), `[${runtime}] streaming generic message`);
  assert.ok(/digest=/.test(text), `[${runtime}] streaming digest`);
  assert.ok(!text.includes('users_email_key'), `[${runtime}] streaming no raw leak`);
}

console.log(`[action-error] #749 sanitization OK on ${runtime}`);
