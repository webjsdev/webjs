import { spawn as nodeSpawn } from 'node:child_process';
import { delimiter, dirname, join } from 'node:path';

/**
 * Build a PATH the way `npm run` does: prepend every ANCESTOR
 * `node_modules/.bin` (the app's, then up to the repo root for a hoisted
 * monorepo) so a `before` / `parallel` command naming a LOCAL-only binary
 * (`drizzle-kit`, `tailwindcss`) resolves under a bare `webjs dev` / `start`, exactly
 * as it does under `npm run dev`. Without this a bare `webjs dev` exits 127 on
 * the first such step and aborts the boot, defeating the whole #550 point.
 *
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [env]
 */
function envWithLocalBin(cwd, env = process.env) {
  const bins = [];
  let dir = cwd;
  // Walk up to the filesystem root, collecting each node_modules/.bin.
  for (;;) {
    bins.push(join(dir, 'node_modules', '.bin'));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { ...env, PATH: [...bins, env.PATH || ''].join(delimiter) };
}

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
  const env = envWithLocalBin(cwd);
  for (const step of steps) {
    if (opts.onStep) opts.onStep(step);
    const code = await new Promise((res) => {
      const c = spawn(step, { shell: true, stdio: 'inherit', cwd, env });
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
  const env = envWithLocalBin(cwd);
  const children = commands.map((cmd) => {
    if (opts.onStart) opts.onStart(cmd);
    // `detached: true` puts the child in its OWN process group, so the killer
    // can take down the whole tree (the `sh -c` wrapper AND the watcher it
    // spawns, e.g. tailwindcss) rather than just the shell, which would leak the
    // watcher as an orphan.
    return spawn(cmd, { shell: true, stdio: 'inherit', cwd, env, detached: true });
  });
  let killed = false;
  return () => {
    if (killed) return;
    killed = true;
    for (const c of children) killChildTree(c);
  };
}

/**
 * Tear down a shell-spawned child's whole process GROUP. A `sh -c '<watcher>'`
 * child run with `detached: true` is a group leader, so a NEGATIVE pid signals
 * the group (the shell + the watcher). Falls back to a direct `kill()` when
 * there is no numeric pid (a fake child in a test) or the group kill is
 * unsupported (a non-POSIX runtime), so the killer never throws.
 *
 * @param {import('node:child_process').ChildProcess} child
 */
function killChildTree(child) {
  try {
    if (typeof child.pid === 'number') process.kill(-child.pid, 'SIGTERM');
    else child.kill();
  } catch {
    try { child.kill(); } catch {}
  }
}
