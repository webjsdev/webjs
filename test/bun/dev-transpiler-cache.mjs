/**
 * `webjs dev` on Bun must not write Bun's runtime transpiler cache.
 *
 * Bun caches the transpile of every source over 50KB on disk, keyed by the
 * file's CONTENT, and the cached output carries the import paths a
 * `Bun.plugin` `onResolve` returned. The dev alias resolver (#1575) returns
 * absolute paths, so a large app module's `#` imports were pinned to the
 * checkout that first ran `webjs dev`. Any other copy of the same file (a git
 * worktree, a moved app, a later `webjs start`) then imported from that old
 * directory: a 500 once it was gone, the other copy's code while it was not.
 * The supervisor now runs the Bun child with the cache off.
 *
 * The proof points the cache at a temp directory, serves a >50KB page that
 * imports through a `#` alias, and asserts nothing was written there. Reverting
 * the fix leaves a `.pile` entry for the page. Run: `bun test/bun/dev-transpiler-cache.mjs`.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.versions.bun) {
  console.log('SKIP dev-transpiler-cache is a Bun-only proof');
  process.exit(0);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const PORT = 9950 + (process.pid % 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'webjs-tcache-'));
const cache = join(dir, '.bun-transpiler-cache');
let child;
let log = '';
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'tcache', type: 'module', webjs: {}, imports: { '#lib/*': './lib/*' },
  }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'lib/msg.ts'), `export const msg = 'FROM_ALIAS';\n`);
  mkdirSync(join(dir, 'app'));
  // Over Bun's 50KB threshold, so Bun would cache this module's transpile.
  const filler = Array.from({ length: 1200 }, (_, i) => `// filler line ${i} keeps this module above the transpiler cache threshold`).join('\n');
  writeFileSync(join(dir, 'app/page.ts'), [
    `import { html } from '@webjsdev/core';`,
    `import { msg } from '#lib/msg.ts';`,
    filler,
    `export default function Page() { return html\`<p data-m="PAGE_MARKER">\${msg}</p>\`; }`,
    '',
  ].join('\n'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', BUN_RUNTIME_TRANSPILER_CACHE_PATH: cache },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  let served = false;
  for (const deadline = Date.now() + 30_000; Date.now() < deadline && !served; await sleep(200)) {
    try { served = (await (await fetch(`http://localhost:${PORT}/`)).text()).includes('FROM_ALIAS'); } catch { /* not up yet */ }
  }
  assert.ok(served, `the page never served its # import\n--- server log ---\n${log}`);

  // The CLI's own supervisor process still caches the framework's large
  // modules, which is harmless (no plugin runs there). What must never be
  // cached is the APP page, whose entry would carry the resolved alias path.
  const pinned = (existsSync(cache) ? readdirSync(cache) : [])
    .filter((f) => readFileSync(join(cache, f)).includes('PAGE_MARKER') || readFileSync(join(cache, f)).includes(join(dir, 'lib')));
  assert.deepEqual(pinned, [], `webjs dev cached the app page's transpile (${pinned.join(', ')}), pinning its # import to this checkout`);
  console.log(`OK  webjs dev on bun ${process.versions.bun} keeps the app page out of the transpiler cache`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
