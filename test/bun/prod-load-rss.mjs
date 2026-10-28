/**
 * Cross-runtime guard: a production server releases memory after a load
 * burst (#1644). Run from the repo root:
 *
 *   node test/bun/prod-load-rss.mjs   # node:http shell
 *   bun  test/bun/prod-load-rss.mjs   # Bun.serve shell
 *
 * The Node shell used to hold its post-load peak RSS indefinitely: it
 * allocated a streaming zlib Transform per compressible response and ran it
 * on the libuv threadpool, leaving fragmented malloc arenas behind, and its
 * uncompressed path wrote the body chunk by chunk with no content length.
 * Both shells now take the buffered fast path (one synchronous compress on
 * the main thread, one write with a content length), so after a burst the
 * heap shrinks and the RSS follows.
 *
 * Stages a real app with the framework packages COPIED in (as a real install
 * lays them out), boots `webjs start` as a child, warms it, drives a burst of
 * 50 concurrent fetches with `accept-encoding: gzip, deflate, br` until
 * `BURST` requests have completed (every one a 200 carrying a
 * `content-encoding`), samples the server's RSS through its own `/memstats`
 * route, then polls it while the server idles. Asserts that the settled RSS
 * is close to the warm RSS. CPU per request is printed, never asserted: the
 * number swings with the host.
 *
 * Linux only (the assertion is about an allocator and a kernel the CI runner
 * has); elsewhere it prints SKIP and exits 0. Budget: up to about 80 s per
 * runtime, most of it the settle window.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
if (process.platform !== 'linux') {
  console.log(`SKIP prod-load-rss #1644 on ${runtime}: linux only`);
  process.exit(0);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// A random high port, so two runs on one host (a second worktree's `npm test`
// under CI=1, the node and bun halves back to back) do not collide on a fixed
// number and fail as "never became ready".
const PORT = 40_000 + Math.floor(Math.random() * 20_000);
const BASE = `http://127.0.0.1:${PORT}`;
const BURST = 20_000;
const CONCURRENCY = 50;
// WHEN V8 returns an idle heap is up to its memory reducer, which runs on its
// own timer after the last request: 12 to 22 s on this host, 12 s on a 2-vCPU
// GitHub runner, and an explicit `gc()` does NOT stand in for it (measured: a
// forced collection left the committed heap and the RSS exactly where they
// were). So the settle POLLS for up to SETTLE_MS and keeps the lowest reading.
// The pre-fix Node shell never came down inside a 40 s poll, so the window is
// wide enough to separate a late collection from a hold. One burst only: a
// second burst's collection on the slow runner landed outside any window a
// CI step can afford, and the first burst already proves the release.
const SETTLE_MS = 60_000;
const SETTLE_POLL_MS = 2_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = (b) => b / 1048576;

const dir = mkdtempSync(join(tmpdir(), 'webjs-load-rss-'));
const put = (rel, s) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), s); };

async function stats() {
  const r = await fetch(BASE + '/memstats');
  assert.equal(r.status, 200, '/memstats answers');
  return r.json();
}

/**
 * `count` requests over `CONCURRENCY` closed-loop workers, every response
 * checked. Returns the peak RSS sampled every 250 ms through the stats route.
 */
async function burst(count) {
  let done = 0;
  let peak = 0;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      try { peak = Math.max(peak, (await stats()).rss); } catch {}
      await sleep(250);
    }
  })();
  const worker = async () => {
    while (done < count) {
      done++;
      const r = await fetch(BASE + '/', { headers: { 'accept-encoding': 'gzip, deflate, br' } });
      if (r.status !== 200) throw new Error(`status ${r.status} during the burst`);
      if (!r.headers.get('content-encoding')) throw new Error('a burst response carried no content-encoding');
      await r.arrayBuffer();
    }
  };
  // The sampler is stopped on the failure path too: a worker throw that left
  // it looping (its fetch errors are caught, so it never ends on its own) kept
  // the event loop alive, and under the node:test wrapper, which imports this
  // script and never calls process.exit, a failed burst hung the job instead
  // of failing it.
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    sampling = false;
    await sampler;
  }
  return peak;
}

/** The lowest reading over the settle window, and how long it took to get there. */
async function settle() {
  let best = await stats();
  let at = 0;
  for (let t = SETTLE_POLL_MS; t <= SETTLE_MS; t += SETTLE_POLL_MS) {
    await sleep(SETTLE_POLL_MS);
    const s = await stats();
    if (s.rss < best.rss) { best = s; at = t; }
  }
  return { ...best, at };
}

