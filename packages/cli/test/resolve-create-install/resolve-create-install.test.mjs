/**
 * Unit tests for resolveCreateInstall (#682): the per-runtime create-time
 * install default. Node installs (needs node_modules); Bun skips (zero-install,
 * `bun run dev` resolves on the fly). Explicit flags override.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreateInstall } from '../../lib/create.js';

const withUA = (ua, fn) => {
  const prev = process.env.npm_config_user_agent;
  if (ua === null) delete process.env.npm_config_user_agent;
  else process.env.npm_config_user_agent = ua;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = prev;
  }
};

test('Node (explicit runtime) installs by default', () => {
  assert.equal(resolveCreateInstall({ runtime: 'node' }), true);
});

test('Bun (explicit runtime) skips install by default', () => {
  assert.equal(resolveCreateInstall({ runtime: 'bun' }), false);
});

test('--install forces install on Bun', () => {
  assert.equal(resolveCreateInstall({ runtime: 'bun', explicitInstall: true }), true);
});

test('--no-install skips install on Node', () => {
  assert.equal(resolveCreateInstall({ runtime: 'node', noInstall: true }), false);
});

test('no runtime + bun user-agent (bun create) auto-detects bun -> skip', () => {
  withUA('bun/1.3.14', () => assert.equal(resolveCreateInstall({}), false));
});

test('no runtime + npm user-agent -> Node default -> install', () => {
  withUA('npm/10.0.0 node/v24.0.0', () => assert.equal(resolveCreateInstall({}), true));
});

test('explicit flags win over the auto-detected runtime', () => {
  withUA('bun/1.3.14', () => assert.equal(resolveCreateInstall({ explicitInstall: true }), true));
  withUA('npm/10.0.0', () => assert.equal(resolveCreateInstall({ noInstall: true }), false));
});
