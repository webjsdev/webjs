import { spawn as nodeSpawn } from 'node:child_process';
import { envWithLocalBin, killChildTree } from './run-tasks.js';

/**
 * The `webjs ci` runner (#1471): executes a normalized step tree (see
 * `ci-config.js`) the way Rails 8.1's `ActiveSupport::ContinuousIntegration`
 * does. Each step prints a heading (title + command), runs, and prints
 * `✅ <title> passed in 2.11s` or `❌ <title> failed in 0.01s`; the run ends
 * with a failure list and one total line. A group with `parallel > 1` runs
 * its steps on that many slots with each step's output CAPTURED and replayed
 * whole when it finishes, so two steps never interleave, and a progress line
 * names what is running; a group nested inside it takes ONE slot and runs its
 * steps in order.
 *
 * Two spawn shapes, deliberately different:
 *
 * - A SEQUENTIAL step inherits stdio and is NOT detached, so it owns the
 *   terminal while it runs and a Ctrl-C reaches it natively, the same split
 *   `webjs dev` makes for its `before` steps versus its `parallel` watchers
 *   (`run-tasks.js`). It resolves on `exit`.
 * - A CAPTURED step is detached (its own process group, so `interrupt()` can
 *   take down the whole tree, shell wrapper included) with stdin IGNORED (a
 *   child that reads the TTY would otherwise stop on SIGTTIN and hang the
 *   pool), stdout and stderr piped and buffered in arrival order, and it
 *   resolves on `close`, not `exit`, because data can still be in the pipe
 *   after `exit`. A bounded grace after `exit` covers a leaked grandchild that
 *   holds the pipe open forever: the step completes with what was captured
 *   and is marked truncated instead of hanging the run.
 *
 * Every child gets `CI=true` (so an app can branch on it, as under any CI
 * provider) and every ancestor `node_modules/.bin` on PATH (`envWithLocalBin`,
 * the npm-run behaviour), then the step's own `env`. A captured child gets
 * `FORCE_COLOR=1` only when the PARENT's stdout is a TTY, so a terminal keeps
 * the tools' colours through the pipe and a log file never gets escape codes.
 * Node has no PTY without a native dependency, which a buildless framework
 * will not take on, so this is the whole colour story.
 *
 * Pure of `process.exit`, `console`, and the real clock: the bin owns the exit
 * code and the writer, `spawn` / `now` / `timers` / `write` are injectable, so
 * the pool cap, the fail-fast cutoff, the replay atomicity, and the
 * exit-then-data ordering are all deterministically unit-testable with a
 * fake child (the same discipline as `run-tasks.js`).
 *
 * @typedef {import('./ci-config.js').CiNode} CiNode
 * @typedef {import('./ci-config.js').CiStep} CiStep
 * @typedef {{
 *   title: string, run: string, group: string | null,
 *   ok: boolean, code: number | null, signal: string | null, interrupted: boolean,
 *   seconds: number, output: string | null, truncated: boolean,
 * }} StepResult
 * @typedef {{ ok: boolean, seconds: number, steps: StepResult[], interrupted: boolean }} CiResult
 */

const COLORS = {
  banner: '\x1b[1;32m',
  title: '\x1b[1;35m',
  subtitle: '\x1b[1;90m',
  error: '\x1b[1;31m',
  success: '\x1b[1;32m',
  progress: '\x1b[1;36m',
};
const RESET = '\x1b[0m';

/** Grace after `exit` for a captured child whose pipe a grandchild still holds. */
const CLOSE_GRACE_MS = 2000;
const PROGRESS_INTERVAL_MS = 100;

/**
 * @param {string} text
 * @param {keyof typeof COLORS} type
 * @param {boolean} color
 */
export function colorize(text, type, color) {
  return color ? `${COLORS[type]}${text}${RESET}` : text;
}

/**
 * Rails' `format_elapsed`: `2.11s`, or `1m2.11s` past a minute.
 * @param {number} seconds
 */
export function formatElapsed(seconds) {
  const s = Math.max(0, seconds);
  const min = Math.floor(s / 60);
  const sec = s - min * 60;
  return `${min > 0 ? `${min}m` : ''}${sec.toFixed(2)}s`;
}

/** The brief form the progress line uses (`12s`, `1m3s`). @param {number} seconds */
function formatElapsedBrief(seconds) {
  const s = Math.max(0, seconds);
  const min = Math.floor(s / 60);
  const sec = Math.floor(s - min * 60);
  return `${min > 0 ? `${min}m` : ''}${sec}s`;
}

/**
 * A step heading: the title in the title colour, the command as a subtitle,
 * padded by two blank lines like Rails' `heading`.
 * @param {{ title: string, run: string }} step
 * @param {boolean} color
 */
