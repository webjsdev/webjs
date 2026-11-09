/**
 * `webjs create` writes a gitignored `.env` with fresh secrets, the way
 * `rails new` writes its secret key. `session()` and `createAuth()` both refuse
 * to run without theirs, and an agent building on the scaffold had to work out
 * which variable `session()` wanted, then hand-write a `.env`, before its first
 * signed-in request worked.
 *
 * Counterfactual: drop the `.env` write from `scaffoldApp()` in
 * `packages/cli/lib/create.js` and the first case fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

async function scaffold(opts = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-env-secrets-'));
  const log = console.log;
  console.log = () => {};
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack', install: false, ...opts });
  } finally {
    console.log = log;
  }
  return { cwd, app: join(cwd, 'demo') };
}

const keys = (text) => [...text.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]).sort();
const value = (text, key) => (text.match(new RegExp(`^${key}=(.*)$`, 'm')) || [])[1];

test('the scaffold writes .env with two distinct generated secrets', async () => {
  const { cwd, app } = await scaffold();
  try {
    const env = await readFile(join(app, '.env'), 'utf8');
    const example = await readFile(join(app, '.env.example'), 'utf8');
    const auth = value(env, 'AUTH_SECRET');
    const sess = value(env, 'SESSION_SECRET');
    assert.match(auth, /^[0-9a-f]{64}$/, 'AUTH_SECRET is 32 random bytes in hex');
    assert.match(sess, /^[0-9a-f]{64}$/, 'SESSION_SECRET is 32 random bytes in hex');
    assert.notEqual(auth, sess, 'each secret is generated on its own');
    assert.equal(value(example, 'AUTH_SECRET'), '', 'the committed example carries no secret');
    assert.equal(value(example, 'SESSION_SECRET'), '', 'the committed example carries no secret');
    assert.deepEqual(keys(env), keys(example), '.env declares exactly the keys .env.example does (no doctor drift)');
    assert.match(await readFile(join(app, '.gitignore'), 'utf8'), /^\.env$/m, '.env is never committed');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('every scaffold gets its own secrets', async () => {
  const a = await scaffold();
  const b = await scaffold({ db: 'postgres' });
  try {
    const envA = await readFile(join(a.app, '.env'), 'utf8');
    const envB = await readFile(join(b.app, '.env'), 'utf8');
    assert.notEqual(value(envA, 'AUTH_SECRET'), value(envB, 'AUTH_SECRET'));
    assert.match(value(envB, 'DATABASE_URL'), /^postgres:\/\//, 'the Postgres .env carries the dialect URL');
  } finally {
    await rm(a.cwd, { recursive: true, force: true });
    await rm(b.cwd, { recursive: true, force: true });
  }
});
