/**
 * `webjs verify`: the whole "does the app work" check in one call (#1697), the
 * shape of Rails' `bin/ci` for the local loop. It runs `webjs check` and
 * `webjs typecheck` in parallel, then `webjs test`, then the app's
 * `webjs.dev.before` steps (the migrations and stylesheet `webjs dev` would
 * apply) and an in-process boot that requests every page and GET route needing
 * no parameter (`webjs status --boot`).
 *
 * Eval agents spent about 19 turns per build after the app first booted, most
 * of them starting a dev server, curling routes and stopping it, and those late
 * turns are the expensive ones: the context is past the 100K-token price tier
 * by then. One call replaces that loop.
 *
 * It runs on the `webjs ci` engine (`runCi` in ci-runner.js) with every step
 * captured and its own report silenced, so there is one runner for captured
 * steps, parallel groups and the stream-close handling. It does NOT run the
 * app's `webjs.ci.steps`: that list is the full gate (doctor, a network
 * dependency audit, browser and e2e tests), and verify is the fast check an
 * agent runs when a feature is done. Every step runs even after a failure, so
 * one call reports everything; a pass is one line, a failure the tail of its
 * output.
 *
 * Pure of `process`: the engine's spawn, the output and the before-steps are
 * injectable, so the flow is unit-tested without spawning a real step.
 *
 * @module
 */
import { runCi } from './ci-runner.js';

/** How many trailing lines of a failing step's output to print. */
export const FAIL_TAIL_LINES = 40;

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
 * The steps verify runs, as `webjs ci` nodes.
 * @param {string} cli the command that runs this CLI (`node <bin>`)
 * @param {string[]} beforeSteps the app's `webjs.dev.before` commands
 * @returns {import('./ci-config.js').CiNode[]}
 */
export function verifySteps(cli, beforeSteps) {
  const step = (title, run) => ({ kind: /** @type {'step'} */ ('step'), title, run, env: {} });
  /** @type {import('./ci-config.js').CiNode[]} */
  const nodes = [
    { kind: 'group', title: 'checks', parallel: 2, steps: [step('check', `${cli} check`), step('typecheck', `${cli} typecheck`)] },
    step('test', `${cli} test`),
  ];
  // What `webjs dev` runs first, so the boot serves the schema and styles the
  // app would. Its own step, so its output shows only when it fails.
  if (beforeSteps.length) nodes.push(step('prepare', beforeSteps.join(' && ')));
  nodes.push(step('boot', `${cli} status --boot`));
  return nodes;
}

/**
 * @param {{
 *   appDir: string,
 *   cli: string,
 *   env?: NodeJS.ProcessEnv,
 *   beforeSteps?: string[],
 *   spawn?: Function,
 *   out?: (s: string) => void,
 * }} opts
 * @returns {Promise<number>} the exit code: 0 when every step passed, else 1
 */
export async function runVerify(opts) {
  const { appDir, cli, beforeSteps = [], out = (s) => process.stdout.write(s + '\n') } = opts;
  // A nested `node --test` would report to the parent run instead of setting
  // its own exit code, so no step inherits the context.
  const env = { ...(opts.env || process.env) };
  delete env.NODE_TEST_CONTEXT;
  const { done } = runCi(verifySteps(cli, beforeSteps), appDir, {
    env,
    captureAll: true,
    write: () => {},
    ...(opts.spawn ? { spawn: opts.spawn } : {}),
  });
  const result = await done;
  const order = ['check', 'typecheck', 'test', 'prepare', 'boot'];
  const steps = [...result.steps].sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));
  let failed = 0;
  for (const r of steps) {
    const secs = r.seconds.toFixed(1);
    if (r.ok) {
      out(`ok    ${r.title} (${secs}s)`);
    } else {
      failed++;
      out(`FAIL  ${r.title} (${secs}s, exit ${r.code ?? r.signal})`);
      const t = tail(r.output || '');
      if (t) out(t.split('\n').map((l) => `      ${l}`).join('\n'));
    }
  }
  out(failed
    ? `webjs verify: ${failed} of ${steps.length} steps failed`
    : `webjs verify: all ${steps.length} steps passed (check, typecheck, test, every route booted)`);
  return failed || !result.ok ? 1 : 0;
}
