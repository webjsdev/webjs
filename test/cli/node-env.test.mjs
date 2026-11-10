/**
 * The NODE_ENV each CLI command defaults to (#1686): dev is development, start
 * production and test test, each only when none is set, and a set value is
 * always kept (`next start`'s rule). A process a test spawns inherits the
 * run's test, as under Jest, and the generated dev secret follows NODE_ENV
 * alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultNodeEnv } from '../../packages/cli/lib/node-env.js';
import { devSecretApplies } from '../../packages/server/src/dev-secret.js';

test('each command defaults NODE_ENV only when none is set', () => {
  for (const mode of ['development', 'production', 'test']) {
    const env = {};
    defaultNodeEnv(env, mode);
    assert.equal(env.NODE_ENV, mode);
  }
});

test('a set value is always kept, as next start keeps one', () => {
  const shell = { NODE_ENV: 'staging' };
  defaultNodeEnv(shell, 'production');
  assert.equal(shell.NODE_ENV, 'staging');
  // A test that wants a production server says so on the child.
  const child = { NODE_ENV: 'production' };
  defaultNodeEnv(child, 'test');
  assert.equal(child.NODE_ENV, 'production');
});

test("a webjs start a test spawns inherits the run's test, as under Jest", () => {
  const run = {};
  defaultNodeEnv(run, 'test'); // webjs test
  const child = { ...run }; // spawn('webjs start', { env: process.env })
  defaultNodeEnv(child, 'production'); // webjs start
  assert.equal(child.NODE_ENV, 'test');
});

test('the generated dev secret follows NODE_ENV alone', () => {
  assert.equal(devSecretApplies({ NODE_ENV: 'development' }), true);
  assert.equal(devSecretApplies({ NODE_ENV: 'test' }), true);
  assert.equal(devSecretApplies({}), false, 'no NODE_ENV: an embedded host, node server.js');
  assert.equal(devSecretApplies({ NODE_ENV: 'production' }), false);
  assert.equal(devSecretApplies({ __WEBJS_TEST_RUN: '1' }), false, 'no environment flag besides NODE_ENV opts in');
});
