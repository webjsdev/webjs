/**
 * The form-action flash key follows NODE_ENV on every call (review of PR #1687).
 * It used to keep the first dev-secret answer for the whole process, so a flash
 * signed before NODE_ENV was set pinned the random per-process key for good,
 * and after a restart the process could not verify a flash signed with the
 * persisted dev secret. Its own file, so no earlier test has warmed the key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

import { encodeFlash } from '../../src/action-flash.js';

test('a flash signed before NODE_ENV was set does not pin the random key', async () => {
  const saved = { cwd: process.cwd(), W: process.env.WEBJS_SECRET, A: process.env.AUTH_SECRET, S: process.env.SESSION_SECRET, N: process.env.NODE_ENV };
  const dir = mkdtempSync(join(tmpdir(), 'webjs-flash-key-'));
  delete process.env.WEBJS_SECRET; delete process.env.AUTH_SECRET; delete process.env.SESSION_SECRET;
  delete process.env.NODE_ENV;
  process.chdir(dir);
  try {
    // Signed with no NODE_ENV: the random per-process key (no dev secret).
    const before = await encodeFlash({ id: 'h/fn', result: { n: 1 }, shown: false });
    assert.ok(before);
    // Then the process says it is in development.
    process.env.NODE_ENV = 'development';
    const value = await encodeFlash({ id: 'h/fn', result: { n: 2 }, shown: false });
    const secret = readFileSync(join(dir, '.webjs', 'dev-secret'), 'utf8').trim();
    const dot = value.lastIndexOf('.');
    const body = value.slice(0, dot);
    const want = createHmac('sha256', secret).update(`webjs-flash:${body}`).digest('base64url');
    assert.equal(value.slice(dot + 1), want, 'signed with the persisted dev secret, which a restarted process also reads');
  } finally {
    process.chdir(saved.cwd);
    rmSync(dir, { recursive: true, force: true });
    for (const [k, v] of [['WEBJS_SECRET', saved.W], ['AUTH_SECRET', saved.A], ['SESSION_SECRET', saved.S], ['NODE_ENV', saved.N]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