export function formatHeading(step, color) {
  return `\n\n${colorize(step.title, 'title', color)}\n${colorize(step.run, 'subtitle', color)}\n`;
}

/**
 * The per-step result line, and the total line (same shape, Rails' `result_line`).
 * @param {{ title: string, ok: boolean, seconds: number, interrupted?: boolean }} r
 * @param {boolean} color
 */
export function formatResult(r, color) {
  if (r.interrupted) return `\n${colorize(`❌ ${r.title} interrupted`, 'error', color)}\n`;
  const elapsed = formatElapsed(r.seconds);
  return r.ok
    ? `\n${colorize(`✅ ${r.title} passed in ${elapsed}`, 'success', color)}\n`
    : `\n${colorize(`❌ ${r.title} failed in ${elapsed}`, 'error', color)}\n`;
}

/**
 * The single-line progress indicator for a parallel group: which steps are
 * running and for how long the group has been at it.
 * @param {string} label the group title
 * @param {number} seconds elapsed since the group started
 * @param {string[]} running titles currently in flight
 * @param {boolean} color
 */
export function formatProgress(label, seconds, running, color) {
  return colorize(`${label} (${formatElapsedBrief(seconds)}) - ${running.join(' | ')}...`, 'progress', color);
}

/**
 * The end-of-run block: every failed step (when more than one step ran, as
 * Rails does), then the total line.
 * @param {CiResult} result
 * @param {string} title
 * @param {boolean} color
 */
export function formatSummary(result, title, color) {
  let out = '';
  const failed = result.steps.filter((s) => !s.ok);
  if (failed.length > 0 && result.steps.length > 1) {
    for (const s of failed) {
      out += `${colorize(`   ↳ ${s.title} ${s.interrupted ? 'interrupted' : 'failed'}`, 'error', color)}\n`;
    }
  }
  out += formatResult({ title, ok: result.ok, seconds: result.seconds, interrupted: result.interrupted && result.ok }, color);
  return out;
}

/**
 * A GitHub Actions job-summary table (`$GITHUB_STEP_SUMMARY`), so a single
 * cloud job running the whole list still shows one row per layer. Pipes are
 * escaped because a title or command may carry one.
 * @param {CiResult} result
 */
export function stepSummaryMarkdown(result) {
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  const rows = result.steps.map((s) => {
    const state = s.interrupted ? '⏹ interrupted' : s.ok ? '✅ passed' : `❌ failed (exit ${s.code ?? s.signal})`;
    return `| ${esc(s.title)} | \`${esc(s.run)}\` | ${state} | ${formatElapsed(s.seconds)} |`;
  });
  const head = result.ok ? '✅ Local CI passed' : '❌ Local CI failed';
  return `### ${head} in ${formatElapsed(result.seconds)}\n\n| Step | Command | Result | Time |\n|---|---|---|---|\n${rows.join('\n')}\n`;
}

/**
 * Run a step tree. Returns `{ done, interrupt }`: `done` resolves to the
 * `CiResult` (never rejects; a spawn error is a failed step), `interrupt()` is
 * what the bin wires to SIGINT: it kills every running child (the whole
 * process group of a captured one), stops any further dequeue, and lets the
 * run wind down to a result flagged `interrupted`.
 *
 * @param {CiNode[]} steps
 * @param {string} cwd
 * @param {{
 *   spawn?: typeof nodeSpawn,
 *   write?: (s: string) => void,
 *   isTTY?: boolean,
 *   color?: boolean,
 *   now?: () => number,
 *   timers?: { setInterval: Function, clearInterval: Function, setTimeout: Function, clearTimeout: Function },
 *   failFast?: boolean,
 *   captureAll?: boolean,
 *   env?: NodeJS.ProcessEnv,
 *   actions?: boolean,
 *   closeGraceMs?: number,
 * }} [opts]
 * @returns {{ done: Promise<CiResult>, interrupt: () => void }}
 */
