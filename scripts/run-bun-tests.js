#!/usr/bin/env node
/**
 * Bun test matrix driver (#509).
 *
 * Runs the runtime-sensitive `node:test` files (under `test/`, `packages/core/test/`,
 * and `packages/server/test/`, excluding `browser/`, the `e2e/` gate, and the
 * network-bound `vendor/` suite) under Bun, file by file via `bun test <file>`,
 * and CLASSIFIES each result so the matrix is meaningful rather than a wall of red:
 *
 *   - **pass**: ran green under Bun.
 *   - **denylist-skip**: a file KNOWN to assert Node-only behavior (a node:http
 *     shell internal, the built-in TS stripper as a reference, `module.registerHooks`
 *     seeding, the node `ws`-library subsystem) or to trip a Bun test-runner quirk
 *     (async-error attribution, source-order coupling). Each entry carries a reason;
 *     the Bun-relevant behavior of these surfaces is covered elsewhere (noted per
 *     entry), so skipping them loses no Bun coverage. See `agent-docs/testing.md`.
 *   - **harness-skip**: failed ONLY because Bun's `node:test` compat is incomplete
 *     (nested `test()`, `suite()`), an upstream Bun gap, auto-detected by the error
 *     signature so it self-heals as Bun improves.
 *   - **env-skip**: needs an environment this matrix does not provision (Redis, a DOM).
 *   - **genuine-fail**: a real failure under Bun. THESE fail the job; they are the
 *     valuable finds (a `node:*` API Bun implements differently, a crypto/stream
 *     edge case, a timing quirk).
 *
 * The Node suite (`npm test`) stays the source of truth; this matrix is additive.
 * Exit non-zero only on a genuine failure (or a timeout). Set `WEBJS_BUN_TESTS=…`
 * to a comma-separated path-substring filter to scope a local run.
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
 * Files that assert Node-only behavior or trip a Bun test-runner quirk. Each is
 * skipped with a documented reason; the Bun-relevant behavior is covered by the
 * test named in the reason, so no Bun coverage is lost. Match is by path suffix.
 */
const DENYLIST = [
  { match: 'packages/server/test/websocket/websocket.test.js', reason: 'exercises the node `ws`-library upgrade subsystem directly (createServer + attachWebSocket); the Bun WebSocket path is covered by test/bun/listener.mjs' },
  { match: 'packages/server/test/seed/seed-hook.test.js', reason: 'SSR action-result seeding needs module.registerHooks, unavailable on Bun (no-ops by design, #508)' },
  { match: 'packages/server/test/seed/seed-ssr.test.js', reason: 'SSR action-result seeding needs module.registerHooks, unavailable on Bun (no-ops by design, #508)' },
  { match: 'packages/server/test/body-limit/integration.test.js', reason: 'asserts node:http server.requestTimeout/headersTimeout/keepAliveTimeout; the Bun shell maps these to idleTimeout (covered by the deployment docs + listener)' },
  { match: 'packages/server/test/dev/dev-handler.test.js', reason: 'node:http shell internals (brotli preference, toWebRequest/sendWebResponse, server.address); the Bun shell is covered by test/bun/listener.mjs + compression-parity' },
  { match: 'packages/server/test/ts-strip/ts-strip.test.js', reason: 'uses the node built-in stripper as the byte-identity reference; the amaro path (Bun backend) is covered under Bun by test/bun/smoke.mjs + dev-error-overlay' },
  { match: 'packages/server/test/api/api.test.js', reason: 'the dev ?t= import cache-bust relies on node query module-cache eviction, which Bun ignores (documented Bun limitation, see agent-docs/testing.md); the rest of api is covered' },
  { match: 'packages/server/test/importmap/importmap.test.js', reason: 'relies on node:test source-order for the shared importmap module singleton; Bun orders/isolates tests differently (the functions themselves are runtime-agnostic)' },
  { match: 'packages/server/test/file-storage/disk-store.test.js', reason: "Bun's test runner mis-attributes the intentional mid-stream ReadableStream error across streaming tests; FileStore streaming is verified runtime-agnostic on Bun standalone" },
  { match: 'test/cli/typecheck.test.mjs', reason: 'spawns process.execPath (the webjs CLI typecheck, a Node tsc tool); under the matrix process.execPath is bun, which resolves TypeScript differently, so the Node-tooling assertion does not hold' },
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
const excludeSegs = [`${SEP}browser${SEP}`, `${SEP}e2e${SEP}`, `${SEP}vendor${SEP}`];
const filter = (process.env.WEBJS_BUN_TESTS || '').split(',').map((s) => s.trim()).filter(Boolean);
const rel = (f) => f.slice(ROOT.length + 1);
const onDenylist = (f) => DENYLIST.find((d) => rel(f) === d.match);

let files = all
  .filter((f) => !excludeSegs.some((s) => f.includes(s)))
  .filter((f) => filter.length === 0 || filter.some((q) => f.includes(q)))
  .sort();

const HARNESS_SIGNATURES = [
  'is not yet implemented in Bun', // nested test() inside test()
  'outside of the test runner',
  'suite is not defined',
  'describe is not defined',
];
const ENV_SIGNATURES = [
  'Install a Redis client',
  'document is not defined',
  'window is not defined',
  'HTMLElement is not defined',
  'customElements is not defined',
];

const results = { pass: [], deny: [], harness: [], env: [], fail: [] };

console.log(`[bun-matrix] running ${files.length} test files under ${BUN}\n`);

for (const f of files) {
  const deny = onDenylist(f);
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
    results.fail.push({ f, why: `timed out after ${PER_FILE_TIMEOUT_MS}ms` });
    console.log(`TIMEOUT  ${rel(f)}`);
    continue;
  }
  if (r.status === 0) { results.pass.push(f); continue; }
  const harnessHit = HARNESS_SIGNATURES.find((s) => out.includes(s));
  const envHit = ENV_SIGNATURES.find((s) => out.includes(s));
  const hasAssertion = /AssertionError|Expected .* to (?:be|equal|deeply)/.test(out);
  if (harnessHit && !hasAssertion) {
    results.harness.push({ f, why: harnessHit });
    console.log(`SKIP(harness) ${rel(f)}  [${harnessHit}]`);
  } else if (envHit && !hasAssertion) {
    results.env.push({ f, why: envHit });
    console.log(`SKIP(env)     ${rel(f)}  [${envHit}]`);
  } else {
    results.fail.push({ f, why: firstFailure(out) });
    console.log(`FAIL     ${rel(f)}`);
  }
}

function firstFailure(out) {
  const line = out.split('\n').find((l) => /AssertionError|error:|\(fail\)/.test(l));
  return (line || 'non-zero exit').trim().slice(0, 200);
}

console.log('\n[bun-matrix] summary');
console.log(`  pass:            ${results.pass.length}`);
console.log(`  skip(node-only): ${results.deny.length}  (documented Node-only / Bun-runner-quirk; Bun behavior covered elsewhere)`);
console.log(`  skip(harness):   ${results.harness.length}  (Bun node:test compat gaps; tracked upstream)`);
console.log(`  skip(env):       ${results.env.length}  (needs Redis / DOM; not provisioned)`);
console.log(`  genuine fail:    ${results.fail.length}`);

if (results.fail.length) {
  console.log('\n[bun-matrix] GENUINE FAILURES (these fail the job):');
  for (const { f, why } of results.fail) console.log(`  - ${rel(f)}: ${why}`);
  process.exit(1);
}
console.log('\n[bun-matrix] OK: no genuine Bun failures.');
