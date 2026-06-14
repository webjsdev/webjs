/**
 * Cross-runtime dev hot-reload test (#514): start `webjs dev` under WHICHEVER
 * runtime executes this file, edit a re-imported route module while the server
 * runs, and assert the response reflects the edit WITHOUT a manual restart. Run
 * it under both:
 *
 *   node test/bun/dev-hot-reload.mjs
 *   bun  test/bun/dev-hot-reload.mjs
 *
 * This is the HEADLINE behaviour for #514. On Node the CLI re-execs under
 * `node --watch` (the process restarts, fresh ESM cache); on Bun it re-execs
 * under `bun --hot` (loaded modules are invalidated in place). Before the fix
 * the CLI used `node --watch` on Bun too, and since Bun ignores the dev
 * re-import's `?t=` cache-bust query, the edited module stayed STALE on Bun.
 *
 * A plain assert script (not node:test) so the SAME file runs identically on
 * both runtimes; it exits non-zero on failure. It spawns the real CLI via the
 * current runtime's `process.execPath`, so the runtime selects its own
 * supervisor exactly as a user's `webjs dev` / `bun --bun run dev` would.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
// The node (`npm test`) and bun (`bun ...mjs`) runs are SEQUENTIAL CI steps, so
// they do not race for a port; the per-pid offset is only defensive against a
// leftover socket from a prior run lingering in TIME_WAIT.
const PORT = 9700 + (process.pid % 250);
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll `fn` until it returns truthy or the deadline passes. */
async function until(fn, { timeoutMs, stepMs = 200 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(stepMs);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-hot-'));
const routeFile = join(dir, 'app/api/ping/route.ts');
const writeRoute = (body) => writeFileSync(routeFile, `export async function GET() { return new Response(${JSON.stringify(body)}); }\n`);

let child;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dev-hot', type: 'module', webjs: {} }));
  // Resolve @webjsdev/* from the workspace so the spawned CLI's server import
  // and (later) any app import resolve regardless of the temp-dir location.
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  mkdirSync(dirname(routeFile), { recursive: true });
  writeRoute('VERSION_ONE');

  // Spawn the REAL CLI under the current runtime, detached so we can signal the
  // whole process group (the CLI re-execs a supervisor child, which on Node
  // spawns the server as a further child).
  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const ready = await until(async () => (await fetch(`${BASE}/__webjs/health`)).ok, { timeoutMs: 30_000 });
  assert.ok(ready, `dev server did not become ready on ${runtime}\n--- server log ---\n${log}`);

  const first = await (await fetch(`${BASE}/api/ping`)).text();
  assert.equal(first, 'VERSION_ONE', `first fetch should serve the original module on ${runtime}`);

  // Edit the re-imported module and wait for the edit to take effect. No manual
  // restart: the runtime's supervisor (node --watch / bun --hot) must pick it up.
  writeRoute('VERSION_TWO');
  const updated = await until(async () => (await (await fetch(`${BASE}/api/ping`)).text()) === 'VERSION_TWO', { timeoutMs: 20_000 });
  assert.ok(updated, `edited module stayed STALE on ${runtime} (hot reload did not pick up the edit)\n--- server log ---\n${log}`);

  console.log(`OK  webjs dev hot-reload picked up a re-imported module edit on ${runtime} (#514)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    // Give the group a moment to exit, then hard-kill any stragglers.
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
