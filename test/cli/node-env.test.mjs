/**
 * The NODE_ENV each CLI command defaults to (#1686): `webjs test` runs as test,
 * but a server a test boots with `webjs start` still runs as production, and an
 * explicit NODE_ENV from the shell is never replaced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultNodeEnv, TEST_DEFAULT_MARKER } from '../../packages/cli/lib/node-env.js';

test('each command defaults NODE_ENV only when the shell set none', () => {
  for (const [mode, want] of [['development', 'development'], ['production', 'production'], ['test', 'test']]) {
    const env = {};
    defaultNodeEnv(env, mode);
    assert.equal(env.NODE_ENV, want);
  }
  const env = { NODE_ENV: 'staging' };
  defaultNodeEnv(env, 'production');
  assert.equal(env.NODE_ENV, 'staging', 'a shell value wins');
});

test('a server a test run boots is production again, not the run\'s test default', () => {
  const env = {};
  defaultNodeEnv(env, 'test'); // webjs test
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env[TEST_DEFAULT_MARKER], '1', 'the default is marked');
  const child = { ...env }; // what a spawned `npm start` inherits
  defaultNodeEnv(child, 'production'); // webjs start
  assert.equal(child.NODE_ENV, 'production', 'start runs as production');
  assert.equal(child[TEST_DEFAULT_MARKER], undefined, 'and drops the marker');
  const dev = { ...env };
  defaultNodeEnv(dev, 'development'); // webjs dev
  assert.equal(dev.NODE_ENV, 'development');
});

test('an explicit NODE_ENV=test from the shell is kept by start', () => {
  const env = { NODE_ENV: 'test' };
  defaultNodeEnv(env, 'test'); // webjs test, NODE_ENV already set
  assert.equal(env[TEST_DEFAULT_MARKER], undefined, 'no marker on a shell value');
  defaultNodeEnv(env, 'production'); // webjs start
  assert.equal(env.NODE_ENV, 'test', 'the shell asked for test');
});

test('a nested webjs test keeps the test default', () => {
  const env = {};
  defaultNodeEnv(env, 'test');
  defaultNodeEnv(env, 'test');
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env[TEST_DEFAULT_MARKER], '1');
});
