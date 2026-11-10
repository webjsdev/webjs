/**
 * Cross-runtime proof of the dev restart files (#1689): under a supervised
 * `webjs dev`, an edit to `.env` or `package.json` restarts the server (a new
 * boot id), the restarted server reads the edited `.env`, and the tab is
 * reloaded ONCE, by the restart. Run under both:
 *
 *   node test/bun/dev-restart-files.mjs
 *   bun  test/bun/dev-restart-files.mjs
 *
 * The once is the regression this guards. The child's own watcher sees the
 * same root files, so before the fix it sent a `reload` frame for the edit
 * just before the supervisor killed it, and the tab reloaded twice: for the
 * frame, then for the changed boot id. The supervisor now hands the child its
 * restart-file pattern and the child skips those files, so the stream the old
 * process held carries no reload frame at all before it closes.
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
const PORT = 12200 + (process.pid % 240);
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

/** One render of `/`: the greeting and the boot id it was rendered by. */
async function render() {
  const res = await fetch(BASE + '/');
  if (!res.ok) return null;
  const body = await res.text();
  const m = /greeting=(\w+)/.exec(body);
  const meta = /<meta name="webjs-dev-reload" content="([^"]*)"/.exec(body);
  if (!m || !meta) return null;
  return { greeting: m[1], boot: JSON.parse(meta[1].replace(/&quot;|&#34;/g, '"')).boot };
}

/**
 * Open the live-reload stream on the current process and resolve with the
 * number of `reload` frames it carried before it closed (the process was
 * restarted) or `ms` passed.
 */
async function framesUntilClosed(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  let buf = '';
  const ready = { resolve: null };
  const connected = new Promise((r) => { ready.resolve = r; });
  const done = (async () => {
    try {
      const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' }, signal: ctrl.signal });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        if (/event: hello/.test(buf)) ready.resolve();
      }
    } catch { /* closed by the restart, or aborted at the deadline */ } finally {
      clearTimeout(timer);
      ready.resolve();
    }
    return (buf.match(/event: reload\n/g) || []).length;
  })();
  await connected;
  return done;
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-restart-files-'));
let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<main>greeting=${process.env.GREETING}</main>`;\n");
  writeFileSync(join(dir, '.env'), 'GREETING=a\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'restart-files', type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  const env = { ...process.env, NODE_ENV: 'development' };
  delete env.GREETING;
  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env,
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const first = await until(async () => { const r = await render(); return r && r.greeting === 'a' ? r : null; }, { timeoutMs: 30_000 });
  assert.ok(first, `dev server never rendered the .env value on ${runtime}\n--- server log ---\n${log}`);
  // Let the child announce that it reloads in place, so the supervisor is in
  // the state a real session is in.
  await sleep(500);

  // .env: a restart, the new value, and no reload frame from the old process.
  let frames = framesUntilClosed(15_000);
  writeFileSync(join(dir, '.env'), 'GREETING=b\n');
  assert.equal(await frames, 0, `the old process sent no reload frame of its own for a .env edit on ${runtime}\n--- server log ---\n${log}`);
  const second = await until(async () => { const r = await render(); return r && r.greeting === 'b' ? r : null; }, { timeoutMs: 30_000 });
  assert.ok(second, `the restarted server did not render the edited .env on ${runtime}\n--- server log ---\n${log}`);
  assert.notEqual(second.boot, first.boot, `a .env edit restarted the server on ${runtime}`);
  await sleep(500);

  // package.json: the same.
  frames = framesUntilClosed(15_000);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'restart-files', type: 'module', imports: { '#*': './*' }, version: '1.0.1' }));
  assert.equal(await frames, 0, `the old process sent no reload frame of its own for a package.json edit on ${runtime}\n--- server log ---\n${log}`);
  const third = await until(async () => { const r = await render(); return r && r.boot !== second.boot ? r : null; }, { timeoutMs: 30_000 });
  assert.ok(third, `a package.json edit restarted the server on ${runtime}\n--- server log ---\n${log}`);
  assert.equal(third.greeting, 'b', `and the restarted server still reads the .env on ${runtime}`);

  console.log(`OK  .env and package.json edits restart webjs dev once, with the new .env, on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
