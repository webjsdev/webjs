/**
 * Cross-runtime dev source locations test (#1499): under `webjs dev` with
 * `WEBJS_SOURCE_LOCATIONS=1`, the SSR HTML and the module served to the browser
 * both carry `data-webjs-src="<file>:<line>"` on the elements of the app's
 * `html` templates, on BOTH runtimes.
 *
 * Why this needs a cross-runtime run: the SSR half is a module load hook, which
 * is `module.registerHooks` on Node and a `Bun.plugin` `onLoad` on Bun. The Bun
 * plugin must also leave `*.server.*` modules to the `'use server'` seed plugin
 * (the first matching Bun plugin wins), so the page below calls a server action
 * during render: if the source-location plugin stole that module, the call
 * would lose its action facade. Run:
 *
 *   node test/bun/dev-source-locations.mjs
 *   bun  test/bun/dev-source-locations.mjs
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
const PORT = 9620 + (process.pid % 170);
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

const dir = mkdtempSync(join(tmpdir(), 'webjs-srcloc-'));
let child;
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  mkdirSync(join(dir, 'modules/greet'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import { greet } from '#modules/greet/greet.server.ts';",
    "import '#components/hello-card.ts';",
    'export default async function Page() {',
    '  const msg: string = await greet();',
    '  return html`<main>',
    '    <h1 id="msg">${msg}</h1>',
    '    <hello-card></hello-card>',
    '  </main>`;',
    '}',
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'modules/greet/greet.server.ts'), [
    "'use server';",
    "export async function greet(): Promise<string> { return 'hi from the server'; }",
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'components/hello-card.ts'), [
    "import { WebComponent, html } from '@webjsdev/core';",
    'export class HelloCard extends WebComponent {',
    '  render() {',
    '    return html`<p class="card">card</p>`;',
    '  }',
    '}',
    "HelloCard.register('hello-card');",
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'srcloc', type: 'module', imports: { '#*': './*' }, webjs: {} }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development', WEBJS_SOURCE_LOCATIONS: '1' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const ready = await until(async () => (await fetch(`${BASE}/__webjs/version`)).ok, { timeoutMs: 30_000 });
  assert.ok(ready, `dev server never came up on ${runtime}\n--- server log ---\n${log}`);

  const res = await fetch(`${BASE}/`);
  const page = await res.text();
  assert.equal(res.status, 200, `the page renders on ${runtime}\n${page}\n--- log ---\n${log}`);
  assert.match(page, /<main data-webjs-src="app\/page\.ts:6">/, `page element annotated on ${runtime}\n${page}`);
  assert.match(page, /<h1 data-webjs-src="app\/page\.ts:7" id="msg">hi from the server<\/h1>/,
    `the server action ran through its facade and the element is annotated on ${runtime}\n${page}`);
  assert.match(page, /<p data-webjs-src="components\/hello-card\.ts:4" class="card">/,
    `the component's SSR render is annotated on ${runtime}\n${page}`);

  const mod = await (await fetch(`${BASE}/components/hello-card.ts`)).text();
  assert.match(mod, /html`<p data-webjs-src="components\/hello-card\.ts:4" class="card">/,
    `the served module carries the same annotation on ${runtime}\n${mod}`);

  // The server module is never served (or annotated) as source.
  const stub = await (await fetch(`${BASE}/modules/greet/greet.server.ts`)).text();
  assert.doesNotMatch(stub, /data-webjs-src/, `a server module is never annotated on ${runtime}`);

  console.log(`OK  dev source locations annotate SSR and served modules on ${runtime} (#1499)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  rmSync(dir, { recursive: true, force: true });
}
