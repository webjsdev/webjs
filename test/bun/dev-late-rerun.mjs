/**
 * Bun dev late re-run (#1689). Under `bun --hot` an edit the module versions
 * cannot place (here an extensionless file, the shape of the temp file
 * `sed -i` renames over a module) POKES the re-run sentinel, and the rebuild
 * waits for the registry reset. An edit to an existing app module no longer
 * pokes at all: the rebuild versions it in place. If the re-run arrives after
 * the poke's fallback (1500ms), the
 * fallback has already rebuilt and notified against the PRE-reset registry, so
 * the late re-run must rebuild AND notify again, or the tab never picks up the
 * fresh modules. It used to rebuild silently.
 *
 *   node test/bun/dev-late-rerun.mjs   (no-op: Node has no bun --hot re-run)
 *   bun  test/bun/dev-late-rerun.mjs
 *
 * The internal `__WEBJS_RERUN_DELAY_MS` seam holds the re-run for 2.5s before
 * it takes its batch, so it lands after the 1500ms fallback every time and the
 * race is deterministic. The edit is to `lib/VERSION`, which a route handler
 * reads, so it pokes and the response shows it. Expected: two `reload` frames,
 * the fallback's and the late re-run's.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.versions.bun) {
  console.log(`OK  skipped on node ${process.versions.node}: the late re-run is a bun --hot path (#1689)`);
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = `bun ${process.versions.bun}`;
// Past the 10080 entry on the WHATWG bad-ports list, and clear of the ranges
// the other dev scripts in this directory use.
const PORT = 11900 + (process.pid % 240);
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

/** Collect the `reload` frames that arrive on the stream within `ms`. */
async function reloadFrames(ms) {
  const ctrl = new AbortController();
  const frames = [];
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let m;
      const re = /event: reload\ndata: (.*)\n/g;
      frames.length = 0;
      while ((m = re.exec(buf))) frames.push(JSON.parse(m[1]));
    }
  } catch { /* aborted at the deadline */ } finally {
    clearTimeout(timer);
  }
  return frames;
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-late-rerun-'));
let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'lib'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'late-rerun', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nimport { msg } from '#lib/msg.ts';\nexport default () => html`<main>msg=${msg}</main>`;\n");
  writeFileSync(join(dir, 'lib/msg.ts'), "export const msg: string = 'M1';\n");
  writeFileSync(join(dir, 'lib/VERSION'), 'V1');
  mkdirSync(join(dir, 'app/v'), { recursive: true });
  writeFileSync(join(dir, 'app/v/route.ts'), "import { readFileSync } from 'node:fs';\nexport const GET = () => new Response('version=' + readFileSync(new URL('../../lib/VERSION', import.meta.url), 'utf8'));\n");
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', __WEBJS_RERUN_DELAY_MS: '2500' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const up = await until(async () => /msg=M1/.test(await (await fetch(BASE + '/')).text()), { timeoutMs: 30_000 });
  assert.ok(up, `dev server never served the page on ${runtime}\n--- server log ---\n${log}`);
  await sleep(300);

  const frames = reloadFrames(8000);
  await sleep(300);
  writeFileSync(join(dir, 'lib/VERSION'), 'V2');
  const got = await frames;
  assert.ok(got.length >= 2,
    `the late re-run notified again after the fallback on ${runtime} (got ${got.length} frame(s): ${JSON.stringify(got)})\n--- server log ---\n${log}`);
  assert.ok(/version=V2/.test(await (await fetch(BASE + '/v')).text()), `the edit is served on ${runtime}`);

  console.log(`OK  a bun --hot re-run that lands after the poke fallback notifies again on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