let child;
let log = '';
let failed = null;
try {
  put('package.json', JSON.stringify({ name: 'load-rss', private: true, type: 'module', imports: { '#*': './*' }, webjs: {} }));
  put('app/layout.ts', "import { html } from '@webjsdev/core';\nexport default function L({ children }) { return html`<header>load</header>${children}`; }\n");
  // About 2.5 KB of body, like a real page, plus a display-only component the
  // render pass resolves (elided from the browser, still rendered on the server).
  put('app/page.ts', "import { html } from '@webjsdev/core';\nimport '../components/badge.ts';\nexport default function P() { return html`<main><x-badge label=\"load\"></x-badge><p>${'lorem ipsum dolor sit amet '.repeat(90)}</p></main>`; }\n");
  put('components/badge.ts', "import { WebComponent, html } from '@webjsdev/core';\nclass Badge extends WebComponent({ label: String }) {\n  constructor() { super(); this.label = ''; }\n  render() { return html`<span>${this.label}</span>`; }\n}\nBadge.register('x-badge');\n");
  // The server reports its own memory and CPU; `/proc` would be Node-only
  // and the child's pid is not what a `bun --bun` shell reports.
  put('app/memstats/route.ts', "export async function GET() { const m = process.memoryUsage(); const c = process.cpuUsage(); return Response.json({ rss: m.rss, heapTotal: m.heapTotal, heapUsed: m.heapUsed, cpuUs: c.user + c.system }); }\n");
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const p of ['core', 'server', 'cli']) {
    cpSync(join(ROOT, 'packages', p), join(dir, 'node_modules/@webjsdev', p), { recursive: true, dereference: true, filter: (src) => basename(src) !== 'test' });
  }
  for (const name of readdirSync(join(ROOT, 'node_modules'))) {
    if (name === '@webjsdev' || name.startsWith('.')) continue;
    symlinkSync(join(ROOT, 'node_modules', name), join(dir, 'node_modules', name));
  }

  child = spawn(process.execPath, [join(dir, 'node_modules/@webjsdev/cli/bin/webjs.js'), 'start', '--port', String(PORT)], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  const deadline = Date.now() + 30_000;
  for (;;) {
    try { if ((await fetch(BASE + '/__webjs/ready')).status === 200) break; } catch {}
    if (Date.now() > deadline) assert.fail(`prod server never became ready on ${runtime}\n--- server log ---\n${log}`);
    await sleep(200);
  }
  for (let i = 0; i < 50; i++) await (await fetch(BASE + '/')).arrayBuffer();
  const warm = await stats();

  const peak = await burst(BURST);
  const end = await stats();
  const settled = await settle();

  const cpuPerReq = (end.cpuUs - warm.cpuUs) / BURST;
  console.log(`${runtime}: cpu ${cpuPerReq.toFixed(0)} us/request over ${BURST} requests (informational)`);
  console.log(`${runtime}: rss MB warm ${MB(warm.rss).toFixed(1)}, burst peak ${MB(peak).toFixed(1)} end ${MB(end.rss).toFixed(1)} settled ${MB(settled.rss).toFixed(1)} at +${settled.at / 1000}s (heap ${MB(settled.heapTotal).toFixed(1)})`);

  // Margins from the measured post-fix values on 2026-10-27 (Linux, 24 cores,
  // Node 26.11.1 / Bun 1.3.14, and a 2-vCPU GitHub runner on Node 24.21): the
  // settled RSS sat about 20 MB (identity) to 50 MB (brotli) above warm on
  // Node after a peak 100 to 190 MB above it, and within 10 MB on Bun. The
  // pre-fix Node shell held the FULL peak (settled 120 to 150 MB above warm,
  // unchanged over a 40 s poll).
  const growth = MB(settled.rss - warm.rss);
  const rise = MB(peak - warm.rss);
  assert.ok(growth <= Math.max(40, 0.5 * rise),
    `[${runtime}] settled RSS stays close to warm after a burst: grew ${growth.toFixed(1)} MB (peak rose ${rise.toFixed(1)} MB; allowed max(40, half the rise))`);
  console.log(`OK  prod-load-rss #1644 passed on ${runtime}`);
} catch (err) {
  failed = err;
} finally {
  if (child && child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await sleep(500);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`FAIL prod-load-rss #1644 on ${runtime}: ${failed?.stack || failed?.message || failed}\n--- server log (tail) ---\n${log.slice(-3000)}`);
  if (import.meta.main) process.exit(1);
  else throw failed;
}
