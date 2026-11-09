/**
 * Cross-runtime check that `webjs dev` answers `/sw.js` with the service-worker
 * kill switch (#1689), through whichever listener shell this runtime provides
 * (node:http on Node, `Bun.serve` on Bun). The app ships a caching worker of its
 * own, and dev must never serve it: a caching worker on a dev origin keeps a tab
 * an edit behind. Run under both:
 *
 *   node test/bun/dev-service-worker.mjs
 *   bun  test/bun/dev-service-worker.mjs
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes;
 * it exits non-zero on failure and spawns the real CLI by path.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_SERVICE_WORKER_SOURCE } from '../../packages/server/src/dev/dev-service-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
// Past the 10080 entry on the WHATWG bad-ports list, and clear of the ranges
// the other dev scripts in this directory use.
const PORT = 11600 + (process.pid % 240);
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 100 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    if (Date.now() > deadline) return null;
    await sleep(stepMs);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-sw-'));
let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'public'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'public/sw.js'), "self.addEventListener('fetch', () => {}); // APP_WORKER\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dev-sw', type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  // `--no-hot` runs the server in-process, so the listener shell under test is
  // this runtime's own.
  child = spawn(process.execPath, [CLI, 'dev', '--no-hot', '--port', String(PORT)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const res = await until(async () => { const r = await fetch(`${BASE}/sw.js`); return r.ok ? r : null; }, { timeoutMs: 30_000 });
  assert.ok(res, `dev never served /sw.js on ${runtime}\n--- server log ---\n${log}`);
  assert.match(res.headers.get('content-type') || '', /javascript/, `served as JavaScript on ${runtime}`);
  assert.equal(res.headers.get('service-worker-allowed'), '/', `it may take over the root scope on ${runtime}`);
  assert.match(res.headers.get('cache-control') || '', /no-store/, `never cached on ${runtime}`);
  const body = await res.text();
  assert.equal(body, DEV_SERVICE_WORKER_SOURCE, `the kill switch, not the app worker, on ${runtime}`);

  console.log(`OK  webjs dev answers /sw.js with the service-worker kill switch on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
