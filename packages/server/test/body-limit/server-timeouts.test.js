/**
 * node:http server timeouts on the real ephemeral server (issue #237).
 *
 * SPLIT OUT of body-limit/integration.test.js (#509): these assert
 * `server.requestTimeout` / `headersTimeout` / `keepAliveTimeout`, node:http
 * properties that the Node listener shell sets. On Bun the listener is
 * `Bun.serve`, which has a single `idleTimeout` instead (the node `requestTimeout`
 * is mapped to it, covered by the #511 listener docs), so these node-shell
 * assertions are denylisted in the Bun matrix while the runtime-agnostic 413
 * body-limit tests in integration.test.js DO run under Bun.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { startServer } from '../../src/dev.js';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_HEADERS_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
} from '../../src/body-limit.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-timeouts-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

test('startServer applies node:http timeouts (secure defaults)', async () => {
  const appDir = makeApp({ 'app/page.js': `export default () => 'home';` });
  const { server, close } = await startServer({ appDir, port: 0, dev: false });
  try {
    assert.equal(server.requestTimeout, DEFAULT_REQUEST_TIMEOUT_MS);
    assert.equal(server.headersTimeout, DEFAULT_HEADERS_TIMEOUT_MS);
    assert.equal(server.keepAliveTimeout, DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
    assert.ok(server.headersTimeout < server.requestTimeout, 'headersTimeout must be under requestTimeout');
  } finally {
    await close();
  }
});

test('startServer honors webjs.* timeout config', async () => {
  const appDir = makeApp({
    'app/page.js': `export default () => 'home';`,
    'package.json': JSON.stringify({
      webjs: { requestTimeoutMs: 45000, headersTimeoutMs: 12000, keepAliveTimeoutMs: 8000 },
    }),
  });
  const { server, close } = await startServer({ appDir, port: 0, dev: false });
  try {
    assert.equal(server.requestTimeout, 45000);
    assert.equal(server.headersTimeout, 12000);
    assert.equal(server.keepAliveTimeout, 8000);
  } finally {
    await close();
  }
});
