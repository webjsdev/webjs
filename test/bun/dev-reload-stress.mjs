/**
 * The dev-server reload stress (#1575), end to end on WHICHEVER runtime runs
 * this file:
 *
 *   node test/bun/dev-reload-stress.mjs
 *   bun  test/bun/dev-reload-stress.mjs
 *
 * Stages a small app, starts the real `webjs dev` (the supervisor, and on Bun
 * the `bun --hot` child), and runs `scripts/dev-reload-stress.mjs` against it:
 * agent-style edit sequences (bursts, partial writes, syntax errors, renames,
 * deletes, atomic writes, a whole feature at once, a checkout-like churn), each
 * of which must end with the server serving exactly the current files.
 *
 * On Bun it also asserts what #1575 fixed: one server for the whole run (a
 * re-run never starts a second one), no process restart for a `'use server'`
 * edit, and flat memory over a soak of edits (it grew about 25 MB an edit
 * before). On Node the server restarts the child on an edit by design, so a
 * refused connection during a restart counts as "not yet", and only the end
 * state is asserted.
 *
 * A plain assert script (not node:test) so the same file runs on both
 * runtimes; `dev-reload-stress.test.mjs` runs it under the root suite.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDevReloadStress, runDevReloadSoak, summarizeStress, listenerRssMb } from '../../scripts/dev-reload-stress.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const isBun = !!process.versions.bun;
const runtime = isBun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const PORT = 9450 + (process.pid % 250);
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-stress-'));
const put = (rel, s) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), s); };

let child;
let log = '';
try {
  put('package.json', JSON.stringify({ name: 'dev-stress', private: true, type: 'module', imports: { '#*': './*' }, webjs: {} }));
  put('app/layout.ts', "import { html } from '@webjsdev/core';\nexport default function L({ children }) { return html`<div id=root>${children}</div>`; }\n");
  put('app/page.ts', "import { html } from '@webjsdev/core';\nexport default function P() { return html`<p>home</p>`; }\n");
  put('components/.keep', '');
  put('modules/.keep', '');
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const p of ['core', 'server']) symlinkSync(join(ROOT, 'packages', p), join(dir, 'node_modules/@webjsdev', p));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const deadline = Date.now() + 30_000;
  for (;;) {
    try { if ((await fetch(BASE + '/')).status === 200) break; } catch {}
    if (Date.now() > deadline) assert.fail(`dev server never came up on ${runtime}\n--- server log ---\n${log}`);
    await sleep(200);
  }

  const results = await runDevReloadStress({ appDir: dir, base: BASE, timeoutMs: 10_000, tolerateRestarts: !isBun });
  const failed = results.filter((r) => !r.ok);
  console.log(`${runtime}: ${summarizeStress(results)}`);
  assert.deepEqual(failed, [], `the dev server did not settle on the current files on ${runtime}\n--- server log (tail) ---\n${log.slice(-6000)}`);

  if (isBun) {
    const starts = log.match(/dev server ready on/g)?.length ?? 0;
    assert.equal(starts, 1, `a bun --hot re-run must hand off to the first server, not start another (${starts} starts)`);
    assert.ok(!/restarting the dev server/.test(log), 'no edit in the stress needs a process restart on Bun');
    if (process.platform === 'linux') {
      const soak = await runDevReloadSoak({ appDir: dir, base: BASE, edits: 80, rssMb: () => listenerRssMb(PORT) });
      assert.equal(soak.fails, 0, 'every soak edit was served');
      const valid = soak.rss.filter((x) => x > 0);
      if (valid.length >= 2) {
        const growth = valid.at(-1) - valid[0];
        console.log(`${runtime}: soak of 80 edits, rss ${valid.join(' -> ')}MB`);
        // Before #1575 every re-run kept the previous server alive: ~25 MB an edit.
        assert.ok(growth < 200, `memory grew ${growth} MB over 80 edits`);
      }
    }
  }
  console.log(`OK  webjs dev settles on the current files under agent-style edits on ${runtime} (#1575)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
