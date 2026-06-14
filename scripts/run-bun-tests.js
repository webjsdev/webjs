#!/usr/bin/env node
/**
 * Bun test matrix driver (#509).
 *
 * Runs the runtime-sensitive `node:test` files (under `test/`, `packages/core/test/`,
 * and `packages/server/test/`, excluding `browser/`, the `e2e/` gate, and the
 * network-bound `vendor/` suite) under Bun, file by file via `bun test <file>`.
 *
 * SOUNDNESS: the runner does NOT classify failures into skips (a self-classifying
 * runner can silently hide a real bug behind a "skip", which defeats the purpose).
 * The ONLY skips are an EXPLICIT, documented `DENYLIST` of files that assert
 * Node-only behavior or trip a Bun test-runner quirk, each with a reason and a
 * note of where the Bun-relevant behavior IS covered. Every other file MUST pass:
 * a non-zero exit, ANY failed test, or zero tests run (a silent compat gap) is a
 * genuine failure that fails the job. So a real cross-runtime bug can only ever
 * surface as a failure, never be auto-skipped.
 *
 * The Node suite (`npm test`) stays the source of truth; this matrix is additive.
 * Set `WEBJS_BUN_TESTS=…` to a comma-separated path-substring filter to scope a
 * local run.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, sep, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BUN = process.env.BUN || 'bun';
const PER_FILE_TIMEOUT_MS = Number(process.env.WEBJS_BUN_TEST_TIMEOUT_MS || 120_000);

/**
 * Files SKIPPED under Bun, each with a reason and where the Bun-relevant behavior
 * is otherwise covered. A file-level skip is coarse, so node-only behavior is
 * SPLIT into its own file (api dev-cache-bust, body-limit server-timeouts) rather
 * than denylisting a file that also carries runtime-agnostic tests. Match is by
 * the exact repo-relative path (normalized to `/`).
 */
const DENYLIST = [
  { match: 'packages/server/test/api/dev-cache-bust.test.js', reason: 'asserts the dev ?t= import cache-bust, which Bun ignores (a documented Bun limitation, #514; see agent-docs/testing.md). The rest of handleApi runs on Bun via api.test.js.' },
  { match: 'packages/server/test/body-limit/server-timeouts.test.js', reason: 'asserts node:http server.requestTimeout/headersTimeout/keepAliveTimeout; the Bun shell uses Bun.serve idleTimeout instead (#511). The runtime-agnostic 413 body-limit tests run on Bun via integration.test.js.' },
  { match: 'packages/server/test/seed/seed-hook.test.js', reason: 'SSR action-result seeding needs module.registerHooks, unavailable on Bun (no-ops by design, #508).' },
  { match: 'packages/server/test/seed/seed-ssr.test.js', reason: 'SSR action-result seeding needs module.registerHooks, unavailable on Bun (no-ops by design, #508).' },
  { match: 'packages/server/test/dev/dev-handler.test.js', reason: 'node:http shell internals (brotli preference, which Bun has no CompressionStream equivalent for; toWebRequest/sendWebResponse; server.address). The Bun shell is covered by test/bun/listener.mjs + listener/compression-parity.test.js (gzip on the Bun shell).' },
  { match: 'packages/server/test/ts-strip/ts-strip.test.js', reason: 'uses the node built-in stripper as the byte-identity reference (absent on Bun). The amaro path (Bun backend) is covered on Bun by test/bun/smoke.mjs + dev/dev-error-overlay.test.js, and a forced-amaro parity test runs on Node.' },
  { match: 'packages/server/test/importmap/importmap.test.js', reason: 'relies on node:test source-order for the shared importmap module singleton; Bun orders/isolates tests differently (the importmap functions themselves are runtime-agnostic).' },
  { match: 'packages/server/test/file-storage/disk-store.test.js', reason: "Bun's test runner mis-attributes the intentional mid-stream ReadableStream error across this file's tests. The FileStore streaming behavior (put/get round-trip AND the no-orphan-on-mid-stream-error invariant) is now proven on Bun by test/bun/file-storage.mjs (the #509 Readable.fromWeb->reader-loop fix)." },
  { match: 'packages/server/test/cache/cache-redis.test.js', reason: 'needs a running Redis + an ioredis/redis client, not provisioned in the matrix (skipped on Node too).' },
  { match: 'packages/server/test/websocket/websocket.test.js', reason: 'exercises the node `ws`-library upgrade subsystem directly (node:http createServer + attachWebSocket, which do not interoperate on Bun). The Bun WebSocket path (Bun.serve + the BunWsAdapter, #511) is covered by test/bun/listener.mjs.' },
  { match: 'test/cli/typecheck.test.mjs', reason: 'spawns process.execPath (the webjs CLI typecheck, a Node tsc tool); under the matrix process.execPath is bun, which resolves TypeScript differently, so the Node-tooling assertion does not hold.' },
  { match: 'packages/server/test/elision/differential-elision.test.js', reason: 'boots the examples/blog app and renders its DB-backed home page, which needs a migrated Prisma dev.db + jspm vendor resolution the matrix job does not provision (only the e2e / in-repo-app jobs do). The elision LOGIC is covered by the other unit tests in elision/; a real app boot on Bun is covered deterministically by test/bun/listener.mjs.' },
];

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && (e.name.endsWith('.test.js') || e.name.endsWith('.test.mjs'))) out.push(full);
  }
}

