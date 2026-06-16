import { spawn as nodeSpawn } from 'node:child_process';

/**
 * Run the configured `before` steps (#550) sequentially to completion. Returns
 * the FIRST failure so the caller can abort the boot, or `{ ok: true }`. Pure of
 * `process.exit` and `console` (the bin owns the exit code + logging via the
 * `onStep` hook) so the orchestration is deterministically unit-testable, with
 * `spawn` injectable for tests.
 *
 * @param {string[]} steps
 * @param {string} cwd
 * @param {{ spawn?: typeof nodeSpawn, onStep?: (step: string) => void }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, step: string, code: number }>}
 */
export async function runBeforeSteps(steps, cwd, opts = {}) {
  const spawn = opts.spawn || nodeSpawn;
  for (const step of steps) {
    if (opts.onStep) opts.onStep(step);
    const code = await new Promise((res) => {
      const c = spawn(step, { shell: true, stdio: 'inherit', cwd });
      c.on('exit', (code) => res(code ?? 0));
      c.on('error', () => res(1));
    });
    if (code !== 0) return { ok: false, step, code };
  }
  return { ok: true };
}

/**
 * Spawn the configured dev `parallel` tasks (#550) as long-lived children and
 * return a killer that tears them ALL down (idempotent), so a watcher cannot
 * leak past the dev server. `spawn` is injectable for tests.
 *
 * @param {string[]} commands
 * @param {string} cwd
 * @param {{ spawn?: typeof nodeSpawn, onStart?: (cmd: string) => void }} [opts]
 * @returns {() => void}
 */
export function startParallelTasks(commands, cwd, opts = {}) {
  const spawn = opts.spawn || nodeSpawn;
  const children = commands.map((cmd) => {
    if (opts.onStart) opts.onStart(cmd);
    return spawn(cmd, { shell: true, stdio: 'inherit', cwd });
  });
  let killed = false;
  return () => {
    if (killed) return;
    killed = true;
    for (const c of children) {
      try { c.kill(); } catch {}
    }
  };
}
