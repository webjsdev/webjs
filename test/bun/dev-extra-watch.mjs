/**
 * Cross-runtime dev extra-watch test (#894): start `webjs dev` under WHICHEVER
 * runtime runs this file, with a `webjs.dev.watch` entry pointing at a content
 * dir OUTSIDE the appDir, then edit a file in that dir and assert the server
 * fires a live-reload over SSE WITHOUT a manual refresh. Run under both:
 *
 *   node test/bun/dev-extra-watch.mjs
 *   bun  test/bun/dev-extra-watch.mjs
 *
 * The dev live-reload watcher is set up in `startServer`, which runs on BOTH
 * the node:http and `Bun.serve` shells, so an app that reads content from
 * outside its tree (blog markdown in a repo-root `blog/`, a sibling of the app)
 * must reload identically on Node and Bun. A plain assert script (not
 * node:test) so the SAME file runs on both runtimes; it exits non-zero on
 * failure and spawns the real CLI via the current runtime's `process.execPath`.
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
const PORT = 9750 + (process.pid % 240);
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

/** Resolve true on the first `event: reload` on the SSE stream, else on timeout. */
async function reloadFired(timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return false;
      buf += dec.decode(value, { stream: true });
      if (/(^|\n)event: reload(\n|$)/.test(buf)) return true;
    }
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const root = mkdtempSync(join(tmpdir(), 'webjs-extra-watch-'));
const dir = join(root, 'site');
const contentDir = join(root, 'content');

let child;
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(contentDir, 'post.md'), '# original\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'extra-watch', type: 'module', imports: { '#*': './*' },
    webjs: { dev: { watch: ['../content'] } },
  }));
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

  // Open the SSE stream, then edit the sibling content file and expect a reload.
  const fired = reloadFired(10_000);
  await sleep(300); // let the SSE stream connect before the edit
  writeFileSync(join(contentDir, 'post.md'), '# edited\n');
  assert.ok(await fired, `editing a webjs.dev.watch dir OUTSIDE the appDir did not live-reload on ${runtime}\n--- server log ---\n${log}`);

  console.log(`OK  webjs dev live-reloads an edit to an outside webjs.dev.watch dir on ${runtime} (#894)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(root, { recursive: true, force: true });
}
