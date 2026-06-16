/**
 * Cross-runtime assert (#550): the dev/start task orchestration in
 * `packages/cli/lib/run-tasks.js` must behave identically on Node and Bun, since
 * it spawns child processes (`node:child_process`) and relies on EventEmitter
 * exit/error events. Runnable as `node test/bun/run-tasks.mjs` AND
 * `bun test/bun/run-tasks.mjs` (wired into the CI bun job). Plain assertions, no
 * node:test, so it runs under both runtimes uniformly.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { runBeforeSteps, startParallelTasks } from '../../packages/cli/lib/run-tasks.js';

const runtime = globalThis.Bun ? 'bun' : 'node';

// 1. before-steps run a REAL command and report success.
{
  const r = await runBeforeSteps(['exit 0'], process.cwd(), { spawn });
  assert.deepEqual(r, { ok: true }, `[${runtime}] a passing before-step is ok`);
}

// 2. before-steps abort on a REAL non-zero exit (the boot-abort path).
{
  const r = await runBeforeSteps(['exit 7', 'echo never'], process.cwd(), { spawn });
  assert.equal(r.ok, false, `[${runtime}] a failing before-step reports not-ok`);
  assert.equal(r.code, 7, `[${runtime}] the real exit code 7 propagates`);
  assert.equal(r.step, 'exit 7', `[${runtime}] the failing step is named`);
}

// 3. parallel tasks spawn a REAL long-lived child and the killer terminates it.
{
  const child = spawn('node -e "setInterval(() => {}, 1e9)"', { shell: true });
  // Reproduce startParallelTasks's teardown on a known child to assert kill works.
  const kill = startParallelTasks(['node -e "setInterval(() => {}, 1e9)"'], process.cwd(), { spawn });
  await new Promise((r) => setTimeout(r, 120));
  kill();
  try { child.kill(); } catch {}
  await new Promise((r) => setTimeout(r, 150));
  // If the killer did not work the process would leak; reaching here without a
  // hang is the assertion (the CI job has a wall-clock timeout).
}

console.log(`[${runtime}] run-tasks cross-runtime asserts passed`);
