/**
 * Cross-runtime dev reload-retry test (#893): the dev SSE `hello` frame must
 * carry a short `retry:` hint on BOTH the node:http and `Bun.serve` listener
 * shells, so the browser's EventSource reconnects quickly after a dev restart
 * (its default backoff is ~3s) and an app edit whose in-process reload frame
 * was killed with the old process re-triggers a reload promptly. The hint is
 * written by each listener shell, so it must be proven on each runtime. Run:
 *
 *   node test/bun/dev-reload-retry.mjs
 *   bun  test/bun/dev-reload-retry.mjs
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
const PORT = 9500 + (process.pid % 240);
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 200 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(stepMs);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-reload-retry-'));
let child;
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'retry', type: 'module', imports: { '#*': './*' }, webjs: {} }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const ready = await until(async () => (await fetch(`${BASE}/__webjs/version`)).ok, { timeoutMs: 30_000 });
  assert.ok(ready, `dev server never came up on ${runtime}\n--- server log ---\n${log}`);

  // Read the first SSE chunk and assert the retry hint rides the hello frame.
  const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' } });
  const reader = res.body.getReader();
  const { value } = await reader.read();
  try { await reader.cancel(); } catch {}
  const frame = new TextDecoder().decode(value);
  assert.match(frame, /(^|\n)retry: 300(\n|$)/, `SSE hello lacked the retry hint on ${runtime}: ${JSON.stringify(frame)}`);
  assert.match(frame, /event: hello/, `SSE hello frame missing on ${runtime}: ${JSON.stringify(frame)}`);

  console.log(`OK  dev SSE carries the retry: 300 reconnect hint on ${runtime} (#893)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
