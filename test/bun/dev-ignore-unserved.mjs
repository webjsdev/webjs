/**
 * Cross-runtime check that `webjs dev` does not reload the page for files it
 * does not serve. `npm run dev > dev.log` in the app root used to turn every
 * log line into a live-reload, wiping streamed and live UI mid-session. A
 * gitignored `dev.log`, a `coverage/` file and another `.gitignore`d path are
 * written while the reload stream is open and must produce no reload frame;
 * then a real page edit must (so the stream is proven live). Run under both:
 *
 *   node test/bun/dev-ignore-unserved.mjs
 *   bun  test/bun/dev-ignore-unserved.mjs
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

const dir = mkdtempSync(join(tmpdir(), 'webjs-ignore-unserved-'));
let child;
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ignore-unserved', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n*.log\nuploads/\n');
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
  await fetch(`${BASE}/`);

  // Unserved writes: no reload frame within 3 s.
  const quiet = reloadFired(3000);
  await sleep(300);
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(dir, 'dev.log'), `line ${i}\n`, { flag: 'a' });
    await sleep(100);
  }
  mkdirSync(join(dir, 'coverage'), { recursive: true });
  writeFileSync(join(dir, 'coverage/lcov.info'), 'x');
  mkdirSync(join(dir, 'uploads'), { recursive: true });
  writeFileSync(join(dir, 'uploads/a.bin'), 'x');
  assert.equal(await quiet, false, `a write to dev.log, coverage/ or a gitignored dir reloaded the page on ${runtime}\n--- server log ---\n${log}`);

  // A tracked root file still reloads, so the silence above is not a dead
  // stream or a deaf root watcher. (Not an app/ edit: on Node that restarts the
  // process and the reload arrives as a reconnect, not a frame.)
  const fired = reloadFired(10_000);
  await sleep(300);
  writeFileSync(join(dir, 'NOTES.md'), '# tracked\n');
  assert.ok(await fired, `a tracked root file did not reload on ${runtime}\n--- server log ---\n${log}`);

  console.log(`OK  webjs dev ignores dev.log, coverage/ and gitignored paths, and still reloads a tracked file on ${runtime}`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