// Runtime-sensitive roots only (the issue's "server + core" scope, plus the
// cross-package SSR/scaffold tests under the repo-root test/). The dev-tooling
// packages (cli, mcp, editors, ui) are exercised on Node.
const all = [];
walk(join(ROOT, 'test'), all);
walk(join(ROOT, 'packages', 'core', 'test'), all);
walk(join(ROOT, 'packages', 'server', 'test'), all);

const SEP = sep;
// Exclude browser (needs wtr), e2e (gated), the network-bound vendor suite, and
// the example-app smoke/probe tests (test/examples/**), which boot a real app
// that needs a migrated Prisma DB + jspm vendor resolution the matrix job does
// not provision (the dedicated e2e / in-repo-app CI jobs do; on Bun a real app
// boot is covered deterministically by the test/bun/*.mjs scripts).
const excludeSegs = [`${SEP}browser${SEP}`, `${SEP}e2e${SEP}`, `${SEP}vendor${SEP}`, `${SEP}examples${SEP}`];
const filter = (process.env.WEBJS_BUN_TESTS || '').split(',').map((s) => s.trim()).filter(Boolean);
// Repo-relative path, always forward-slashed so DENYLIST matching is OS-stable.
const rel = (f) => f.slice(ROOT.length + 1).split(sep).join('/');
const denyOf = (f) => DENYLIST.find((d) => rel(f) === d.match);

const files = all
  .filter((f) => !excludeSegs.some((s) => f.includes(s)))
  .filter((f) => filter.length === 0 || filter.some((q) => f.includes(q)))
  .sort();

// Guard against a silent green from validating nothing: if discovery found no
// files (a moved test root or a broken walk) and no explicit filter was given,
// that is a failure, not a pass.
if (files.length === 0 && filter.length === 0) {
  console.error('[bun-matrix] FAIL: discovered 0 test files (the test roots moved or the walk broke).');
  process.exit(1);
}

const results = { pass: [], deny: [], fail: [] };

console.log(`[bun-matrix] running ${files.length} test files under ${BUN}\n`);

for (const f of files) {
  const deny = denyOf(f);
  if (deny) {
    results.deny.push({ f, why: deny.reason });
    console.log(`SKIP(node-only) ${rel(f)}`);
    continue;
  }
  const r = spawnSync(BUN, ['test', f], {
    cwd: ROOT, encoding: 'utf8', timeout: PER_FILE_TIMEOUT_MS,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (r.error && r.error.code === 'ETIMEDOUT') {
    results.fail.push({ f, why: `timed out after ${PER_FILE_TIMEOUT_MS}ms (a hang is a genuine Bun failure)` });
    console.log(`TIMEOUT  ${rel(f)}`);
    continue;
  }
  const verdict = classify(r.status, out);
  if (verdict.ok) {
    results.pass.push(f);
  } else {
    results.fail.push({ f, why: verdict.why });
    console.log(`FAIL     ${rel(f)}  [${verdict.why}]`);
  }
}

/**
 * A file PASSES only if Bun exited 0, reported NO failed tests, and actually RAN
 * at least one test (a zero-test run is a silent compat gap, not a pass).
 * @param {number|null} status
 * @param {string} out
 */
function classify(status, out) {
  const passN = num(out, /(\d+)\s+pass\b/);
  const failN = num(out, /(\d+)\s+fail\b/);
  const ranN = num(out, /Ran\s+(\d+)\s+test/);
  if (status !== 0) return { ok: false, why: `non-zero exit (${status}); ${failN} failed` + firstFail(out) };
  if (failN > 0) return { ok: false, why: `${failN} test(s) failed` + firstFail(out) };
  const executed = ranN || passN;
  if (executed === 0) return { ok: false, why: 'zero tests ran (a silent Bun node:test compat gap)' };
  return { ok: true };
}

function num(out, re) { const m = re.exec(out); return m ? Number(m[1]) : 0; }
function firstFail(out) {
  const line = out.split('\n').find((l) => /AssertionError|error:|\(fail\)/.test(l));
  return line ? `: ${line.trim().slice(0, 160)}` : '';
}

console.log('\n[bun-matrix] summary');
console.log(`  pass:            ${results.pass.length}`);
console.log(`  skip(node-only): ${results.deny.length}  (explicit DENYLIST; each documented, Bun behavior covered elsewhere)`);
console.log(`  genuine fail:    ${results.fail.length}`);

if (results.fail.length) {
  console.log('\n[bun-matrix] GENUINE FAILURES (these fail the job):');
  for (const { f, why } of results.fail) console.log(`  - ${rel(f)}: ${why}`);
  process.exit(1);
}
console.log('\n[bun-matrix] OK: no genuine Bun failures.');