export function runCi(steps, cwd, opts = {}) {
  const ctx = {
    spawn: opts.spawn || nodeSpawn,
    write: opts.write || ((s) => { process.stdout.write(s); }),
    isTTY: !!opts.isTTY,
    color: opts.color ?? !!opts.isTTY,
    now: opts.now || (() => performance.now() / 1000),
    timers: opts.timers || { setInterval, clearInterval, setTimeout, clearTimeout },
    failFast: !!opts.failFast,
    captureAll: !!opts.captureAll,
    baseEnv: envWithLocalBin(cwd, opts.env || process.env),
    actions: !!opts.actions,
    closeGraceMs: opts.closeGraceMs ?? CLOSE_GRACE_MS,
    cwd,
    /** @type {StepResult[]} */
    results: [],
    /** @type {Set<import('node:child_process').ChildProcess>} */
    running: new Set(),
    interrupted: false,
    /** Fail-fast cutoff: set on the first failure when `failFast` is on. */
    stopped: false,
  };

  const interrupt = () => {
    if (ctx.interrupted) return;
    ctx.interrupted = true;
    ctx.stopped = true;
    for (const child of ctx.running) {
      if (child.__webjsDetached) killChildTree(child);
      else { try { child.kill('SIGINT'); } catch {} }
    }
  };

  const done = (async () => {
    const started = ctx.now();
    await runSequence(steps, null, ctx);
    const seconds = ctx.now() - started;
    const ok = !ctx.interrupted && ctx.results.length > 0 && ctx.results.every((r) => r.ok);
    return { ok, seconds, steps: ctx.results, interrupted: ctx.interrupted };
  })();

  return { done, interrupt };
}

/** Whether the run should stop dequeuing (interrupt, or a fail-fast cutoff). */
function halted(ctx) {
  return ctx.stopped;
}

/**
 * Run nodes in order (the sequential path). A parallel group hands off to the
 * pool; a sequential group simply flattens into this walk, as Rails'
 * `instance_eval` does. `capture` is true when this sequence is itself inside
 * a parallel slot, so each of its steps is captured rather than inheriting.
 *
 * @param {CiNode[]} nodes
 * @param {string | null} group
 * @param {object} ctx
 * @param {boolean} [capture]
 */
async function runSequence(nodes, group, ctx, capture = false) {
  for (const node of nodes) {
    if (halted(ctx)) return;
    if (node.kind === 'group') {
      if (node.parallel > 1 && !capture) await runPool(node, ctx);
      else await runSequence(node.steps, node.title, ctx, capture);
      continue;
    }
    const r = await runOne(node, group, ctx, capture || ctx.captureAll);
    if (capture || ctx.captureAll) report(r, ctx);
  }
}

/**
 * A parallel group: N slots pulling from the group's task list. A task is one
 * step, or one nested group run sequentially in that slot. Each finished step
 * is reported whole (heading + captured output + result line) as it lands.
 * Fail-fast stops the DEQUEUE after the first failure; in-flight steps finish.
 *
 * @param {{ title: string, parallel: number, steps: CiNode[] }} group
 * @param {object} ctx
 */
async function runPool(group, ctx) {
  const queue = [...group.steps];
  const inFlight = new Set();
  const startedAt = ctx.now();
  const progress = ctx.isTTY ? startProgress(group.title, startedAt, inFlight, ctx) : null;

  const worker = async () => {
    while (queue.length > 0 && !halted(ctx)) {
      const node = queue.shift();
      if (node.kind === 'group') {
        await runSequence(node.steps, node.title, ctx, true);
      } else {
        inFlight.add(node.title);
        const r = await runOne(node, group.title, ctx, true);
        inFlight.delete(node.title);
        progress?.clear();
        report(r, ctx);
        progress?.redraw();
      }
    }
  };
  const slots = Math.min(group.parallel, queue.length);
  await Promise.all(Array.from({ length: slots }, () => worker()));
  progress?.stop();
}

/**
 * The 10 Hz progress line: what the group is running and for how long. TTY
 * only (the bin never asks for it otherwise), cleared before every replay so
 * it never lands inside a step's output, `unref`ed so a hung child does not
 * keep the process alive through the timer.
 */
function startProgress(label, startedAt, inFlight, ctx) {
  let visible = false;
  const draw = () => {
    if (inFlight.size === 0) return;
    ctx.write(`\r\x1b[K${formatProgress(label, ctx.now() - startedAt, [...inFlight], ctx.color)}`);
    visible = true;
  };
  const clear = () => {
    if (!visible) return;
    ctx.write('\r\x1b[K');
    visible = false;
  };
  const handle = ctx.timers.setInterval(draw, PROGRESS_INTERVAL_MS);
  if (handle && typeof handle.unref === 'function') handle.unref();
  return {
    clear,
    redraw: draw,
    stop: () => { ctx.timers.clearInterval(handle); clear(); },
  };
}

/**
 * Write a captured step's heading, its replayed output, and its result line,
 * as one uninterrupted sequence (JS is single-threaded, so nothing else can
 * write between these calls). A GitHub Actions run additionally folds the
 * step into a log group and annotates a failure, which is what keeps "a
 * failure names its layer" true inside a single job.
 * @param {StepResult} r
 * @param {object} ctx
 */
