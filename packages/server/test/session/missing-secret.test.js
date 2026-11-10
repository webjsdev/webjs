/**
 * A missing secret names the variable and where it goes. An agent building
 * sign-in on the scaffold read "requires secret option or SESSION_SECRET env
 * var" while the example env file marked a different variable required, and
 * had to work out which one session() wanted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { session } from '../../src/session.js';
import { createAuth } from '../../src/auth.js';
import { devSecret } from '../../src/dev-secret.js';

/** Run fn with the given env overrides and cwd, restoring both. */
function withEnv(vars, cwd, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  const prevCwd = process.cwd();
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  if (cwd) process.chdir(cwd);
  try { return fn(); } finally {
    process.chdir(prevCwd);
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

test('in production, session() without a secret says to set SESSION_SECRET in .env', () => {
  withEnv({ SESSION_SECRET: undefined, NODE_ENV: 'production' }, null, () => {
    assert.throws(() => session(), /SESSION_SECRET in \.env/);
  });
});

test('in production, createAuth() without a secret says to set AUTH_SECRET in .env', () => {
  withEnv({ AUTH_SECRET: undefined, NODE_ENV: 'production' }, null, () => {
    assert.throws(() => createAuth({ providers: [] }), /AUTH_SECRET in \.env/);
  });
});

test('with NODE_ENV unset (an embedded host, node server.js) a missing secret still throws', () => {
  // The generated secret is opt-in: a production process that simply forgot
  // NODE_ENV must not sign its cookies with a key from disk.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-secret-'));
  try {
    withEnv({ SESSION_SECRET: undefined, AUTH_SECRET: undefined, NODE_ENV: undefined }, dir, () => {
      assert.throws(() => session(), /SESSION_SECRET in \.env/);
      assert.throws(() => createAuth({ providers: [] }), /AUTH_SECRET in \.env/);
    });
    assert.equal(devSecret('X', { dir, env: {} }), undefined, 'no NODE_ENV: no secret');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('in development and tests a missing secret is generated once into .webjs/dev-secret and reused (#1686)', () => {
  // A fresh clone or a worktree has no .env, and every page behind session()
  // or createAuth() used to answer 500 until someone wrote one.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-secret-'));
  try {
    withEnv({ SESSION_SECRET: undefined, AUTH_SECRET: undefined, NODE_ENV: 'development' }, dir, () => {
      assert.doesNotThrow(() => session());
      assert.doesNotThrow(() => createAuth({ providers: [] }));
      const stored = readFileSync(join(dir, '.webjs', 'dev-secret'), 'utf8').trim();
      assert.match(stored, /^[0-9a-f]{64}$/, 'a 32-byte hex secret is persisted');
      assert.equal(devSecret('SESSION_SECRET'), stored, 'a restart reads the same secret back');
    });
    assert.ok(devSecret('X', { dir, env: { NODE_ENV: 'test' } }), 'a test process gets it too');
    assert.equal(devSecret('X', { dir, env: { NODE_ENV: 'production' } }), undefined, 'never in production');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('createAuth() reads AUTH_SECRET when no secret is passed, as Auth.js does', async () => {
  // Two agents wrote createAuth({ secret: process.env.AUTH_SECRET }) and hit a
  // string | undefined type error; Auth.js reads the variable itself.
  const saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'from-the-environment-0123456789';
  try {
    const { signIn } = createAuth({ providers: [{ id: 'credentials', type: 'credentials', authorize: async () => ({ id: '1' }) }] });
    const res = await signIn('credentials', {}, { redirectTo: '/x' });
    assert.equal(res.status, 302, 'signs a session with the environment secret');
    assert.match(res.headers.get('set-cookie') || '', /webjs\.auth=/);
  } finally {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
  }
});

test('a dev request handler earlier in the process opts nothing in (NODE_ENV alone decides)', async () => {
  // A latch set by createRequestHandler({ dev: true }) would also have covered
  // a production handler created later in the same process with NODE_ENV unset.
  const { createRequestHandler } = await import('../../src/dev.js');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-secret-latch-'));
  try {
    mkdirSync(join(dir, 'app'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'latch', type: 'module' }));
    await createRequestHandler({ appDir: dir, dev: true, logger: { info() {}, warn() {}, error() {}, debug() {} } });
    withEnv({ SESSION_SECRET: undefined, AUTH_SECRET: undefined, NODE_ENV: undefined }, dir, () => {
      assert.throws(() => session(), /SESSION_SECRET in \.env/, 'session() still throws');
      assert.throws(() => createAuth({ providers: [] }), /AUTH_SECRET in \.env/, 'and so does createAuth()');
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
