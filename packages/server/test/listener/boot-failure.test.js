/**
 * Boot-failure cleanup (#511 review follow-up): the SSE `SseHub` starts its
 * keepalive interval in its constructor, which `startServer` now builds BEFORE
 * awaiting `createRequestHandler`. A boot failure (here, an `env.js` validator
 * that throws) must clear that interval rather than leak a live timer. The
 * keepalive is `unref()`'d so it does not show in `getActiveResourcesInfo()`;
 * instead spy on `SseHub.closeAll` (the method that clears it) to assert the
 * cleanup path runs. Discriminating: without the catch-and-closeAll the spy
 * records zero calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { startServer } from '../../index.js';
import { SseHub } from '../../src/listener-core.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };

test('startServer clears the SSE hub when boot fails (no keepalive leak)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-boot-fail-'));
  const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'b', type: 'module', webjs: {} }));
  // An env validator that throws at boot, so createRequestHandler rejects.
  w('env.js', `export default () => { throw new Error('intentional boot failure'); };\n`);

  // Spy on the cleanup method on the shared SseHub class (dev.js imports the same
  // module instance, so the prototype patch is observed).
  let closeCalls = 0;
  const orig = SseHub.prototype.closeAll;
  SseHub.prototype.closeAll = function patched(...args) { closeCalls += 1; return orig.apply(this, args); };

  try {
    await assert.rejects(
      startServer({ appDir: dir, dev: true, port: 0, logger: quiet }),
      /intentional boot failure/,
      'a throwing env validator must reject startServer',
    );
    assert.ok(closeCalls >= 1, 'startServer called hub.closeAll() to clean up the keepalive after a failed boot');
  } finally {
    SseHub.prototype.closeAll = orig;
    rmSync(dir, { recursive: true, force: true });
  }
});