function report(r, ctx) {
  if (ctx.actions) ctx.write(`::group::${r.title}\n`);
  ctx.write(formatHeading(r, ctx.color));
  if (r.output) ctx.write(r.output.endsWith('\n') ? r.output : `${r.output}\n`);
  if (r.truncated) ctx.write(colorize('(output truncated: a child process kept the pipe open after exit)', 'subtitle', ctx.color) + '\n');
  ctx.write(formatResult(r, ctx.color));
  if (ctx.actions) {
    ctx.write('::endgroup::\n');
    if (!r.ok) ctx.write(`::error title=${r.title}::${r.title} ${r.interrupted ? 'was interrupted' : `failed (exit ${r.code ?? r.signal})`}\n`);
  }
}

/**
 * Run one command step and record its result. Inherit mode writes the heading
 * up front (the child owns the terminal next); capture mode returns the
 * output for the caller to report atomically.
 *
 * @param {CiStep} step
 * @param {string | null} group
 * @param {object} ctx
 * @param {boolean} capture
 * @returns {Promise<StepResult>}
 */
async function runOne(step, group, ctx, capture) {
  const env = {
    ...ctx.baseEnv,
    CI: 'true',
    ...(capture && ctx.isTTY ? { FORCE_COLOR: '1' } : {}),
    ...step.env,
  };
  if (!capture) {
    if (ctx.actions) ctx.write(`::group::${step.title}\n`);
    ctx.write(formatHeading(step, ctx.color));
  }
  const started = ctx.now();
  const exit = capture ? await spawnCaptured(step, env, ctx) : await spawnInherited(step, env, ctx);
  const seconds = ctx.now() - started;
  const interrupted = ctx.interrupted && exit.signal !== null;
  const ok = exit.code === 0 && exit.signal === null;
  /** @type {StepResult} */
  const r = {
    title: step.title,
    run: step.run,
    group,
    ok,
    code: exit.code,
    signal: exit.signal,
    interrupted,
    seconds,
    output: capture ? exit.output : null,
    truncated: !!exit.truncated,
  };
  ctx.results.push(r);
  if (!ok && ctx.failFast) ctx.stopped = true;
  if (!capture) {
    ctx.write(formatResult(r, ctx.color));
    if (ctx.actions) {
      ctx.write('::endgroup::\n');
      if (!ok) ctx.write(`::error title=${r.title}::${r.title} ${interrupted ? 'was interrupted' : `failed (exit ${r.code ?? r.signal})`}\n`);
    }
  }
  return r;
}

/** @returns {Promise<{ code: number | null, signal: string | null }>} */
function spawnInherited(step, env, ctx) {
  return new Promise((resolve) => {
    let child;
    try {
      child = ctx.spawn(step.run, { shell: true, stdio: 'inherit', cwd: ctx.cwd, env });
    } catch {
      resolve({ code: 1, signal: null });
      return;
    }
    ctx.running.add(child);
    let settled = false;
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      ctx.running.delete(child);
      resolve({ code: code ?? (signal ? null : 0), signal: signal || null });
    };
    child.on('exit', (code, signal) => finish(code, signal));
    child.on('error', () => finish(1, null));
  });
}

/**
 * @returns {Promise<{ code: number | null, signal: string | null, output: string, truncated: boolean }>}
 */
function spawnCaptured(step, env, ctx) {
  return new Promise((resolve) => {
    let child;
    try {
      child = ctx.spawn(step.run, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: ctx.cwd,
        env,
        detached: true,
      });
    } catch (e) {
      resolve({ code: 1, signal: null, output: `${e && e.message ? e.message : String(e)}\n`, truncated: false });
      return;
    }
    child.__webjsDetached = true;
    ctx.running.add(child);
    /** @type {Buffer[]} */
    const chunks = [];
    const collect = (chunk) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    let settled = false;
    let exited = null;
    let grace = null;
    const finish = (truncated) => {
      if (settled) return;
      settled = true;
      if (grace) ctx.timers.clearTimeout(grace);
      ctx.running.delete(child);
      const { code, signal } = exited || { code: 1, signal: null };
      resolve({ code, signal, output: Buffer.concat(chunks).toString('utf8'), truncated });
    };
    child.on('exit', (code, signal) => {
      exited = { code: code ?? (signal ? null : 0), signal: signal || null };
      // `close` normally follows within a tick. A leaked grandchild holding the
      // pipe would keep it from ever firing, so bound the wait.
      grace = ctx.timers.setTimeout(() => finish(true), ctx.closeGraceMs);
      if (grace && typeof grace.unref === 'function') grace.unref();
    });
    child.on('close', (code, signal) => {
      if (!exited) exited = { code: code ?? (signal ? null : 0), signal: signal || null };
      finish(false);
    });
    child.on('error', (e) => {
      chunks.push(Buffer.from(`${e && e.message ? e.message : String(e)}\n`));
      exited = exited || { code: 1, signal: null };
      finish(false);
    });
  });
}
