/**
 * The Bun-shell timeout mapping (#663). On Bun, the server listener maps the
 * configured node `requestTimeout` (ms, three-field on node:http) onto
 * Bun.serve's single `idleTimeout` (seconds). This pure mapping is the part
 * that can diverge across runtimes (Math.ceil + the clamps run on JSC vs V8),
 * so it carries a unit test that the Bun matrix re-runs under bun. The wiring
 * (startBunListener passing the result into Bun.serve) is asserted on the Bun
 * shell by test/bun/timeouts.mjs.
 *
 * The node:http side (server.requestTimeout / headersTimeout / keepAliveTimeout)
 * is covered by server-timeouts.test.js; that file is node-only and denylisted
 * from the Bun matrix, which is exactly the gap this test closes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bunIdleTimeout } from '../../src/listener-bun.js';
import { DEFAULT_REQUEST_TIMEOUT_MS } from '../../src/body-limit.js';

test('no config maps to the 30s default (matches DEFAULT_REQUEST_TIMEOUT_MS)', () => {
  assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 30_000);
  assert.equal(bunIdleTimeout(undefined), 30);
  assert.equal(bunIdleTimeout({}), 30);
});

test('an explicit requestTimeout converts ms to whole seconds', () => {
  assert.equal(bunIdleTimeout({ requestTimeout: 45_000 }), 45);
  assert.equal(bunIdleTimeout({ requestTimeout: 120_000 }), 120);
});

test('a fractional second rounds UP (ceil), so the idle window is never short', () => {
  assert.equal(bunIdleTimeout({ requestTimeout: 30_500 }), 31);
  assert.equal(bunIdleTimeout({ requestTimeout: 60_001 }), 61);
});

test('a sub-floor timeout clamps to 30s (above the 25s SSE keepalive)', () => {
  // Below the floor a dev live-reload stream would be reaped as idle.
  assert.equal(bunIdleTimeout({ requestTimeout: 10_000 }), 30);
  assert.equal(bunIdleTimeout({ requestTimeout: 1 }), 30);
});

test('an over-ceiling timeout clamps to Bun\'s 255s max', () => {
  assert.equal(bunIdleTimeout({ requestTimeout: 300_000 }), 255);
  assert.equal(bunIdleTimeout({ requestTimeout: 10_000_000 }), 255);
});

test('0 (the node disable sentinel) disables the idle timeout on Bun too', () => {
  assert.equal(bunIdleTimeout({ requestTimeout: 0 }), 0);
});
