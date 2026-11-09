/**
 * A restarted dev child sees the EDITED `.env` (#1689).
 *
 * `.env` is a restart file: the server loads it once at boot, so only a fresh
 * process can apply an edit to it. A restart alone did not help, though. The
 * CLI parent loads `.env` into its OWN env before the before-steps, and it used
 * to spawn the child with that env, while `process.loadEnvFile` never overrides
 * a variable that is already set. So the restarted child inherited the OLD
 * value from its parent and its own load of the edited file was a no-op. The
 * parent now snapshots the shell env before loading `.env` and starts the
 * child from the snapshot.
 *
 * This spawns the real CLI (by path, so the branch's server runs) on a tiny app
 * whose page renders `process.env.GREETING`, edits `.env`, and waits for the
 * restarted child to render the new value. COUNTERFACTUAL: spawning the child
 * with the post-`loadAppEnv` env keeps rendering `a` forever.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
// Clear of the WHATWG bad-ports list and of the ranges the other dev tests use.
const PORT = 11000 + (process.pid % 200);
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function greeting() {
  try {
    const res = await fetch(BASE + '/');
    if (!res.ok) return null;
    const m = /greeting=(\w+)/.exec(await res.text());
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function waitFor(want, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await greeting();
    if (last === want) return last;
    await sleep(200);
  }
  return last;
}

test('a dev child restarted for a .env edit renders the edited value (#1689)', { timeout: 120_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-env-'));
  let child;
  let log = '';
  try {
    mkdirSync(join(dir, 'app'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dev-env', type: 'module' }));
    writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<main>greeting=${process.env.GREETING}</main>`;\n");
    writeFileSync(join(dir, '.env'), 'GREETING=a\n');
    mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
    symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
    symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

    // GREETING must not come from the test's own env, or the shell would win.
    const env = { ...process.env, NODE_ENV: 'development' };
    delete env.GREETING;
    child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
      cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env,
    });
    child.stdout.on('data', (d) => { log += d; });
    child.stderr.on('data', (d) => { log += d; });

    assert.equal(await waitFor('a', 30_000), 'a', `the page renders the .env value\n--- log ---\n${log}`);
    writeFileSync(join(dir, '.env'), 'GREETING=b\n');
    assert.equal(await waitFor('b', 60_000), 'b', `the restarted child read the edited .env\n--- log ---\n${log}`);
    assert.match(log, /\.env changed, restarting the dev server/, 'the edit restarted the child');
  } finally {
    if (child && child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
      await sleep(500);
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
