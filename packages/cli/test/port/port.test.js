/**
 * Unit tests for the CLI's port resolution + `.env` loading (issue #447).
 *
 * The bug: the CLI read `process.env.PORT || 8080` BEFORE the server ran
 * `process.loadEnvFile('.env')`, so a `PORT` in the project's `.env` never
 * reached the port comparison and the server always bound 8080. These tests
 * prove the precedence `--port` > `PORT` (shell env or `.env`) > 8080, that a
 * `.env` `PORT` is honored for BOTH dev and start, that a real shell `PORT`
 * still works, and the counterfactual: with `.env` NOT loaded (the old
 * ordering) the `.env` port is lost and 8080 wins.
 *
 * Note: `process.loadEnvFile` writes to the REAL native environment, not to a
 * reassigned `process.env` object, so the load-based tests snapshot and
 * restore the specific keys they touch (PORT, DATABASE_URL) rather than
 * swapping `process.env`. They run serially (node:test runs tests in a file
 * sequentially) so the snapshot/restore is safe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadAppEnv, resolvePort } from '../../lib/port.js';

/** Make a throwaway app dir containing a `.env` with the given body. */
function appWithEnvFile(body) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-port-'));
  if (body !== null) writeFileSync(join(dir, '.env'), body);
  return dir;
}

/**
 * Snapshot the given env keys, run `fn`, then restore them to their exact
 * prior state (including "was unset"). loadEnvFile mutates the real
 * process.env, so this keeps a test from leaking PORT into its neighbors.
 */
function withRealEnv(keys, fn) {
  const snapshot = {};
  for (const k of keys) snapshot[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  }
}

test('resolvePort: precedence --port > PORT > 8080', () => {
  // --port wins over everything.
  assert.equal(resolvePort('9000', { PORT: '8090' }), 9000);
  assert.equal(resolvePort('9000', {}), 9000);
  // PORT (env or .env, both land in process.env) beats the default.
  assert.equal(resolvePort(undefined, { PORT: '8090' }), 8090);
  // Nothing set falls back to 8080.
  assert.equal(resolvePort(undefined, {}), 8080);
});

test('resolvePort: bad input surfaces as NaN, matching the old Number(...)', () => {
  assert.ok(Number.isNaN(resolvePort('not-a-port', {})));
  assert.ok(Number.isNaN(resolvePort(undefined, { PORT: 'abc' })));
});

test('loadAppEnv: a PORT in .env lands in process.env and resolves (the dev + start path)', () => {
  const dir = appWithEnvFile('PORT=8090\nDATABASE_URL=file:./dev.db\n');
  withRealEnv(['PORT', 'DATABASE_URL'], () => {
    delete process.env.PORT; // ensure no shell PORT shadows the .env value
    loadAppEnv(dir);
    assert.equal(process.env.PORT, '8090', '.env PORT loaded into process.env');
    // Both `dev` and `start` resolve the port the same way after the load.
    assert.equal(resolvePort(undefined), 8090, 'dev/start honor .env PORT');
    // --port still overrides the .env value.
    assert.equal(resolvePort('9000'), 9000, '--port overrides .env PORT');
  });
  rmSync(dir, { recursive: true, force: true });
});

test('loadAppEnv: a real shell PORT is NOT clobbered by .env (loadEnvFile semantics)', () => {
  const dir = appWithEnvFile('PORT=8090\n');
  withRealEnv(['PORT'], () => {
    // Shell already exported PORT=7000; the .env value must not override it.
    process.env.PORT = '7000';
    loadAppEnv(dir);
    assert.equal(process.env.PORT, '7000', 'shell PORT wins over .env PORT');
    assert.equal(resolvePort(undefined), 7000);
  });
  rmSync(dir, { recursive: true, force: true });
});

test('loadAppEnv: no .env present is a silent no-op (port falls back to 8080)', () => {
  const dir = appWithEnvFile(null); // dir with NO .env file
  withRealEnv(['PORT'], () => {
    delete process.env.PORT;
    loadAppEnv(dir); // must not throw
    assert.equal(process.env.PORT, undefined);
    assert.equal(resolvePort(undefined), 8080);
  });
  rmSync(dir, { recursive: true, force: true });
});

test('webjs.js loads .env before resolving the port, for BOTH dev and start', async () => {
  // Structural pin against the #447 regression: if a future edit moves the
  // port read back ahead of loadAppEnv (or drops the load), the .env PORT is
  // lost again. Assert both code paths call loadAppEnv() before resolvePort()
  // and that neither still reads the pre-load `process.env.PORT || 8080`.
  const { readFile } = await import('node:fs/promises');
  const binPath = new URL('../../bin/webjs.js', import.meta.url);
  const src = await readFile(binPath, 'utf8');

  // The old buggy expression must be gone from both branches.
  assert.ok(
    !/process\.env\.PORT\s*\|\|\s*8080/.test(src),
    'the pre-load `process.env.PORT || 8080` read must not return',
  );
  // Both commands resolve via the shared helper.
  const resolveCount = (src.match(/resolvePort\(/g) || []).length;
  assert.equal(resolveCount, 2, 'dev + start both call resolvePort');
  // Each resolvePort call is preceded by a loadAppEnv call (ordering matters).
  for (const m of src.matchAll(/resolvePort\(/g)) {
    const before = src.slice(0, m.index);
    assert.ok(
      before.lastIndexOf('loadAppEnv(') !== -1,
      'loadAppEnv must run before resolvePort',
    );
  }
});

test('COUNTERFACTUAL: the old ordering (resolve before loading .env) loses the .env PORT', () => {
  // This pins the actual bug. With the fix REVERTED, the CLI resolved the
  // port from process.env BEFORE .env was loaded, so a .env-only PORT was
  // invisible and 8080 won. Simulate that ordering: resolve first (against an
  // env without PORT), load second. The buggy order yields 8080; the fixed
  // order (load then resolve) yields 8090 from the same .env.
  const dir = appWithEnvFile('PORT=8090\n');
  withRealEnv(['PORT'], () => {
    delete process.env.PORT;
    const buggyPort = resolvePort(undefined); // resolved BEFORE the load
    assert.equal(buggyPort, 8080, 'old order: .env PORT not yet visible -> 8080');
    loadAppEnv(dir);
    assert.equal(resolvePort(undefined), 8090, 'fixed order: .env PORT honored');
  });
  rmSync(dir, { recursive: true, force: true });
});
