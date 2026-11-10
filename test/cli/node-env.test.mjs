/**
 * The NODE_ENV each CLI command defaults to (#1686). `webjs dev` and
 * `webjs start` default only when NODE_ENV is unset; `webjs test` sets none
 * and marks the run, so neither a server a test boots nor a child a test
 * spawns with NODE_ENV=test is overridden, and the generated dev secret still
 * applies inside the run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultNodeEnv, markTestRun, TEST_RUN_ENV } from '../../packages/cli/lib/node-env.js';
import { devSecretApplies } from '../../packages/server/src/dev-secret.js';

test('dev and start default NODE_ENV only when none is set', () => {
  const dev = {};
  defaultNodeEnv(dev, 'development');
  assert.equal(dev.NODE_ENV, 'development');
  const start = {};
  defaultNodeEnv(start, 'production');
  assert.equal(start.NODE_ENV, 'production');
  const shell = { NODE_ENV: 'staging' };
  defaultNodeEnv(shell, 'production');
  assert.equal(shell.NODE_ENV, 'staging', 'a set value wins');
});

test('webjs test sets no NODE_ENV and marks the run', () => {
  const env = {};
  markTestRun(env);
  assert.equal(env.NODE_ENV, undefined);
  assert.equal(env[TEST_RUN_ENV], '1');
});

test('a webjs start a test boots runs as production', () => {
  const run = {};
  markTestRun(run);
  const child = { ...run }; // spawn('webjs start', { env: process.env })
  defaultNodeEnv(child, 'production');
  assert.equal(child.NODE_ENV, 'production');
  assert.equal(devSecretApplies(child), false, 'and never uses the generated dev secret');
});

test('a child a test spawns with NODE_ENV=test keeps it', () => {
  const run = {};
  markTestRun(run);
  const child = { ...run, NODE_ENV: 'test' }; // spawn('webjs start', { env: { ...process.env, NODE_ENV: 'test' } })
  defaultNodeEnv(child, 'production');
  assert.equal(child.NODE_ENV, 'test', 'the value it asked for');
});

test('the dev secret applies in development, in tests, and inside a test run with no NODE_ENV', () => {
  assert.equal(devSecretApplies({ NODE_ENV: 'development' }), true);
  assert.equal(devSecretApplies({ NODE_ENV: 'test' }), true);
  assert.equal(devSecretApplies({ [TEST_RUN_ENV]: '1' }), true, 'app tests under webjs test');
  assert.equal(devSecretApplies({}), false, 'a process with no NODE_ENV outside a test run');
  assert.equal(devSecretApplies({ NODE_ENV: 'production', [TEST_RUN_ENV]: '1' }), false, 'production never');
});
