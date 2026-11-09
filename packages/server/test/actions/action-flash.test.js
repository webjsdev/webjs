/**
 * The form-action flash cookie (action-flash.js): signed, round-trips a rich
 * result, rejects a signature made over the bare body (the input is
 * domain-separated from other HMACs sharing AUTH_SECRET), and warns once in
 * production when it has to fall back to a per-process key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { encodeFlash, decodeFlash } from '../../src/action-flash.js';

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  const restore = () => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  return Promise.resolve().then(fn).finally(restore);
}

test('without a secret in production it warns once, naming WEBJS_SECRET', async () => {
  const warned = [];
  const original = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    await withEnv({ NODE_ENV: 'production', WEBJS_SECRET: undefined, AUTH_SECRET: undefined }, async () => {
      await encodeFlash({ id: 'a/b', result: { ok: 1 }, shown: false });
      await encodeFlash({ id: 'a/b', result: { ok: 2 }, shown: false });
    });
  } finally {
    console.warn = original;
  }
  assert.equal(warned.length, 1, 'once per process, not per flash');
  assert.match(warned[0], /WEBJS_SECRET/);
});

test('a flash round-trips its rich result, and a bare-body signature is rejected', async () => {
  await withEnv({ WEBJS_SECRET: 'test-secret' }, async () => {
    const value = await encodeFlash({ id: 'h/save', result: { at: new Date(0), n: 2 }, shown: false });
    const back = await decodeFlash(value);
    assert.equal(back.id, 'h/save');
    assert.ok(back.result.at instanceof Date);
    assert.equal(back.result.n, 2);

    const body = value.slice(0, value.lastIndexOf('.'));
    const bare = createHmac('sha256', 'test-secret').update(body).digest('base64url');
    assert.equal(await decodeFlash(`${body}.${bare}`), null, 'an HMAC over the unprefixed body is not a flash signature');
  });
});
