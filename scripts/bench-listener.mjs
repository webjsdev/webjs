/**
 * End-to-end vs listening-path benchmark for the listener shells (#756).
 *
 * The "~1.9x more req/s on Bun" figure quoted for the `Bun.serve` shell is a
 * LISTENING-PATH microbenchmark (a trivial handler), NOT end-to-end throughput.
 * This script makes the distinction measurable: it boots a real webjs app and
 * hammers two routes under the SAME runtime + shell:
 *
 *   - `/__bench/ping`  a trivial text route (the listening path; render ~free)
 *   - `/`              a real SSR page with a dependency graph (end-to-end)
 *
 * Run the SAME script under each runtime and compare:
 *   node scripts/bench-listener.mjs        # node:http shell
 *   bun  scripts/bench-listener.mjs        # Bun.serve shell
 *
 * The ping req/s shows the listening-path ceiling; the page req/s shows what a
 * real app sees (render-dominated), where the shell delta is small. No external
 * dependency (a bounded concurrent fetch loop, not autocannon).
 *
 * Flags: --duration <ms> (default 3000), --conc <n> (default 50).
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { startServer } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../packages/core/index.js')).toString();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}
const DURATION = arg('--duration', 3000);
const CONC = arg('--conc', 50);

const dir = mkdtempSync(join(tmpdir(), 'webjs-bench-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

async function hammer(url, durationMs, conc) {
  let count = 0;
  let stop = false;
  const deadline = performance.now() + durationMs;
  async function worker() {
    while (!stop && performance.now() < deadline) {
      const r = await fetch(url);
      await r.arrayBuffer();
      count++;
    }
  }
  const t0 = performance.now();
  await Promise.all(Array.from({ length: conc }, worker));
  const secs = (performance.now() - t0) / 1000;
  stop = true;
  return Math.round(count / secs);
}

let close;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'bench', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;`);
  // A realistic SSR page: a list render with some markup, not a one-liner.
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nconst rows = Array.from({ length: 100 }, (_, i) => i);\nexport default () => html\`<main><h1>Bench page</h1><ul>\${rows.map((i) => html\`<li class="row">item \${i} with some text content</li>\`)}</ul></main>\`;`);
  w('app/__bench/ping/route.ts', `export async function GET() { return new Response('pong', { headers: { 'content-type': 'text/plain' } }); }`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: false, compress: false, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;

  // Warm both paths (first request triggers the lazy analysis + module load).
  await fetch(`${base}/__bench/ping`).then((r) => r.arrayBuffer());
  await fetch(`${base}/`).then((r) => r.arrayBuffer());

  const ping = await hammer(`${base}/__bench/ping`, DURATION, CONC);
  const page = await hammer(`${base}/`, DURATION, CONC);

  console.log(`\n=== listener benchmark on ${runtime} (conc=${CONC}, ${DURATION}ms each) ===`);
  console.log(`  listening path  GET /__bench/ping : ${ping.toLocaleString()} req/s`);
  console.log(`  end-to-end SSR  GET /              : ${page.toLocaleString()} req/s`);
  console.log(`  end-to-end is ${(page / ping * 100).toFixed(0)}% of the listening-path ceiling on this runtime.`);
  console.log('  (Run under both node and bun to compare; the ~1.9x shell win is the');
  console.log('   listening-path number, not the end-to-end one.)\n');
} finally {
  try { if (close) await close(); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
