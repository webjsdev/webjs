/**
 * Cross-runtime dev reload test (#1529): start `webjs dev` under WHICHEVER
 * runtime runs this file and edit a DEEP import (`lib/msg.js`, imported by the
 * page) the ways an agent or an editor does, several times over the SAME file.
 * Run under both:
 *
 *   node test/bun/dev-watch-replaced.mjs
 *   bun  test/bun/dev-watch-replaced.mjs
 *
 * On Node 24 (Linux) the recursive `fs.watch` behind the supervisor went deaf
 * to a file once it had been REPLACED (`sed -i`, a rename over it): the second
 * `sed -i` and every edit after it never restarted the server, so the page
 * kept the old import. Each edit here must reach the page.
 *
 * A plain assert script (not node:test) so the SAME file runs on both
 * runtimes; it exits non-zero on failure and spawns the real CLI via the
 * current runtime's `process.execPath`.
 */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const PORT = 9740 + (process.pid % 200);
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 50 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(stepMs);
  }
}

const body = async () => (await fetch(`${BASE}/`)).text();
const msg = (text) => `export const msg = '${text}';\n`;

const root = mkdtempSync(join(tmpdir(), 'webjs-watch-replaced-'));
const F = join(root, 'lib/msg.js');
let child;
let log = '';
try {
  mkdirSync(join(root, 'app'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  writeFileSync(F, msg('m0'));
  writeFileSync(join(root, 'app/page.js'), "import { html } from '@webjsdev/core';\nimport { msg } from '../lib/msg.js';\nexport default () => html`<h1>${msg}</h1>`;\n");
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'watch-replaced', type: 'module' }));
  mkdirSync(join(root, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(root, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(root, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  assert.ok(await until(async () => (await body()).includes('m0'), { timeoutMs: 30_000 }), `dev server never came up on ${runtime}\n${log}`);

  const hasSed = (() => { try { execFileSync('sed', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
  const edits = [
    ...(hasSed ? [
      ['sed -i', (m) => execFileSync('sed', ['-i', `s/'[^']*'/'${m}'/`, F])],
      ['sed -i again', (m) => execFileSync('sed', ['-i', `s/'[^']*'/'${m}'/`, F])],
    ] : []),
    ['write after a replace', (m) => writeFileSync(F, msg(m))],
    ['temp file renamed over', (m) => { writeFileSync(`${F}.tmp`, msg(m)); renameSync(`${F}.tmp`, F); }],
    ['renamed over again', (m) => { writeFileSync(`${F}.tmp`, msg(m)); renameSync(`${F}.tmp`, F); }],
    ['deleted and recreated', async (m) => { rmSync(F); await sleep(100); writeFileSync(F, msg(m)); }],
    ['rapid writes', async (m) => { for (let i = 0; i < 8; i++) { writeFileSync(F, msg(`${m}-${i}`)); await sleep(10); } writeFileSync(F, msg(m)); }],
  ];
  let n = 0;
  for (const [name, edit] of edits) {
    const m = `edit${++n}`;
    await edit(m);
    const ok = await until(async () => (await body()).includes(`<h1>${m}</h1>`), { timeoutMs: 15_000 });
    assert.ok(ok, `${name}: the edit never reached the page on ${runtime}\n--- server log ---\n${log}`);
  }
  assert.equal(child.exitCode, null, `webjs dev exited on ${runtime}\n${log}`);
  console.log(`OK  webjs dev hears every edit to a replaced file on ${runtime} (#1529)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(root, { recursive: true, force: true });
}
