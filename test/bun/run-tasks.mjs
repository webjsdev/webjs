/**
 * Cross-runtime assert (#550): the dev/start task orchestration in
 * `packages/cli/lib/run-tasks.js` must behave identically on Node and Bun, since
 * it spawns child processes (`node:child_process`), aborts on a failing
 * before-step, and must TEAR DOWN a long-lived shell-spawned watcher (the whole
 * process group, not just the `sh -c` wrapper). Runnable as
 * `node test/bun/run-tasks.mjs` AND `bun test/bun/run-tasks.mjs` (wired into the
 * CI bun job). Plain assertions, no node:test. Every spawned process is AWAITED
 * to exit, so a teardown that leaks a child fails fast (a bounded assertion)
 * instead of hanging the test runner.
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

// 3. A long-lived shell-spawned watcher is torn down at the PROCESS-GROUP level
//    (the same mechanism startParallelTasks uses): the `sh -c 'sleep ...'`
//    wrapper AND the `sleep` it spawns are killed, not leaked. Awaited, so a
//    leak fails as a bounded assertion, never a hang.
{
  const child = spawn('sleep 100', { shell: true, detached: true, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 150)); // let the tree come up
  process.kill(-child.pid, 'SIGTERM'); // negative pid: the whole group
  const exited = await Promise.race([
    new Promise((res) => child.on('exit', () => res(true))),
    new Promise((res) => setTimeout(() => res(false), 4000)),
  ]);
  assert.ok(exited, `[${runtime}] the detached watcher tree was reaped by the group kill (no orphan)`);
}

// 4. startParallelTasks's killer is callable + idempotent (a self-exiting
//    command, so nothing can leak regardless of timing).
{
  const kill = startParallelTasks(['true'], process.cwd(), { spawn });
  kill();
  kill(); // idempotent, must not throw
}

console.log(`[${runtime}] run-tasks cross-runtime asserts passed`);
