/**
 * Cross-runtime dev resilience test (#1521): start `webjs dev` under
 * WHICHEVER runtime runs this file and prove it survives the two things that
 * used to leave a dead preview. Run under both:
 *
 *   node test/bun/dev-watch-error.mjs
 *   bun  test/bun/dev-watch-error.mjs
 *
 * 1. A file in a watched dir that the server's user cannot read, which is what
 *    `sed -i` run by another user leaves behind (a 0600 `sedXXXXXX` temp file).
 *    On Node 24 both `node --watch` and the server's recursive watcher crashed
 *    on the EACCES and nothing restarted them. The server must keep serving,
 *    and a following edit must still reach it.
 * 2. A server child that dies from an uncaught exception. The supervisor must
 *    bring it back on its own, with no file change.
 *
 * A plain assert script (not node:test) so the SAME file runs on both
 * runtimes; it exits non-zero on failure and spawns the real CLI via the
 * current runtime's `process.execPath`. The unreadable-file half needs a
 * non-root POSIX user (root reads a mode-000 file), so it is skipped there.
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
const canLockFiles = process.platform !== 'win32' && !(typeof process.getuid === 'function' && process.getuid() === 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 100 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(stepMs);
  }
}

/** The running server's boot id, from the live-reload stream's hello frame. */
async function bootId() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      buf += dec.decode(value, { stream: true });
      const m = /event: hello\ndata: (.*)\n/.exec(buf);
      if (m) return JSON.parse(m[1]).boot;
    }
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}

const page = (text) => `import { html } from '@webjsdev/core';\nexport default () => html\`<h1>${text}</h1>\`;\n`;
const body = async () => (await fetch(`${BASE}/`)).text();

const root = mkdtempSync(join(tmpdir(), 'webjs-watch-error-'));
let child;
let log = '';
try {
  mkdirSync(join(root, 'app/crash'), { recursive: true });
  mkdirSync(join(root, 'modules/todos'), { recursive: true });
  writeFileSync(join(root, 'app/page.ts'), page('first'));
  // A route that crashes the process from outside any request, the shape of
  // an app bug the server cannot catch.
  writeFileSync(join(root, 'app/crash/route.ts'), "export function GET() {\n  setTimeout(() => { throw new Error('boom from the app'); }, 10);\n  return new Response('ok');\n}\n");
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'watch-error', type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(root, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(root, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(root, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const ready = await until(async () => (await body()).includes('first'), { timeoutMs: 30_000 });
  assert.ok(ready, `dev server never came up on ${runtime}\n--- server log ---\n${log}`);

  if (canLockFiles) {
    // 1. The `sed -i` temp file another user created: unreadable to us.
    writeFileSync(join(root, 'modules/todos/sedyLKmba'), 'x', { mode: 0o000 });
    writeFileSync(join(root, 'app/sedQ81aZc'), 'x', { mode: 0o000 });
    await sleep(1500);
    assert.equal(child.exitCode, null, `webjs dev exited after an unreadable file appeared on ${runtime}\n--- server log ---\n${log}`);
    assert.ok(await until(async () => (await fetch(`${BASE}/`)).ok, { timeoutMs: 10_000 }), `the server stopped serving after an unreadable file appeared on ${runtime}\n--- server log ---\n${log}`);
    assert.doesNotMatch(log, /uncaughtException|Unhandled 'error' event/, `a watcher error escaped on ${runtime}\n--- server log ---\n${log}`);
    rmSync(join(root, 'modules/todos/sedyLKmba'), { force: true });
    rmSync(join(root, 'app/sedQ81aZc'), { force: true });

    // ...and an edit after it still reaches the server.
    writeFileSync(join(root, 'app/page.ts'), page('second'));
    assert.ok(await until(async () => (await body()).includes('second'), { timeoutMs: 15_000 }), `an edit after the watcher error never reached the server on ${runtime}\n--- server log ---\n${log}`);
  } else {
    console.log(`SKIP unreadable-file half (needs a non-root POSIX user) on ${runtime}`);
  }

  // 2. Crash the server child. The supervisor restarts it after its backoff,
  //    with no file change to prompt it.
  const before = await bootId();
  assert.ok(before, `no boot id before the crash on ${runtime}`);
  await fetch(`${BASE}/crash`).catch(() => {});
  const back = await until(async () => { const id = await bootId(); return !!id && id !== before; }, { timeoutMs: 15_000, stepMs: 200 });
  assert.ok(back, `a crashed dev server did not come back on its own on ${runtime}\n--- server log ---\n${log}`);
  assert.ok((await fetch(`${BASE}/`)).ok, `the restarted server does not serve on ${runtime}`);
  assert.equal(child.exitCode, null, `webjs dev itself exited after the child crashed on ${runtime}`);

  // 3. Stopping webjs dev stops the child too: nothing left on the port.
  child.kill('SIGTERM');
  const exited = await until(() => child.exitCode !== null || child.signalCode !== null, { timeoutMs: 10_000 });
  assert.ok(exited, `webjs dev did not exit on SIGTERM on ${runtime}`);
  const freed = await until(async () => { try { await fetch(`${BASE}/__webjs/version`); return false; } catch { return true; } }, { timeoutMs: 5000 });
  assert.ok(freed, `a dev server child outlived webjs dev on ${runtime}\n--- server log ---\n${log}`);

  console.log(`OK  webjs dev survives an unreadable watched file and restarts a crashed server on ${runtime} (#1521)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(root, { recursive: true, force: true });
}
