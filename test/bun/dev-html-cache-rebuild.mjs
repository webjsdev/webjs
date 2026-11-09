/**
 * Cross-runtime proof that a dev rebuild evicts the server HTML cache (#1689):
 * start a supervised `webjs dev` under WHICHEVER runtime runs this file, warm a
 * page that declares `export const revalidate = 60`, edit it, and assert the
 * request after the reload frame renders the edit. Run under both:
 *
 *   node test/bun/dev-html-cache-rebuild.mjs
 *   bun  test/bun/dev-html-cache-rebuild.mjs
 *
 * Before the fix nothing evicted the cache on a rebuild and the key did not
 * change, so the page served its pre-edit body for the whole 60s window, and
 * that body carried the old `webjs-dev-reload` meta, which the reload relay
 * reads as a page that is behind. Both runtimes keep the cache store and its
 * generation in process-shared state (a `bun --hot` re-run included), so both
 * needed the eviction.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes;
 * it exits non-zero on failure and spawns the real CLI by path, with the
 * fixture's `@webjsdev/*` links pointing at this checkout's packages.
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
// Past the 10080 entry on the WHATWG bad-ports list, and clear of the ranges
// the other dev scripts in this directory use.
const PORT = 11300 + (process.pid % 240);
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

/** Resolve true once a `reload` frame arrives on the live-reload stream, else false. */
async function reloadFrame(timeoutMs) {
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
      if (/event: reload\n/.test(buf)) return true;
    }
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The page's marker, or null when it did not render. */
async function marker() {
  const res = await fetch(BASE + '/');
  if (!res.ok) return null;
  const m = /marker=(\w+)/.exec(await res.text());
  return m ? m[1] : null;
}

const page = (m) => [
  "import { html } from '@webjsdev/core';",
  'export const revalidate = 60;',
  `export default () => html\`<main>marker=${m}</main>\`;`,
  '',
].join('\n');

const dir = mkdtempSync(join(tmpdir(), 'webjs-html-cache-rebuild-'));
let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'html-cache-rebuild', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, 'app/page.ts'), page('A'));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const first = await until(async () => (await marker()) === 'A', { timeoutMs: 30_000 });
  assert.ok(first, `dev server never served the page on ${runtime}\n--- server log ---\n${log}`);
  // The second request is the cache hit the edit has to get past.
  assert.equal(await marker(), 'A', `the revalidate page is served from the HTML cache on ${runtime}`);

  const frame = reloadFrame(15_000);
  await sleep(300); // let the stream connect before the edit
  writeFileSync(join(dir, 'app/page.ts'), page('B'));
  assert.ok(await frame, `no reload frame after the edit on ${runtime}\n--- server log ---\n${log}`);

  // A few seconds, far inside the 60s window: a cached pre-edit body would
  // keep answering A for the whole of it.
  const fresh = await until(async () => (await marker()) === 'B', { timeoutMs: 5_000 });
  assert.ok(fresh, `the revalidate page kept serving its pre-edit body after the rebuild on ${runtime}\n--- server log ---\n${log}`);

  console.log(`OK  a dev rebuild evicts the HTML cache on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
