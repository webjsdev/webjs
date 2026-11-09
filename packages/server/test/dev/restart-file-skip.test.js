/**
 * #1689: a supervised dev child sends no reload frame for a restart file.
 *
 * `.env`, `package.json`, the lockfiles, `instrumentation.*` and `env.*`
 * restart the `webjs dev` child, and the restart already reloads the tab (the
 * relay sees a new boot id). The child's own watcher sees the same root files,
 * so it used to classify the edit as an unknown path and send a reload frame of
 * its own whenever its debounced rebuild beat the supervisor's SIGTERM: a
 * second reload. The supervisor now hands the child its restart-file pattern in
 * `__WEBJS_DEV_RESTART_FILES`, and the child skips exactly those files.
 *
 * In-process here (no supervisor to kill the server), so the frame the old
 * code sent is observable deterministically.
 *
 * COUNTERFACTUAL: drop the skip in `dev/server.js` and the `.env` write below
 * produces a reload frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startServer } from '../../src/dev.js';
import { supervisorRestartFile } from '../../src/dev/server.js';

const RESTART_SRC = '^(?:(?:instrumentation|env)\\.m?[jt]s|\\.env|package\\.json|package-lock\\.json|npm-shrinkwrap\\.json|bun\\.lockb?|pnpm-lock\\.yaml|yarn\\.lock)$';
const quiet = { info() {}, warn() {}, error() {}, debug() {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve with the first `reload` frame's data, or null after `ms`. */
function firstReloadFrame(port, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; try { req.destroy(); } catch {} resolve(v); } };
    const req = get({ port, path: '/__webjs/events', headers: { accept: 'text/event-stream' } }, (res) => {
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (c) => {
        buf += c;
        const m = /event: reload\ndata: (.*)\n/.exec(buf);
        if (m) finish(m[1]);
      });
    });
    req.on('error', () => finish(null));
    setTimeout(() => finish(null), ms);
  });
}

test('a supervised child skips the restart files and still reloads for everything else', async () => {
  const appDir = mkdtempSync(join(tmpdir(), 'webjs-restart-skip-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app/page.js'), 'export default () => "ok";\n');
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'restart-skip', type: 'module' }));
  writeFileSync(join(appDir, '.env'), 'A=1\n');
  const saved = { child: process.env.__WEBJS_DEV_CHILD, files: process.env.__WEBJS_DEV_RESTART_FILES };
  process.env.__WEBJS_DEV_CHILD = '1';
  process.env.__WEBJS_DEV_RESTART_FILES = RESTART_SRC;
  let srv;
  try {
    srv = await startServer({ appDir, port: 0, dev: true, logger: quiet });
    const port = srv.server.address().port;
    await (await fetch(`http://127.0.0.1:${port}/`)).text();

    for (const [file, body] of [['.env', 'A=2\n'], ['package.json', JSON.stringify({ name: 'restart-skip', type: 'module', version: '1.0.1' })]]) {
      const frame = firstReloadFrame(port, 1500);
      await sleep(150);
      writeFileSync(join(appDir, file), body);
      assert.equal(await frame, null, `no reload frame for ${file}: the supervisor's restart is the reload`);
    }

    // The stream is live: a file that is not a restart file still reloads.
    const frame = firstReloadFrame(port, 6000);
    await sleep(150);
    writeFileSync(join(appDir, 'NOTES.md'), '# notes\n');
    assert.ok(await frame, 'an ordinary root file still produces a reload frame');
  } finally {
    if (srv) await srv.close();
    if (saved.child === undefined) delete process.env.__WEBJS_DEV_CHILD; else process.env.__WEBJS_DEV_CHILD = saved.child;
    if (saved.files === undefined) delete process.env.__WEBJS_DEV_RESTART_FILES; else process.env.__WEBJS_DEV_RESTART_FILES = saved.files;
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('supervisorRestartFile is null outside a supervised child or with no pattern', () => {
  assert.equal(supervisorRestartFile({}), null);
  assert.equal(supervisorRestartFile({ __WEBJS_DEV_RESTART_FILES: RESTART_SRC }), null);
  assert.equal(supervisorRestartFile({ __WEBJS_DEV_CHILD: '1' }), null);
  assert.equal(supervisorRestartFile({ __WEBJS_DEV_CHILD: '1', __WEBJS_DEV_RESTART_FILES: '(' }), null, 'a bad pattern is ignored');
  const re = supervisorRestartFile({ __WEBJS_DEV_CHILD: '1', __WEBJS_DEV_RESTART_FILES: RESTART_SRC });
  assert.equal(re.test('.env'), true);
  assert.equal(re.test('app/package.json'), false);
});
