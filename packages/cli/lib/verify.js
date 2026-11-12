/**
 * `webjs verify`: the whole "does the app work" check in one call (#1697), the
 * shape of Rails' `bin/ci`. It runs `webjs check`, `webjs typecheck` and
 * `webjs test`, then the app's `webjs.dev.before` steps (the migrations and
 * the stylesheet `webjs dev` would apply) and an in-process boot that requests
 * every page and GET route needing no parameter (`webjs status --boot`).
 *
 * Eval agents spent about 19 turns per build after the app first booted, most
 * of them starting a dev server, curling routes and stopping it, and those late
 * turns are the expensive ones: the context is past the 100K-token price tier
 * by then. One call replaces that loop. Every step runs even after a failure,
 * so one call reports everything; a passing step prints one line, a failing
 * one the tail of its output.
 *
 * Pure of `process`: the steps' runner, the output and the before-step reader
 * are injectable, so the flow is unit-tested without spawning.
 *
 * @module
 */
import { spawn as nodeSpawn } from 'node:child_process';

/** How many trailing lines of a failing step's output to print. */
export const FAIL_TAIL_LINES = 40;

/**
 * Run one command, capturing stdout and stderr together.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd: string, env: Record<string, string | undefined>, shell?: boolean }} opts
 * @returns {Promise<{ code: number, output: string }>}
 */
export function runCaptured(cmd, args, opts) {
  return new Promise((resolve) => {
    let output = '';
    const child = nodeSpawn(cmd, args, { cwd: opts.cwd, env: opts.env, shell: !!opts.shell, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (e) => resolve({ code: 1, output: output + String(e) }));
    child.on('exit', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), output }));
  });
}

/**
 * The last `n` non-empty lines of a step's output, without stack frames: a
 * failing render is reported with its file, line and code frame, so the raw
 * frames the server also logs are only noise to an agent.
 * @param {string} output
 * @param {number} [n]
 * @returns {string}
 */
export function tail(output, n = FAIL_TAIL_LINES) {
  const lines = output.replace(/\x1b\[[0-9;]*m/g, '').split('\n')
    .filter((l) => l.trim() && !/^\s+at\s/.test(l));
  return (lines.length > n ? ['...', ...lines.slice(-n)] : lines).join('\n');
}

/**
 * @param {{
 *   appDir: string,
 *   cliBin: string,
 *   execPath?: string,
 *   env?: Record<string, string | undefined>,
 *   beforeSteps?: string[],
 *   run?: (cmd: string, args: string[], opts: { cwd: string, env: Record<string, string | undefined>, shell?: boolean }) => Promise<{ code: number, output: string }>,
 *   out?: (s: string) => void,
 * }} opts
 * @returns {Promise<number>} the exit code: 0 when every step passed, else 1
 */
export async function runVerify(opts) {
  const {
    appDir, cliBin, execPath = process.execPath, beforeSteps = [],
    run = runCaptured,
    out = (s) => process.stdout.write(s + '\n'),
  } = opts;
  // A nested `node --test` would report to the parent run instead of setting
  // its own exit code, so the test step never inherits the context.
  const env = { ...(opts.env || process.env) };
  delete env.NODE_TEST_CONTEXT;
  const cli = (args) => run(execPath, [cliBin, ...args], { cwd: appDir, env });
  /** @type {Array<{ title: string, exec: () => Promise<{ code: number, output: string }> }>} */
  const steps = [
    { title: 'check', exec: () => cli(['check']) },
    { title: 'typecheck', exec: () => cli(['typecheck']) },
    { title: 'test', exec: () => cli(['test']) },
    {
      title: 'boot',
      exec: async () => {
        // What `webjs dev` runs first (the migrations, the stylesheet), so the
        // boot serves the schema and styles the app would.
        // A before-step's output is shown only when that step fails.
        for (const step of beforeSteps) {
          const r = await run(step, [], { cwd: appDir, env, shell: true });
          if (r.code !== 0) return { code: r.code, output: `${r.output}\nbefore-step failed: ${step}` };
        }
        return cli(['status', '--boot']);
      },
    },
  ];
  let failed = 0;
  for (const step of steps) {
    const started = Date.now();
    const r = await step.exec();
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (r.code === 0) {
      out(`ok    ${step.title} (${secs}s)`);
    } else {
      failed++;
      out(`FAIL  ${step.title} (${secs}s, exit ${r.code})`);
      const t = tail(r.output);
      if (t) out(t.split('\n').map((l) => `      ${l}`).join('\n'));
    }
  }
  out(failed
    ? `webjs verify: ${failed} of ${steps.length} steps failed`
    : `webjs verify: all ${steps.length} steps passed (check, typecheck, test, every route booted)`);
  return failed ? 1 : 0;
}
