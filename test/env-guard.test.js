/**
 * Tests for the runtime env guard. The proxy installed at module load
 * by env-guard.js (transitively imported via render-server.js) replaces
 * process.env with a filtering Proxy that hides non-public keys when
 * accessed inside a component render context.
 *
 * Outside that context, process.env behaves normally with full
 * server-side access. Inside the context, only WEBJS_PUBLIC_* and
 * NODE_ENV keys return values; everything else reads as undefined.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { withComponentRender } from '../packages/core/src/env-guard.js';

const SAVED = {};
const KEYS = ['WEBJS_PUBLIC_API_URL', 'DATABASE_URL', 'AUTH_SECRET'];

before(() => {
  for (const k of KEYS) SAVED[k] = process.env[k];
  process.env.WEBJS_PUBLIC_API_URL = 'https://api.example.test';
  process.env.DATABASE_URL = 'postgres://secret';
  process.env.AUTH_SECRET = 'do-not-leak';
});

after(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
});

/* -------------------- Outside render scope -------------------- */

test('outside render scope: all env vars pass through normally', () => {
  assert.equal(process.env.WEBJS_PUBLIC_API_URL, 'https://api.example.test');
  assert.equal(process.env.DATABASE_URL, 'postgres://secret');
  assert.equal(process.env.AUTH_SECRET, 'do-not-leak');
});

test('outside render scope: Object.keys returns all env keys', () => {
  const keys = Object.keys(process.env);
  assert.ok(keys.includes('WEBJS_PUBLIC_API_URL'));
  assert.ok(keys.includes('DATABASE_URL'));
  assert.ok(keys.includes('AUTH_SECRET'));
});

test("outside render scope: 'in' operator works for any key", () => {
  assert.ok('DATABASE_URL' in process.env);
  assert.ok('AUTH_SECRET' in process.env);
});

/* -------------------- Inside render scope -------------------- */

test('inside render scope: non-public env vars read as undefined', async () => {
  await withComponentRender(() => {
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(process.env.AUTH_SECRET, undefined);
  });
});

test('inside render scope: WEBJS_PUBLIC_* vars are accessible', async () => {
  await withComponentRender(() => {
    assert.equal(process.env.WEBJS_PUBLIC_API_URL, 'https://api.example.test');
  });
});

test('inside render scope: NODE_ENV is accessible', async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test-value';
  try {
    await withComponentRender(() => {
      assert.equal(process.env.NODE_ENV, 'test-value');
    });
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});

test('inside render scope: dynamic bracket access also filters', async () => {
  await withComponentRender(() => {
    const dynKey = 'DATABASE_URL';
    assert.equal(process.env[dynKey], undefined);
    const publicKey = 'WEBJS_PUBLIC_API_URL';
    assert.equal(process.env[publicKey], 'https://api.example.test');
  });
});

test('inside render scope: destructuring only picks up public keys', async () => {
  await withComponentRender(() => {
    const env = { ...process.env };
    assert.equal(env.WEBJS_PUBLIC_API_URL, 'https://api.example.test');
    assert.equal(env.DATABASE_URL, undefined);
    assert.equal(env.AUTH_SECRET, undefined);
  });
});

test('inside render scope: Object.keys filters to public keys only', async () => {
  await withComponentRender(() => {
    const keys = Object.keys(process.env);
    assert.ok(keys.includes('WEBJS_PUBLIC_API_URL'));
    assert.equal(keys.includes('DATABASE_URL'), false);
    assert.equal(keys.includes('AUTH_SECRET'), false);
  });
});

test("inside render scope: 'in' operator returns false for non-public keys", async () => {
  await withComponentRender(() => {
    assert.equal('DATABASE_URL' in process.env, false);
    assert.equal('AUTH_SECRET' in process.env, false);
    assert.equal('WEBJS_PUBLIC_API_URL' in process.env, true);
  });
});

/* -------------------- Async propagation -------------------- */

test('async work inside render scope still sees filtered env', async () => {
  await withComponentRender(async () => {
    await new Promise((r) => setTimeout(r, 1));
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(process.env.WEBJS_PUBLIC_API_URL, 'https://api.example.test');
  });
});

test('helper function called from render scope inherits the context', async () => {
  function helper() {
    return process.env.AUTH_SECRET;
  }
  await withComponentRender(() => {
    assert.equal(helper(), undefined);
  });
  // Outside scope, the same helper sees the real value
  assert.equal(helper(), 'do-not-leak');
});

/* -------------------- Scope leakage -------------------- */

test('render scope ends when the callback returns: env access fully restored', async () => {
  await withComponentRender(() => {
    assert.equal(process.env.DATABASE_URL, undefined);
  });
  // After the scope ends, full access is back
  assert.equal(process.env.DATABASE_URL, 'postgres://secret');
});

test('parallel render scopes do not leak into the outer context', async () => {
  // Two parallel renders. Each only sees its own scope.
  const a = withComponentRender(async () => {
    await new Promise((r) => setTimeout(r, 5));
    return process.env.DATABASE_URL;
  });
  const b = withComponentRender(async () => {
    await new Promise((r) => setTimeout(r, 2));
    return process.env.AUTH_SECRET;
  });
  // Outside both scopes, full access still works during the await
  assert.equal(process.env.DATABASE_URL, 'postgres://secret');
  const [resA, resB] = await Promise.all([a, b]);
  assert.equal(resA, undefined);
  assert.equal(resB, undefined);
});
