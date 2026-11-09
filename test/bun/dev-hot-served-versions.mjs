/**
 * Cross-runtime proof of the dev server's browser module versions (#1689):
 * start a supervised `webjs dev` under WHICHEVER runtime runs this file, edit a
 * helper a shipping component imports, and assert the component's SERVED source
 * now imports the helper as `./label.ts?t=<n>`, and that the versioned URL
 * serves the edited helper. Run under both:
 *
 *   node test/bun/dev-hot-served-versions.mjs
 *   bun  test/bun/dev-hot-served-versions.mjs
 *
 * The browser keeps one module instance per URL, so this rewrite is what lets a
 * tab re-import a component and reach the edited helper without a reload. It
 * is runtime-neutral by construction (the version map lives in the handler and
 * the rewrite is a served-source transform), and this proves both listener
 * shells serve it, including through Bun's `bun --hot` re-runs.
 *
 * The CLI is spawned by path and the fixture links `@webjsdev/*` at this
 * checkout, so the run exercises the branch's server. A plain assert script
 * (not node:test) so the SAME file runs on both runtimes.
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
// Clear of the 10080 bad port and of the ranges the other dev scripts here use.
const PORT = 11000 + (process.pid % 240);
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 150 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    if (Date.now() > deadline) return null;
    await sleep(stepMs);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-hot-served-versions-'));
const labelFile = join(dir, 'components/label.ts');
const counterSrc = (step) => `
import { WebComponent, html } from '@webjsdev/core';
import { label } from './label.ts';
class Counter extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html\`<button @click=\${() => { this.count += ${step}; }}>\${label} \${this.count}</button>\`; }
}
Counter.register('my-counter');
`;

let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'hot-served-versions', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nimport '../components/counter.ts';\nexport default () => html`<main><my-counter></my-counter></main>`;\n");
  writeFileSync(join(dir, 'components/counter.ts'), counterSrc(1));
  writeFileSync(labelFile, "export const label: string = 'one';\n");
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--port', String(PORT)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const served = (path) => fetch(BASE + path).then((r) => (r.ok ? r.text() : null));
  // Warm the analysis the way a browser's first load does: the page, then the
  // component module it boots.
  const first = await until(async () => (await served('/')) && served('/components/counter.ts'), { timeoutMs: 30_000 });
  assert.ok(first, `dev server never served the component on ${runtime}\n--- server log ---\n${log}`);
  assert.match(first, /from '\.\/label\.ts';/, `before any edit the helper import is bare on ${runtime}`);
  await sleep(300);

  writeFileSync(labelFile, "export const label: string = 'two';\n");
  const versioned = await until(async () => {
    const src = await served('/components/counter.ts');
    return src && /from '\.\/label\.ts\?t=(\d+)';/.exec(src);
  }, { timeoutMs: 20_000 });
  assert.ok(versioned, `the component's import of the edited helper never carried ?t= on ${runtime}\n--- server log ---\n${log}`);
  const helper = await served(`/components/label.ts?t=${versioned[1]}`);
  assert.match(helper || '', /'two'/, `the versioned helper URL serves the edit on ${runtime}`);

  console.log(`OK  webjs dev versions the served import of an edited browser module on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
