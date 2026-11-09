/**
 * Cross-runtime proof that a burst of saves in one directory all reach the tab
 * (#1689). Bun's `fs.watch` (1.3.14) reports only the FIRST of two files
 * written about a millisecond apart in the same directory, so the dev server
 * used to rebuild with the first file alone: a second edited component never
 * entered the browser versions or the hot-swap verdict, and the tab kept its
 * old code with no reload. A rebuild now also takes every served or shipped
 * module whose disk stamp moved without an event (`withMissedChanges` in
 * `dev/handler.js`), checking only the directories of the files the watcher
 * did report, since the dropped event is a sibling in the same directory: the
 * two components below share one, which is the case that has to hold.
 *
 *   node test/bun/dev-watch-burst.mjs
 *   bun  test/bun/dev-watch-burst.mjs
 *
 * Two shipping components live in one directory. The script edits both with no
 * gap between the writes and asserts the reload frames the tab receives hot
 * swap BOTH component modules. Node's watcher reports both files, so there it
 * is the baseline the Bun run has to match.
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
const PORT = 12500 + (process.pid % 240);
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

/** Collect every `reload` frame that arrives on the stream within `ms`. */
async function reloadFrames(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const frames = [];
  try {
    const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      frames.length = 0;
      const re = /event: reload\ndata: (.*)\n/g;
      let m;
      while ((m = re.exec(buf))) frames.push(JSON.parse(m[1]));
    }
  } catch { /* aborted at the deadline */ } finally {
    clearTimeout(timer);
  }
  return frames;
}

const componentSrc = (cls, tag, text) => `
import { WebComponent, html } from '@webjsdev/core';
class ${cls} extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html\`<button @click=\${() => { this.count += 1; }}>${text} \${this.count}</button>\`; }
}
${cls}.register('${tag}');
`;

const dir = mkdtempSync(join(tmpdir(), 'webjs-watch-burst-'));
let child;
let log = '';
try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'watch-burst', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, 'app/page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import '../components/first.ts';",
    "import '../components/second.ts';",
    'export default () => html`<main><first-box></first-box><second-box></second-box></main>`;',
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'components/first.ts'), componentSrc('FirstBox', 'first-box', 'A1'));
  writeFileSync(join(dir, 'components/second.ts'), componentSrc('SecondBox', 'second-box', 'B1'));
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
  // Warm the analysis the way a browser's first load does.
  const first = await until(async () => /A1/.test((await served('/')) || '') && served('/components/second.ts'), { timeoutMs: 30_000 });
  assert.ok(first, `dev server never served the page on ${runtime}\n--- server log ---\n${log}`);
  await sleep(300);

  const frames = reloadFrames(6000);
  await sleep(300); // let the SSE stream connect before the edit
  // No gap between the two writes: the shape Bun's watcher reports only the
  // first of.
  writeFileSync(join(dir, 'components/first.ts'), componentSrc('FirstBox', 'first-box', 'A2'));
  writeFileSync(join(dir, 'components/second.ts'), componentSrc('SecondBox', 'second-box', 'B2'));
  const got = await frames;
  assert.ok(got.length, `no reload frame after the burst on ${runtime}\n--- server log ---\n${log}`);
  const modules = got.flatMap((f) => f.modules || []);
  const reloaded = got.some((f) => f.v === 'reload');
  assert.ok(!reloaded, `a text edit to two components hot-swaps, never reloads, on ${runtime}: ${JSON.stringify(got)}`);
  assert.ok(modules.some((m) => /^\/components\/first\.ts\?t=\d+$/.test(m)),
    `the first component reached the tab on ${runtime}: ${JSON.stringify(got)}`);
  assert.ok(modules.some((m) => /^\/components\/second\.ts\?t=\d+$/.test(m)),
    `the second component, saved in the same millisecond, reached the tab on ${runtime}: ${JSON.stringify(got)}`);
  // And the versioned URL the tab re-imports serves the edit.
  const second = modules.find((m) => m.startsWith('/components/second.ts'));
  assert.match((await served(second)) || '', /B2/, `the versioned second component serves the edit on ${runtime}`);

  console.log(`OK  webjs dev carries every file of a same-millisecond burst to the tab on ${runtime} (#1689)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
