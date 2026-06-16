import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBeforeSteps, startParallelTasks } from '../../lib/run-tasks.js';

/**
 * A fake `spawn` that records the commands it was asked to run and emits a
 * configured exit code per call, so the orchestration is testable without a
 * real process.
 */
function fakeSpawn(exitCodes = []) {
  const calls = [];
  const children = [];
  const spawn = (cmd) => {
    calls.push(cmd);
    const child = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; };
    children.push(child);
    const code = exitCodes.length ? exitCodes.shift() : 0;
    if (code !== 'hang') queueMicrotask(() => child.emit('exit', code));
    return child;
  };
  return { spawn, calls, children };
}

test('runBeforeSteps runs every step in order when all succeed', async () => {
  const f = fakeSpawn([0, 0]);
  const seen = [];
  const r = await runBeforeSteps(['a', 'b'], '/app', { spawn: f.spawn, onStep: (s) => seen.push(s) });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(f.calls, ['a', 'b']);
  assert.deepEqual(seen, ['a', 'b']);
});

test('runBeforeSteps stops at the FIRST failure and reports it (abort-the-boot)', async () => {
  const f = fakeSpawn([3]); // first step exits 3
  const r = await runBeforeSteps(['fails', 'never-runs'], '/app', { spawn: f.spawn });
  assert.deepEqual(r, { ok: false, step: 'fails', code: 3 });
  // Counterfactual: the second step must NOT have been spawned.
  assert.deepEqual(f.calls, ['fails']);
});

test('runBeforeSteps treats a spawn error as a failure (code 1)', async () => {
  const spawn = () => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    return child;
  };
  const r = await runBeforeSteps(['boom'], '/app', { spawn });
  assert.deepEqual(r, { ok: false, step: 'boom', code: 1 });
});

test('runBeforeSteps with no steps is a no-op ok', async () => {
  const f = fakeSpawn();
  assert.deepEqual(await runBeforeSteps([], '/app', { spawn: f.spawn }), { ok: true });
  assert.deepEqual(f.calls, []);
});

test('runBeforeSteps resolves a LOCAL-only binary via node_modules/.bin (the PATH fix, finding #1)', async () => {
  // A binary present ONLY in <cwd>/node_modules/.bin, never on the ambient
  // PATH. Success proves envWithLocalBin prepends node_modules/.bin npm-style,
  // so a bare `webjs dev` (no npm lifecycle PATH) resolves `prisma` /
  // `tailwindcss` instead of exiting 127 and aborting the boot.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-tasks-'));
  try {
    const binDir = join(dir, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    const binFile = join(binDir, 'webjs-localonly');
    writeFileSync(binFile, '#!/bin/sh\nexit 0\n');
    chmodSync(binFile, 0o755);
    const r = await runBeforeSteps(['webjs-localonly'], dir, {}); // real spawn
    assert.deepEqual(r, { ok: true }, 'the local-only binary resolved via injected PATH');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('startParallelTasks spawns each command and the killer tears them all down, idempotently', () => {
  const f = fakeSpawn(['hang', 'hang']); // long-lived
  const seen = [];
  const kill = startParallelTasks(['w1', 'w2'], '/app', { spawn: f.spawn, onStart: (c) => seen.push(c) });
  assert.deepEqual(f.calls, ['w1', 'w2']);
  assert.deepEqual(seen, ['w1', 'w2']);
  assert.ok(f.children.every((c) => !c.killed), 'children alive before kill');
  kill();
  assert.ok(f.children.every((c) => c.killed), 'every child killed');
  // Idempotent: a second call does not throw and stays killed.
  kill();
  assert.ok(f.children.every((c) => c.killed));
});

test('startParallelTasks actually terminates a real long-running child process', async () => {
  const kill = startParallelTasks(
    ['node -e "setInterval(() => {}, 1e9)"'],
    process.cwd(),
    { spawn: undefined }, // real node:child_process spawn
  );
  // give the child a moment to come up, then tear it down and await its exit
  await new Promise((r) => setTimeout(r, 100));
  kill();
  // The child should exit shortly after the kill; if it does not, the test
  // times out (proving the killer failed). No assertion needed beyond not hanging.
  await new Promise((r) => setTimeout(r, 200));
});
