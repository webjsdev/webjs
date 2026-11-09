/**
 * Cross-runtime proof that a supervised `webjs dev` applies a server module
 * edit IN PLACE (#1689): start the real CLI under WHICHEVER runtime runs this
 * file, edit a `lib/` module a page imports, and assert the next GET renders the
 * edit from the SAME process (the page's boot id is unchanged). Run under both:
 *
 *   node test/bun/dev-hot-server-fresh.mjs
 *   bun  test/bun/dev-hot-server-fresh.mjs
 *
 * The edited module and the page importing it get a new module key
 * (`webjs-v=<n>`) and evaluate fresh, while a module neither edited nor
 * importing an edited one keeps its instance, so the script also asserts that
 * an untouched module's module-scope counter keeps counting across the edit.
 * On Node the versions come from the `module.registerHooks` resolve hook
 * (`packages/server/src/dev/esm-hot-hooks.js`). Before #1689 the supervisor
 * restarted the Node child for every app edit, which changed the boot id and
 * reset that counter. On Bun they come from the dev source plugins, which
 * rewrite the served import specifiers (`dev/bun-app-source.js`); before, the
 * edit asked `bun --hot` for a registry reset, which reset the counter too.
 *
 * The CLI is spawned by path (`packages/cli/bin/webjs.js`), and the fixture's
 * `@webjsdev/*` links point at this checkout's packages, so the run exercises
 * the branch's server rather than whatever a hoisted install resolves to.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes;
 * it exits non-zero on failure.
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
const isBun = !!process.versions.bun;
const runtime = isBun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
// Past the 10080 entry on the WHATWG bad-ports list, and clear of the ranges
// the other dev scripts in this directory use.
const PORT = 10700 + (process.pid % 240);
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

/** One render of `/`: the page's `msg`, `hits` and `tag`, and the boot id it was rendered by. */
async function render() {
  const res = await fetch(BASE + '/');
  if (!res.ok) return null;
  const body = await res.text();
  const m = /msg=(\w+) hits=(\d+) tag=(\w+)/.exec(body);
  const meta = /<meta name="webjs-dev-reload" content="([^"]*)"/.exec(body);
  if (!m || !meta) return null;
  const state = JSON.parse(meta[1].replace(/&quot;/g, '"').replace(/&#34;/g, '"'));
  return { msg: m[1], hits: Number(m[2]), tag: m[3], boot: state.boot };
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-hot-server-fresh-'));
const msgFile = join(dir, 'lib/msg.ts');
const writeMsg = (v) => {
  // The label first, so a render that shows the new msg was rebuilt after both.
  // Two writes this close in one directory are also the shape Bun's fs.watch
  // (1.3.14) reports only the first of, which the rebuild's disk check covers.
  writeFileSync(join(dir, 'lib/label.ts'), `export const label: string = 'L${v}';\n`);
  writeFileSync(msgFile, `export const msg: string = '${v}';\n`);
};

let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'lib'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'hot-server-fresh', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, 'app/page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import { msg } from '#lib/msg.ts';",
    "import { hit } from '../lib/hits.ts';",
    "import { tag } from '#lib/tag.server.ts';",
    'export default async () => html`<main>msg=${msg} hits=${hit()} tag=${await tag()}</main>`;',
    '',
  ].join('\n'));
  // A 'use server' action (served through the seed facade) whose own import is
  // edited too, so the version reaches through the facade to the real module.
  writeFileSync(join(dir, 'lib/tag.server.ts'), [
    "'use server';",
    "import { label } from './label.ts';",
    'export async function tag(): Promise<string> { return label; }',
    '',
  ].join('\n'));
  // Module-scope state in a module the edit does not touch.
  writeFileSync(join(dir, 'lib/hits.ts'), 'let n = 0;\nexport function hit(): number { return ++n; }\n');
  writeMsg('M1');
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

  const first = await until(async () => { const r = await render(); return r && r.msg === 'M1' ? r : null; }, { timeoutMs: 30_000 });
  assert.ok(first, `dev server never served the page on ${runtime}\n--- server log ---\n${log}`);
  // A second render, so the counter has a baseline above 1 and the analysis is
  // warm before the edit (a cold analysis classifies fail safe).
  const before = await render();
  assert.ok(before && before.hits > first.hits, `the counter counts renders on ${runtime}`);
  await sleep(300);

  writeMsg('M2');
  const after = await until(async () => { const r = await render(); return r && r.msg === 'M2' ? r : null; }, { timeoutMs: 20_000 });
  assert.ok(after, `a lib/ edit stayed STALE on ${runtime}\n--- server log ---\n${log}`);
  assert.equal(after.boot, before.boot,
    `the edit was applied by the SAME process on ${runtime} (a new boot id is a restart)\n--- server log ---\n${log}`);
  assert.doesNotMatch(log, /restarting the dev server/, `the supervisor restarted nothing on ${runtime}`);

  assert.equal(after.tag, 'LM2', `the edit reached through a 'use server' module on ${runtime}`);
  assert.ok(after.hits > before.hits,
    `an untouched module kept its instance on ${runtime}: hits went ${before.hits} -> ${after.hits}, a reset means it was re-evaluated`);

  // A second edit of the same file, which must get a NEW version, not the one
  // the first edit already used.
  writeMsg('M3');
  const again = await until(async () => { const r = await render(); return r && r.msg === 'M3' ? r : null; }, { timeoutMs: 20_000 });
  assert.ok(again, `a second edit of the same lib/ module stayed STALE on ${runtime}\n--- server log ---\n${log}`);
  assert.equal(again.boot, before.boot, `still the same process on ${runtime}`);
  assert.equal(again.tag, 'LM3', `the second edit reached through the 'use server' module on ${runtime}`);
  assert.ok(again.hits > after.hits, `and the counter still survives on ${runtime}`);

  console.log(`OK  webjs dev applied a server module edit in place on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
