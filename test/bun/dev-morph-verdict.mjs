/**
 * Cross-runtime dev live-reload VERDICT test (#1398, #1689): start `webjs dev`
 * under WHICHEVER runtime runs this file, edit a page and then a component, and
 * assert the SSE `reload` frame carries the right classification on both
 * (`page` for the page, `component` for a hot-swappable component edit,
 * `reload` for a constructor edit the hot swap refuses). Run
 * under both:
 *
 *   node test/bun/dev-morph-verdict.mjs
 *   bun  test/bun/dev-morph-verdict.mjs
 *
 * Why this surface needs Bun parity at all: the frame is emitted through
 * `SseHub._raw` in `listener-core.js`, and the two listener shells drive that
 * over different transports (node `res.write` versus a Bun
 * `ReadableStreamDefaultController`). The frame's `data:` line is now a JSON
 * payload rather than the bare `now` it used to be, which is exactly the kind
 * of thing a transport can chunk or re-frame differently, so the payload is
 * asserted byte-for-byte identical on both.
 *
 * `--no-hot` makes `planDevSupervisor` return `{ mode: 'inline' }`, so the
 * server runs in THIS process and the test reads its frames directly. Since
 * #1689 the supervised child on Node also survives an edit (the module resolve
 * hook re-evaluates the edited chain in place), so it carries the same
 * verdicts; that path is covered by `test/bun/dev-hot-server-fresh.mjs` and the
 * dev-morph e2e. Only a restart file (`.env`, `package.json`, a lockfile,
 * `instrumentation.*`, `env.*`) still replaces the process, and the browser
 * then learns of the edit through a changed boot id, a full reload.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes;
 * it exits non-zero on failure and spawns the real CLI via the current
 * runtime's `process.execPath`.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReloadFrame } from '../../packages/server/src/dev-reload-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
// Based past 10080, the last entry on the WHATWG Fetch bad-ports list, which
// `fetch()` rejects with "bad port" before opening a socket. The range was
// 9990-10229, which contains it, so a run whose pid landed there failed for a
// reason unrelated to anything this file tests. See the longer account in
// dev-public-before-warm.mjs, where it actually fired. Nothing above 10080 is
// blocked, and 10400-10639 also stays clear of that file's 10100-10355.
const PORT = 10400 + (process.pid % 240);
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 200 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return null;
    await sleep(stepMs);
  }
}

/** Resolve with the raw `data:` line of the first `reload` frame, else null. */
async function reloadFrame(timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/__webjs/events`, { headers: { accept: 'text/event-stream' }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      buf += dec.decode(value, { stream: true });
      const m = /event: reload\ndata: (.*)\n/.exec(buf);
      if (m) return m[1];
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-morph-verdict-'));

let child;
let log = '';

/**
 * Warm the analysis, edit `rel`, and return the parsed verdict off the next
 * reload frame.
 *
 * The warm request is not test scaffolding, it is what a browser does. A
 * rebuild INVALIDATES the lazy analysis, so the classifier is cold again until
 * the next request rebuilds the graph, and a cold classifier fails safe to
 * `reload`. In a real session the reload or in-place refresh that each verdict
 * produces is itself that request, so the analysis is warm again before the
 * next edit lands. With no browser attached, this stands in for it.
 */
async function verdictForEdit(rel, body) {
  const warm = await fetch(BASE + '/');
  assert.equal(warm.status, 200, `the fixture app renders on ${runtime}\n--- server log ---\n${log}`);
  await warm.text();
  const frame = reloadFrame(10_000);
  await sleep(300); // let the SSE stream connect before the edit
  writeFileSync(join(dir, rel), body);
  const data = await frame;
  assert.ok(data, `no reload frame after editing ${rel} on ${runtime}\n--- server log ---\n${log}`);
  return JSON.parse(data);
}

try {
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  writeFileSync(join(dir, 'app/layout.ts'), "import { html } from '@webjsdev/core';\nexport default ({ children }) => html`<div><header>A</header>${children}</div>`;\n");
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nimport '../components/counter.ts';\nexport default () => html`<main>B<my-counter></my-counter></main>`;\n");
  // A component module, so it enters the shipped closure the classifier reads.
  writeFileSync(join(dir, 'components/counter.ts'), `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html\`<button @click=\${() => { this.count++; }}>\${this.count}</button>\`; }
}
Counter.register('my-counter');
`);
  mkdirSync(join(dir, 'public'), { recursive: true });
  writeFileSync(join(dir, 'public/x.css'), 'body { color: black; }\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'morph-verdict', type: 'module', imports: { '#*': './*' },
  }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));

  child = spawn(process.execPath, [CLI, 'dev', '--no-hot', '--port', String(PORT)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const ready = await until(async () => (await fetch(`${BASE}/__webjs/version`)).ok, { timeoutMs: 30_000 });
  assert.ok(ready, `dev server never came up on ${runtime}\n--- server log ---\n${log}`);

  const page = await verdictForEdit('app/page.ts', "import { html } from '@webjsdev/core';\nimport '../components/counter.ts';\nexport default () => html`<main>B_EDITED<my-counter></my-counter></main>`;\n");
  assert.equal(page.v, 'page', `a page edit is morphable on ${runtime}, got ${JSON.stringify(page)}\n--- server log ---\n${log}`);
  assert.equal(page.by, 'app/page.ts', `the frame names the changed file on ${runtime}`);
  // The relay reads the frame into the object it posts to a tab (#1689). A page
  // edit carries no modules and no stylesheet flag, so the tab gets empty ones,
  // identically on both transports.
  assert.deepEqual(parseReloadFrame(JSON.stringify(page)), { v: 'page', by: 'app/page.ts', why: 'page-module', modules: [], css: false },
    `the relay reads the page frame into the full verdict object on ${runtime}`);

  // The counterfactual direction: a component edit is never a morph, because
  // `customElements.define` is once-per-tag and a morph would apply new markup
  // wired to the old class. Since #1689 it is a `component` hot swap: the tab
  // re-imports the versioned module the frame names and patches the registered
  // class in place.
  const comp = await verdictForEdit('components/counter.ts', `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html\`<button @click=\${() => { this.count += 2; }}>\${this.count}</button>\`; }
}
Counter.register('my-counter');
`);
  assert.equal(comp.v, 'component', `a component edit hot-swaps on ${runtime}, got ${JSON.stringify(comp)}\n--- server log ---\n${log}`);
  assert.equal(comp.why, 'hot-swap', `for the hot-swap reason on ${runtime}`);
  assert.equal(comp.by, 'components/counter.ts', `naming the edited file on ${runtime}`);
  assert.deepEqual(comp.modules, ['/components/counter.ts?t=1'], `listing the versioned module to re-import on ${runtime}`);
  assert.deepEqual(parseReloadFrame(JSON.stringify(comp)), { v: 'component', by: 'components/counter.ts', why: 'hot-swap', modules: ['/components/counter.ts?t=1'], css: false },
    `the relay reads the component frame into the full verdict object on ${runtime}`);

  // And an edit the registered class cannot take stays a full reload with its
  // reason (#1689): the native registry keeps constructing with the old
  // constructor.
  const ctor = await verdictForEdit('components/counter.ts', `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 10; }
  render() { return html\`<button @click=\${() => { this.count += 2; }}>\${this.count}</button>\`; }
}
Counter.register('my-counter');
`);
  assert.equal(ctor.v, 'reload', `a constructor edit reloads on ${runtime}, got ${JSON.stringify(ctor)}`);
  assert.equal(ctor.why, 'constructor-changed', `naming the reason on ${runtime}`);

  // A stylesheet the browser does not hold as a module swaps in place (#1689):
  // the tab re-requests its sheets, with no reload and no re-render.
  const css = await verdictForEdit('public/x.css', 'body { color: red; }\n');
  assert.deepEqual({ v: css.v, by: css.by, why: css.why, css: css.css }, { v: 'css', by: 'public/x.css', why: 'stylesheet', css: true },
    `a public/ stylesheet edit is a css swap on ${runtime}\n--- server log ---\n${log}`);
  assert.deepEqual(parseReloadFrame(JSON.stringify(css)), { v: 'css', by: 'public/x.css', why: 'stylesheet', modules: [], css: true },
    `the relay reads the css frame into the full verdict object on ${runtime}`);

  console.log(`OK  the dev reload frame carries the change verdict on ${runtime} (#1398)`);
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
