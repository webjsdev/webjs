/**
 * Prod server-action errors must NOT leak the raw thrown message (#749). In
 * prod the RPC client gets a generic message + a digest; the full error is
 * logged server-side keyed by that digest. Dev keeps the real message + stack.
 * redirect()/notFound() control-flow sentinels pass through unchanged. The
 * streaming error frame is sanitized the same way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildActionIndex, resolveServerModule, invokeAction, RPC_CONTENT_TYPE,
} from '../../src/actions.js';
import { streamActionResponse } from '../../src/action-stream.js';
import { stringify as wjStringify, parse as wjParse } from '../../../core/src/serialize.js';

const SECRET = 'pg: duplicate key value violates unique constraint "users_email_key"';

async function scaffold(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-749-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(join(p, '..'), { recursive: true });
    await writeFile(p, body);
  }
  return dir;
}

const ACTIONS = {
  'actions/boom.server.js': `'use server';
    export async function boom() { throw new Error(${JSON.stringify(SECRET)}); }
    export async function cf() {
      // Mimic redirect()/notFound() without importing core (no node_modules in tmp):
      const e = new Error('webjs: notFound()');
      e.__webjs = Symbol.for('webjs.notFound');
      throw e;
    }
  `,
};

async function callBoom(dir, dev, fn = 'boom') {
  const idx = await buildActionIndex(dir, dev);
  const file = resolveServerModule(idx, '/actions/boom.server.js');
  const hash = idx.fileToHash.get(file);
  const headers = { 'content-type': RPC_CONTENT_TYPE, 'sec-fetch-site': 'same-origin' };
  const res = await invokeAction(idx, hash, fn,
    new Request('http://x/__webjs/action/' + hash + '/' + fn,
      { method: 'POST', headers, body: await wjStringify([]) }));
  return { res, body: wjParse(await res.text()) };
}

test('prod: a thrown action returns a generic message + digest, never the raw message', async () => {
  const dir = await scaffold(ACTIONS);
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a);
  try {
    const { res, body } = await callBoom(dir, false);
    assert.equal(res.status, 500);
    assert.equal(body.error, 'Internal server error', 'client gets the generic message');
    assert.equal(typeof body.digest, 'string');
    assert.ok(body.digest.length >= 6, 'digest present');
    // The counterfactual: the raw DB constraint name must NOT reach the client.
    const wire = JSON.stringify(body);
    assert.ok(!wire.includes('users_email_key'), 'constraint name not leaked');
    assert.ok(!wire.includes('duplicate key'), 'raw message not leaked');
    // The full error IS logged server-side, keyed by the same digest.
    const logged = errs.map((a) => a.map(String).join(' ')).join('\n');
    assert.ok(logged.includes(body.digest), 'server log carries the digest');
    assert.ok(logged.includes('users_email_key'), 'server log carries the full error');
  } finally {
    console.error = orig;
  }
});

test('dev: a thrown action still returns the real message + stack', async () => {
  const dir = await scaffold(ACTIONS);
  const orig = console.error; console.error = () => {};
  try {
    const { res, body } = await callBoom(dir, true);
    assert.equal(res.status, 500);
    assert.ok(body.error.includes('users_email_key'), 'dev surfaces the real message');
    assert.ok(typeof body.stack === 'string' && body.stack.length > 0, 'dev includes the stack');
  } finally {
    console.error = orig;
  }
});

test('prod: a redirect()/notFound() control-flow throw passes through (not genericized)', async () => {
  const dir = await scaffold(ACTIONS);
  const orig = console.error; console.error = () => {};
  try {
    const { res, body } = await callBoom(dir, false, 'cf');
    assert.equal(res.status, 500);
    assert.equal(body.error, 'webjs: notFound()', 'control-flow message preserved');
    assert.equal(body.digest, undefined, 'no digest for a control-flow sentinel');
  } finally {
    console.error = orig;
  }
});

test('streaming: prod mid-stream throw ships a generic message + digest, not the raw one', async () => {
  const orig = console.error; const errs = []; console.error = (...a) => errs.push(a);
  try {
    async function* gen() { yield 1; throw new Error(SECRET); }
    const resProd = streamActionResponse(gen(), { dev: false });
    const textProd = await resProd.text();
    assert.ok(textProd.includes('Internal server error'), 'generic message in the error frame');
    assert.ok(/digest=/.test(textProd), 'digest in the error frame');
    assert.ok(!textProd.includes('users_email_key'), 'raw message not in the stream');

    async function* gen2() { yield 1; throw new Error(SECRET); }
    const resDev = streamActionResponse(gen2(), { dev: true });
    const textDev = await resDev.text();
    assert.ok(textDev.includes('users_email_key'), 'dev surfaces the real message in the frame');
  } finally {
    console.error = orig;
  }
});
