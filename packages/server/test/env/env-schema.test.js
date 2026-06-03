/**
 * Tests for boot-time env-var validation (issue #236).
 *
 * Two layers:
 *   1. PURE unit tests of `validateEnv` / `formatEnvErrors` with injected
 *      schema + env objects (required vs optional, all types, coercion,
 *      defaults, multiple-error aggregation, the function escape hatch).
 *   2. INTEGRATION tests through `createRequestHandler` with a temp app dir
 *      carrying an `env.ts` fixture (valid passes; an invalid env makes boot
 *      throw a clear aggregated message; an absent env.ts is a no-op; defaults
 *      land in process.env). Plus the COUNTERFACTUAL: with the env.ts fixture
 *      but no missing var the boot succeeds, and removing the required var
 *      fails it (so the validation is load-bearing).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  validateEnv,
  formatEnvErrors,
  loadEnvSchema,
  applyEnvValidation,
} from '../../src/env-schema.js';
import { createRequestHandler } from '../../src/dev.js';

// --- Pure validator unit tests --------------------------------------------

test('valid env passes against an object schema', () => {
  const schema = {
    DATABASE_URL: 'string',
    AUTH_SECRET: { type: 'string', required: true, minLength: 16 },
  };
  const env = { DATABASE_URL: 'file:./dev.db', AUTH_SECRET: 'x'.repeat(32) };
  const r = validateEnv(schema, env);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('a missing required var fails with a message naming it', () => {
  const r = validateEnv({ DATABASE_URL: 'string' }, {});
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /DATABASE_URL/);
  assert.match(r.errors[0], /required/);
});

test('ALL errors are reported, not just the first', () => {
  const schema = {
    DATABASE_URL: 'string',
    AUTH_SECRET: { type: 'string', minLength: 16 },
    PORT: 'number',
  };
  const env = { AUTH_SECRET: 'short', PORT: 'not-a-number' };
  const r = validateEnv(schema, env);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 3, 'one error per offending var');
  assert.ok(r.errors.some((e) => /DATABASE_URL/.test(e) && /required/.test(e)));
  assert.ok(r.errors.some((e) => /AUTH_SECRET/.test(e) && /16 characters/.test(e)));
  assert.ok(r.errors.some((e) => /PORT/.test(e) && /number/.test(e)));
});

test('an optional var may be absent', () => {
  const r = validateEnv({ FEATURE_FLAG: { type: 'string', optional: true } }, {});
  assert.equal(r.ok, true);
  assert.equal('FEATURE_FLAG' in r.coerced, false);
});

test('number coercion + default', () => {
  const schema = { PORT: { type: 'number', optional: true, default: 3000 } };
  // present + valid -> coerced (stringified for process.env)
  const present = validateEnv(schema, { PORT: '8080' });
  assert.equal(present.ok, true);
  assert.equal(present.coerced.PORT, '8080');
  // absent -> default applied
  const absent = validateEnv(schema, {});
  assert.equal(absent.ok, true);
  assert.equal(absent.coerced.PORT, '3000');
});

test('boolean coercion accepts the documented truthy/falsy spellings', () => {
  const schema = { ENABLED: 'boolean' };
  for (const v of ['1', 'true', 'YES', 'on']) {
    assert.equal(validateEnv(schema, { ENABLED: v }).coerced.ENABLED, 'true', v);
  }
  for (const v of ['0', 'false', 'No', 'off']) {
    assert.equal(validateEnv(schema, { ENABLED: v }).coerced.ENABLED, 'false', v);
  }
  const bad = validateEnv(schema, { ENABLED: 'maybe' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /boolean/);
});

test('url type validates a real URL', () => {
  const schema = { API_URL: 'url' };
  assert.equal(validateEnv(schema, { API_URL: 'https://api.example.com' }).ok, true);
  const bad = validateEnv(schema, { API_URL: 'not a url' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /valid URL/);
});

test('enum type rejects a value outside the set and names the options', () => {
  const schema = { NODE_ENV: { type: 'enum', values: ['development', 'production', 'test'] } };
  assert.equal(validateEnv(schema, { NODE_ENV: 'production' }).ok, true);
  const bad = validateEnv(schema, { NODE_ENV: 'staging' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /"development", "production", "test"/);
});

test('SECURITY: a failing value is NEVER echoed into the error message', () => {
  // A secret given the wrong type (a common misconfiguration) must not have its
  // raw value leaked into boot logs. Every typed path (number/boolean/url/enum)
  // names the var + the problem but redacts the value.
  const secret = 'super-secret-token-value';

  // AUTH_SECRET (a real secret) mistakenly typed as url.
  const asUrl = validateEnv({ AUTH_SECRET: 'url' }, { AUTH_SECRET: secret });
  assert.equal(asUrl.ok, false);
  assert.match(asUrl.errors[0], /AUTH_SECRET/, 'still names the offending var');
  assert.equal(asUrl.errors[0].includes(secret), false, 'must not echo the secret');

  // A DATABASE_URL whose password fails url parsing must not dump the DSN.
  // (Use a value new URL() rejects so we exercise the url failure path.)
  const badDsn = 'postgres://admin:hunter2@ db.internal';
  const asDsn = validateEnv({ DATABASE_URL: 'url' }, { DATABASE_URL: badDsn });
  assert.equal(asDsn.ok, false);
  assert.match(asDsn.errors[0], /DATABASE_URL/);
  assert.equal(asDsn.errors[0].includes('hunter2'), false, 'must not echo the password');
  assert.equal(asDsn.errors[0].includes(badDsn), false, 'must not echo the DSN');

  // number / boolean / enum paths redact too.
  const num = validateEnv({ API_KEY: 'number' }, { API_KEY: secret });
  assert.equal(num.errors[0].includes(secret), false);
  const bool = validateEnv({ API_KEY: 'boolean' }, { API_KEY: secret });
  assert.equal(bool.errors[0].includes(secret), false);
  const en = validateEnv({ TIER: { type: 'enum', values: ['free', 'pro'] } }, { TIER: secret });
  assert.equal(en.errors[0].includes(secret), false);
  assert.match(en.errors[0], /"free", "pro"/, 'enum still names the allowed values');

  // And the aggregated message the CLI prints stays clean end to end.
  const msg = formatEnvErrors([...asUrl.errors, ...asDsn.errors]);
  assert.equal(msg.includes(secret), false);
  assert.equal(msg.includes('hunter2'), false);
  assert.match(msg, /AUTH_SECRET/);
  assert.match(msg, /DATABASE_URL/);
});

test('string pattern constraint', () => {
  const schema = { SLUG: { type: 'string', pattern: /^[a-z]+$/ } };
  assert.equal(validateEnv(schema, { SLUG: 'abc' }).ok, true);
  assert.equal(validateEnv(schema, { SLUG: 'AB3' }).ok, false);
});

test('an unknown type is reported as a schema error', () => {
  const r = validateEnv({ X: { type: 'wat' } }, { X: 'y' });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /unknown type/);
});

test('the function escape hatch runs and a throw is surfaced', () => {
  const ok = validateEnv((env) => {
    if (!env.SECRET) throw new Error('SECRET is required by my custom check');
  }, { SECRET: 'present' });
  assert.equal(ok.ok, true);

  const bad = validateEnv((env) => {
    if (!env.SECRET) throw new Error('SECRET is required by my custom check');
  }, {});
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /custom check/);
});

test('formatEnvErrors lists every error in one actionable message', () => {
  const msg = formatEnvErrors(['DATABASE_URL is required but missing', 'PORT must be a number']);
  assert.match(msg, /2 errors/);
  assert.match(msg, /DATABASE_URL/);
  assert.match(msg, /PORT/);
  assert.match(msg, /env\.\{js,ts\}/);
});

// --- loadEnvSchema + applyEnvValidation on a temp dir ----------------------

let tmpRoot;
test.before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-env-'));
});
test.after(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

test('loadEnvSchema returns null when env.{js,ts} is absent', async () => {
  const appDir = makeApp({ 'app/page.ts': `export default () => 'ok';` });
  assert.equal(await loadEnvSchema(appDir), null);
});

test('loadEnvSchema reads the default export', async () => {
  const appDir = makeApp({ 'env.js': `export default { FOO: 'string' };` });
  const schema = await loadEnvSchema(appDir);
  assert.deepEqual(schema, { FOO: 'string' });
});

test('applyEnvValidation writes coerced defaults back into the env object', async () => {
  const appDir = makeApp({
    'env.js': `export default { PORT: { type: 'number', optional: true, default: 4321 } };`,
  });
  const env = {};
  await applyEnvValidation(appDir, { env });
  assert.equal(env.PORT, '4321');
});

test('applyEnvValidation is a no-op without env.{js,ts}', async () => {
  const appDir = makeApp({ 'app/page.ts': `export default () => 'ok';` });
  await applyEnvValidation(appDir, { env: {} }); // must not throw
});

// --- Integration through createRequestHandler ------------------------------

test('createRequestHandler boots when the env schema is satisfied', async () => {
  const appDir = makeApp({
    'app/page.ts': `export default () => 'ok';`,
    'env.ts': `export default { MY_REQUIRED: { type: 'string', minLength: 4 } };`,
  });
  const prev = process.env.MY_REQUIRED;
  process.env.MY_REQUIRED = 'value';
  try {
    const app = await createRequestHandler({ appDir, dev: true });
    assert.equal(typeof app.handle, 'function');
  } finally {
    if (prev === undefined) delete process.env.MY_REQUIRED;
    else process.env.MY_REQUIRED = prev;
  }
});

test('COUNTERFACTUAL: a missing required var makes createRequestHandler throw a clear message', async () => {
  const appDir = makeApp({
    'app/page.ts': `export default () => 'ok';`,
    'env.ts': `export default { MUST_HAVE: { type: 'string', minLength: 4 } };`,
  });
  const prev = process.env.MUST_HAVE;
  delete process.env.MUST_HAVE;
  try {
    await assert.rejects(
      () => createRequestHandler({ appDir, dev: true }),
      (err) => {
        assert.match(err.message, /env validation failed/);
        assert.match(err.message, /MUST_HAVE/);
        assert.match(err.message, /required/);
        return true;
      },
    );
  } finally {
    if (prev !== undefined) process.env.MUST_HAVE = prev;
  }
});

test('createRequestHandler applies a coerced default into process.env at boot', async () => {
  const appDir = makeApp({
    'app/page.ts': `export default () => 'ok';`,
    'env.ts': `export default { WEBJS_TEST_DEFAULTED: { type: 'number', optional: true, default: 7777 } };`,
  });
  const prev = process.env.WEBJS_TEST_DEFAULTED;
  delete process.env.WEBJS_TEST_DEFAULTED;
  try {
    await createRequestHandler({ appDir, dev: true });
    assert.equal(process.env.WEBJS_TEST_DEFAULTED, '7777');
  } finally {
    if (prev === undefined) delete process.env.WEBJS_TEST_DEFAULTED;
    else process.env.WEBJS_TEST_DEFAULTED = prev;
  }
});

test('the function-form validator throw surfaces at boot', async () => {
  const appDir = makeApp({
    'app/page.ts': `export default () => 'ok';`,
    'env.ts': `export default (env) => { if (!env.CUSTOM_REQUIRED) throw new Error('CUSTOM_REQUIRED missing'); };`,
  });
  const prev = process.env.CUSTOM_REQUIRED;
  delete process.env.CUSTOM_REQUIRED;
  try {
    await assert.rejects(
      () => createRequestHandler({ appDir, dev: true }),
      /CUSTOM_REQUIRED missing/,
    );
  } finally {
    if (prev !== undefined) process.env.CUSTOM_REQUIRED = prev;
  }
});
