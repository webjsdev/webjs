#!/usr/bin/env node
/**
 * Driver for the blog browser e2e suite.
 *
 *   test/examples/blog/browser/blog.test.js
 *
 * That suite drives the running blog example through real Chromium
 * via web-test-runner. It is intentionally excluded from the default
 * `wtr` run because it needs the blog's dev server up on port 3456
 * first (see web-test-runner.config.js).
 *
 * This driver:
 *
 *   1. spawns `npm run dev` inside `examples/blog/` with `PORT=3456`,
 *      same as `scripts/dev-all.js` does for the local-everything dev
 *      experience.
 *   2. polls http://localhost:3456 until it answers OK or until the
 *      readiness budget expires.
 *   3. runs `wtr --config scripts/run-example-blog-browser-e2e.wtr.config.js`,
 *      which globs only `test/examples/blog/browser/**`.
 *   4. tears the dev server down (and its `concurrently`-spawned
 *      children) on success or failure.
 *
 * Run via `npm run test:browser:blog` (NOT directly), so that npm
 * sets the workspace root correctly.
 */
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BLOG_DIR = resolve(ROOT, 'examples', 'blog');
const PORT = 3456;
const READY_BUDGET_MS = 60_000;

let dev;

function shutdown() {
  if (!dev) return;
  try { dev.kill('SIGTERM'); } catch {}
  setTimeout(() => { try { dev.kill('SIGKILL'); } catch {} }, 5_000);
}

process.on('SIGINT',  () => { shutdown(); process.exit(130); });
process.on('SIGTERM', () => { shutdown(); process.exit(143); });

async function waitForReady() {
  const start = Date.now();
  while (Date.now() - start < READY_BUDGET_MS) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`, { method: 'GET' });
      if (r.ok || r.status === 302 || r.status === 401) return true;
    } catch {}
    await wait(500);
  }
  return false;
}

dev = spawn('npm', ['run', 'dev'], {
  cwd: BLOG_DIR,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, PORT: String(PORT) },
});

dev.on('exit', (code, signal) => {
  if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
    console.error(`[blog-e2e] dev server exited unexpectedly (code=${code}, signal=${signal})`);
  }
});

const ready = await waitForReady();
if (!ready) {
  console.error(`[blog-e2e] blog dev server did not respond on :${PORT} within ${READY_BUDGET_MS}ms`);
  shutdown();
  process.exit(2);
}

const cfg = resolve(__dirname, 'run-example-blog-browser-e2e.wtr.config.js');
const wtr = spawn('npx', ['wtr', '--config', cfg], {
  cwd: ROOT,
  stdio: 'inherit',
});

wtr.on('exit', (code) => {
  shutdown();
  process.exit(code ?? 1);
});
