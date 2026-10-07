/**
 * Cross-runtime dev reload of plugin-served modules (#1550): start `webjs dev`
 * under WHICHEVER runtime executes this file, with `WEBJS_SOURCE_LOCATIONS=1`
 * and then without it, and assert that successive edits to a page, to a plain
 * module it imports, and to a `'use server'` module it calls are all served
 * without a manual restart. Run it under both:
 *
 *   node test/bun/dev-reload-plugin-served.mjs
 *   bun  test/bun/dev-reload-plugin-served.mjs
 *
 * Before the fix, on Bun, every one of these edits stayed stale: `bun --hot`
 * does not watch a file a `Bun.plugin` `onLoad` served (the source-locations
 * plugin serves the page and lib module, the seed plugin the server module),
 * and the dev cache-bust (`file://...?t=`) is a no-op on Bun, which drops a
 * file URL's query. A plain assert script so the same file runs on both
 * runtimes; it exits non-zero on failure.
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
const PORT = 9950 + (process.pid % 40);
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

async function scenario(sourceLocations) {
const label = `${runtime}, source locations ${sourceLocations ? 'on' : 'off'}`;
const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-plugin-reload-'));
const file = (rel, src) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), src); };
const page = (v) => file('app/p/page.ts', `import { msg } from '../../lib/msg.ts';\nimport { word } from '../../modules/w/word.server.ts';\nexport default async function P() { return \`<p>page=${v} msg=\${msg} word=\${await word()}</p>\`; }\n`);
const msg = (v) => file('lib/msg.ts', `export const msg = '${v}';\n`);
const word = (v) => file('modules/w/word.server.ts', `'use server';\nexport async function word() { return '${v}'; }\n`);

let child;
let log = '';
const served = async (needle) => (await (await fetch(`${BASE}/p`)).text()).includes(needle);
try {
  file('package.json', JSON.stringify({ name: 'dev-plugin-reload', type: 'module', webjs: {} }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  page('P1'); msg('M1'); word('W1');

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', WEBJS_SOURCE_LOCATIONS: sourceLocations ? '1' : '0' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const first = await until(() => served('page=P1 msg=M1 word=W1'), { timeoutMs: 30_000 });
  assert.ok(first, `dev server never served the page (${label})\n--- server log ---\n${log}`);

  for (const [what, edit, needle] of [
    ['a page edit', () => page('P2'), 'page=P2'],
    ['a second page edit', () => page('P3'), 'page=P3'],
    ['an edit to a module the page imports', () => msg('M2'), 'msg=M2'],
    ["an edit to a 'use server' module", () => word('W2'), 'word=W2'],
    ["a second edit to the 'use server' module", () => word('W3'), 'word=W3'],
  ]) {
    edit();
    const ok = await until(() => served(needle), { timeoutMs: 20_000 });
    assert.ok(ok, `${what} stayed STALE (${label})\n--- server log ---\n${log}`);
  }
  console.log(`OK  webjs dev served page, imported-module and server-module edits (${label}, #1550)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
}

await scenario(true);
await scenario(false);
