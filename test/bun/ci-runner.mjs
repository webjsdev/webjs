/**
 * Cross-runtime assert (#1471): the `webjs ci` runner in
 * `packages/cli/lib/ci-runner.js` must behave identically on Node and Bun. It
 * spawns child processes two ways (inherited stdio for a sequential step,
 * detached + piped for a captured one), reads real exit codes, captures piped
 * output through `close`, and reaps a detached process GROUP on interrupt.
 * Runnable as `node test/bun/ci-runner.mjs` AND `bun test/bun/ci-runner.mjs`.
 * Plain assertions, no node:test. Every spawned process is awaited, so a leak
 * fails as a bounded assertion rather than a hang.
 */
import assert from 'node:assert/strict';
import { runCi } from '../../packages/cli/lib/ci-runner.js';
import { normalizeSteps } from '../../packages/cli/lib/ci-config.js';

const runtime = globalThis.Bun ? 'bun' : 'node';
const quiet = { write: () => {}, isTTY: false };

// 1. Sequential steps run REAL commands, report the real exit code, in order.
{
  const { steps } = normalizeSteps(['exit 0', 'exit 7', 'echo after']);
  const r = await runCi(steps, process.cwd(), quiet).done;
  assert.equal(r.ok, false, `[${runtime}] a failing step fails the run`);
  assert.deepEqual(r.steps.map((s) => [s.title, s.ok, s.code]), [['exit 0', true, 0], ['exit 7', false, 7], ['echo after', true, 0]],
    `[${runtime}] every step ran and the real exit codes propagated`);
}

// 2. Fail-fast: the step after the failure is never spawned.
{
  const { steps } = normalizeSteps(['exit 2', 'echo never']);
  const r = await runCi(steps, process.cwd(), { ...quiet, failFast: true }).done;
  assert.deepEqual(r.steps.map((s) => s.title), ['exit 2'], `[${runtime}] fail-fast stopped after the first failure`);
}

// 3. A parallel group captures each child's stdout AND stderr through the
//    pipe (resolved on close, so nothing is lost) and replays them whole.
{
  const chunks = [];
  const { steps } = normalizeSteps([{ title: 'G', parallel: 2, steps: [
    { title: 'both', run: 'echo out; echo err 1>&2' },
    { title: 'env', run: 'echo CI=$CI' },
  ] }]);
  const r = await runCi(steps, process.cwd(), { write: (s) => chunks.push(s), isTTY: false }).done;
  assert.equal(r.ok, true, `[${runtime}] both captured steps passed`);
  const both = r.steps.find((s) => s.title === 'both');
  assert.match(both.output, /out\n/, `[${runtime}] captured stdout`);
  assert.match(both.output, /err\n/, `[${runtime}] captured stderr`);
  assert.equal(both.truncated, false, `[${runtime}] the pipe closed normally`);
  const env = r.steps.find((s) => s.title === 'env');
  assert.equal(env.output.trim(), 'CI=true', `[${runtime}] the child saw CI=true`);
  const text = chunks.join('');
  assert.match(text, /\nboth\necho out; echo err 1>&2\n(out\nerr|err\nout)\n\n✅ both passed/, `[${runtime}] replayed as one block`);
}

// 4. interrupt() reaps a captured child's whole process GROUP (the `sh -c`
//    wrapper AND the sleep it spawned), the step reads as interrupted, and the
//    run winds down instead of hanging. Awaited with a bound.
{
  const { steps } = normalizeSteps([{ title: 'G', parallel: 2, steps: ['sleep 30', 'sleep 30'] }, 'echo never']);
  const run = runCi(steps, process.cwd(), quiet);
  await new Promise((res) => setTimeout(res, 300)); // let the two sleeps come up
  run.interrupt();
  const r = await Promise.race([
    run.done,
    new Promise((res) => setTimeout(() => res(null), 5000)),
  ]);
  assert.ok(r, `[${runtime}] the interrupted run settled within the bound (no orphaned sleep held it open)`);
  assert.equal(r.interrupted, true, `[${runtime}] the run is flagged interrupted`);
  assert.deepEqual(r.steps.map((s) => s.title).sort(), ['sleep 30', 'sleep 30'], `[${runtime}] the trailing step never ran`);
  assert.ok(r.steps.every((s) => s.interrupted && !s.ok), `[${runtime}] each running step reads as interrupted, not failed`);
}

// 5. A captured child that EXITS while a grandchild keeps the pipe open (the
//    leaked-dev-server shape): the grace bound resolves the step as truncated,
//    REAPS the group so the grandchild does not outlive the run, and drops the
//    pipe handles so the process can exit. Without the reap, `pgrep` still
//    finds the sleep and this script's exit waits on its handles.
{
  const marker = `sleep 31.7${runtime === 'bun' ? '1' : '3'}`;
  const { steps } = normalizeSteps([{ title: 'G', parallel: 2, steps: [{ title: 'leaky', run: `${marker} & echo hi; exit 0` }] }]);
  const t0 = Date.now();
  const r = await Promise.race([
    runCi(steps, process.cwd(), { ...quiet, closeGraceMs: 300 }).done,
    new Promise((res) => setTimeout(() => res(null), 5000)),
  ]);
  assert.ok(r, `[${runtime}] the run settled within the bound despite the leaked grandchild`);
  assert.ok(Date.now() - t0 < 4000, `[${runtime}] settled through the grace, not by waiting on the sleep`);
  const leaky = r.steps[0];
  assert.equal(leaky.ok, true, `[${runtime}] exit 0 still passes`);
  assert.equal(leaky.truncated, true, `[${runtime}] marked truncated`);
  assert.match(leaky.output, /hi\n/, `[${runtime}] the output before the leak was kept`);
  await new Promise((res) => setTimeout(res, 200));
  const { spawnSync } = await import('node:child_process');
  const left = spawnSync('pgrep', ['-f', marker], { encoding: 'utf8' });
  assert.equal(left.status, 1, `[${runtime}] the leaked grandchild was reaped with its group (pgrep found: ${left.stdout.trim()})`);
}

console.log(`[${runtime}] ci-runner cross-runtime asserts passed`);
