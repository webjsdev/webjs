/**
 * The `webjs dev` reload supervisor (#1521): runs the dev server in a child
 * process, restarts it when a watched file changes, and brings it back when it
 * crashes. Replaces `node --watch`, which crashed on the first watcher error it
 * could not handle (an EACCES on another user's `sed -i` temp file, a file that
 * vanished between the directory event and the watch call) and left the
 * preview dead until someone restarted `webjs dev` by hand.
 *
 * Three pieces, each testable on its own:
 * - `watchRestartPaths` watches the planned dirs recursively and the planned
 *   root files, handles every watcher error with a warning, and follows a
 *   watched dir that is created or removed after start.
 * - `createSupervisor` is the restart state machine. It takes injected spawn
 *   and timer functions, so its behaviour is tested without a process.
 * - `superviseDevServer` wires both to a real child, the signals, and a
 *   last-resort `uncaughtException` guard that swallows only watcher errors.
 *
 * The planning (which runtime, which paths, restart on change or only on a
 * crash) stays in `dev-supervisor.js`.
 */
import { spawn } from 'node:child_process';
import { watch, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { watchRecursive } from './watch-recursive.js';
import { PORT_IN_USE_EXIT_CODE } from './port.js';

/**
 * Quiet window between a file event and the restart. `node --watch` used
 * 200ms; one editor save or `sed -i` lands its events within a few ms of each
 * other, so 50ms still coalesces a save while starting the restart 150ms
 * sooner.
 */
export const RESTART_DEBOUNCE_MS = 50;

/**
 * Delays before restarting a child that exited on its own (a crash), indexed
 * by consecutive crash count and capped at the last entry. A file change
 * restarts it at once regardless, so the backoff only matters when nothing is
 * being edited: the preview comes back within seconds, and a child that fails
 * deterministically at boot is retried every 10s instead of in a tight loop.
 */
export const CRASH_BACKOFF_MS = [500, 1000, 2000, 5000, 10000];

/** A child that stayed up this long resets the crash backoff. */
export const STABLE_MS = 10_000;

/**
 * How long a restarting child gets to exit after SIGTERM before SIGKILL. The
 * server's own drain allows 10s, which is right for a deploy and far too long
 * to hold an edit back in dev.
 */
export const KILL_TIMEOUT_MS = 2000;

/**
 * Paths inside a watched dir whose changes never restart the server: the same
 * noise the server's in-process watcher ignores (`shouldIgnoreWatchPath` in
 * `@webjsdev/server`), restated here so the CLI does not depend on a server
 * internal.
 *
 * @param {string} rel  path relative to the app root
 * @returns {boolean}
 */
export function shouldIgnoreRestartPath(rel) {
  return /(?:^|[\\/])(?:node_modules|\.git|\.webjs)(?:[\\/]|$)|(?:^|[\\/])db[\\/](?:dev\.db|migrations)/.test(rel || '');
}

/**
 * Whether an error came from a file watcher. Node marks every `fs.watch`
 * failure with `syscall: 'watch'`.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isWatchError(err) {
  return !!err && typeof err === 'object' && /** @type {any} */ (err).syscall === 'watch';
}

/**
 * The `webjs.dev.regenerate[].output` paths (#967), normalized to `/` with no
 * leading `./`. The server writes these on request, so one that lives under a
 * watched dir must not restart the server, or a request would restart the
 * process that is serving it. Unreadable config yields no outputs.
 *
 * @param {string} cwd
 * @returns {Set<string>}
 */
export function readRegenerateOutputs(cwd) {
  const out = new Set();
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    const rules = pkg && pkg.webjs && pkg.webjs.dev && pkg.webjs.dev.regenerate;
    if (Array.isArray(rules)) {
      for (const r of rules) {
        if (r && typeof r.output === 'string') out.add(r.output.replace(/\\/g, '/').replace(/^\.\//, ''));
      }
    }
  } catch {}
  return out;
}

/**
 * Watch the restart paths of an app. Each dir in `dirs` is watched
 * recursively; the app root is watched non-recursively, which catches an edit
 * to a root file in `files` and a dir in `dirs` appearing or disappearing.
 * Every watcher error goes to `onError` and never throws.
 *
 * @param {string} cwd  the app root
 * @param {{
 *   dirs: string[],
 *   files: string[],
 *   ignore: (rel: string) => boolean,
 *   onChange: (rel: string) => void,
 *   onError: (err: NodeJS.ErrnoException) => void,
 *   watchFn?: typeof watch,
 * }} opts
 * @returns {() => void} closes every watcher
 */
export function watchRestartPaths(cwd, { dirs, files, ignore, onChange, onError, watchFn = watch }) {
  /** @type {Map<string, import('node:fs').FSWatcher>} */
  const watchers = new Map();
  let closed = false;
  const isDir = (name) => {
    try { return statSync(join(cwd, name)).isDirectory(); } catch { return false; }
  };
  const guard = (w) => {
    w.on('error', (err) => onError(err));
    return w;
  };
  const watchDir = (name) => {
    if (closed || watchers.has(name) || !isDir(name)) return;
    try {
      // `watchRecursive` (#1529): on Linux under Node a per-directory walker,
      // since Node 24's recursive watcher goes deaf to a file once it is
      // replaced (`sed -i`, an editor's atomic save), so a second edit to the
      // same file never restarted the server.
      watchers.set(name, guard(watchRecursive(join(cwd, name), (_type, filename) => {
        const rel = filename ? join(name, String(filename)) : name;
        if (!ignore(rel)) onChange(rel);
      }, { ignore: (rel) => ignore(join(name, rel)), watchFn })));
    } catch (err) {
      onError(/** @type {NodeJS.ErrnoException} */ (err));
    }
  };
  const unwatchDir = (name) => {
    const w = watchers.get(name);
    if (!w) return;
    try { w.close(); } catch {}
    watchers.delete(name);
  };

  /** @type {import('node:fs').FSWatcher | null} */
  let root = null;
  try {
    root = guard(watchFn(cwd, (_type, filename) => {
      const name = filename ? String(filename) : '';
      if (dirs.includes(name)) {
        // A watched dir was created, replaced, or removed.
        if (isDir(name)) watchDir(name); else unwatchDir(name);
        onChange(name);
      } else if (files.includes(name)) {
        onChange(name);
      }
    }));
  } catch (err) {
    onError(/** @type {NodeJS.ErrnoException} */ (err));
  }
  for (const d of dirs) watchDir(d);

  return () => {
    closed = true;
    try { root?.close(); } catch {}
    for (const name of [...watchers.keys()]) unwatchDir(name);
  };
}

/**
 * @typedef {{
 *   pid?: number,
 *   kill: (signal?: NodeJS.Signals) => boolean | void,
 *   once: (event: 'exit', fn: (code: number | null, signal: NodeJS.Signals | null) => void) => unknown,
 * }} ChildLike
 */

/**
 * The restart state machine.
 *
 * - `change(path)` (debounced): restart a running child when `restartOnChange`
 *   (Node), or start a child that is not running (either runtime, after a
 *   crash).
 * - A restart sends SIGTERM, escalates to SIGKILL after `killTimeoutMs`, and
 *   spawns the replacement the moment the old child exits, never on a poll.
 * - A child that exits on its own is restarted after the crash backoff, or at
 *   once on the next change.
 * - `stop()` stops everything and resolves once no child is left.
 *
 * @param {{
 *   spawnChild: () => ChildLike,
 *   restartOnChange: boolean,
 *   log?: (line: string) => void,
 *   timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 *   now?: () => number,
 *   debounceMs?: number,
 *   backoffMs?: number[],
 *   stableMs?: number,
 *   killTimeoutMs?: number,
 *   finalExitCodes?: number[],
 *   onFinal?: (code: number) => void,
 *   restartFor?: (path: string) => boolean,
 * }} opts
 */
export function createSupervisor({
  spawnChild,
  restartOnChange,
  // Which changed paths restart a live child (default: all). On Bun only the
  // paths `bun --hot` cannot reload in place do (#1550); the rest it reloads
  // itself. A dead child is started by any change either way.
  restartFor = () => true,
  log = () => {},
  timers = globalThis,
  now = Date.now,
  debounceMs = RESTART_DEBOUNCE_MS,
  backoffMs = CRASH_BACKOFF_MS,
  stableMs = STABLE_MS,
  killTimeoutMs = KILL_TIMEOUT_MS,
  // Exit codes a restart cannot fix (a taken port, #1527): the supervisor
  // stops and reports instead of retrying on its backoff forever.
  finalExitCodes = [PORT_IN_USE_EXIT_CODE],
  onFinal = () => {},
}) {
  /** @type {ChildLike | null} */
  let child = null;
  let startedAt = 0;
  let restarting = false;
  let stopping = false;
  let crashes = 0;
  /** @type {string | null} */
  let pendingPath = null;
  // Whether any change in the current debounce window asks for a restart.
  let pendingRestart = false;
  /** @type {any} */ let debounceTimer = null;
  /** @type {any} */ let backoffTimer = null;
  /** @type {any} */ let killTimer = null;
  /** @type {Array<() => void>} */
  const stopWaiters = [];

  const clear = (t) => { if (t !== null) timers.clearTimeout(t); return null; };

  const launch = () => {
    backoffTimer = clear(backoffTimer);
    if (stopping || child) return;
    const c = spawnChild();
    child = c;
    startedAt = now();
    c.once('exit', (code, signal) => onExit(c, code, signal));
  };

  const terminate = (c) => {
    try { c.kill('SIGTERM'); } catch {}
    killTimer = clear(killTimer);
    killTimer = timers.setTimeout(() => {
      killTimer = null;
      if (child === c) { try { c.kill('SIGKILL'); } catch {} }
    }, killTimeoutMs);
  };

  const onExit = (c, code, signal) => {
    if (child !== c) return;
    child = null;
    killTimer = clear(killTimer);
    if (stopping) {
      for (const w of stopWaiters.splice(0)) w();
      return;
    }
    if (restarting) {
      // The restart we asked for: start the replacement right away.
      restarting = false;
      crashes = 0;
      launch();
      return;
    }
    // Exited on its own: a crash, a fatal boot error, or an outside kill.
    if (!signal && code !== null && finalExitCodes.includes(code)) {
      stopping = true;
      debounceTimer = clear(debounceTimer);
      onFinal(code);
      return;
    }
    if (now() - startedAt >= stableMs) crashes = 0;
    const delay = backoffMs[Math.min(crashes, backoffMs.length - 1)];
    crashes++;
    const why = signal ? `signal ${signal}` : `code ${code}`;
    log(`dev server exited (${why}); restarting in ${delay < 1000 ? `${delay}ms` : `${delay / 1000}s`}, or on the next file change`);
    backoffTimer = timers.setTimeout(launch, delay);
  };

  const flush = () => {
    debounceTimer = null;
    const path = pendingPath;
    const wantsRestart = pendingRestart;
    pendingPath = null;
    pendingRestart = false;
    if (stopping) return;
    if (!child) {
      // Not running (crashed, or waiting out a backoff): a change is the cue.
      if (path) log(`${path} changed, starting the dev server`);
      launch();
      return;
    }
    if (!restartOnChange || restarting || !wantsRestart) return;
    restarting = true;
    if (path) log(`${path} changed, restarting the dev server`);
    terminate(child);
  };

  return {
    start: launch,
    /** @param {string} path */
    change(path) {
      if (stopping) return;
      if (restartFor(path)) {
        if (!pendingRestart) pendingPath = path;
        pendingRestart = true;
      } else if (pendingPath === null) pendingPath = path;
      debounceTimer = clear(debounceTimer);
      debounceTimer = timers.setTimeout(flush, debounceMs);
    },
    /** @returns {Promise<void>} */
    stop() {
      stopping = true;
      debounceTimer = clear(debounceTimer);
      backoffTimer = clear(backoffTimer);
      if (!child) return Promise.resolve();
      const done = new Promise((r) => stopWaiters.push(() => r(undefined)));
      terminate(child);
      return done;
    },
    get running() { return child !== null; },
  };
}

/**
 * Run the dev server under the supervisor until a signal stops it.
 *
 * @param {{
 *   cwd: string,
 *   plan: { args: string[], restartOnChange: boolean, restartFor?: (path: string) => boolean, watchDirs: string[], watchFiles: string[] },
 *   env: NodeJS.ProcessEnv,
 *   onExit: (code: number) => void,
 * }} opts
 */
export function superviseDevServer({ cwd, plan, env, onExit }) {
  const log = (line) => console.log(`[webjs] ${line}`);
  // A watcher error here is NOT logged: the server child watches the whole app
  // tree (a superset of these paths) and prints one warning per unwatchable
  // path itself, so logging it here too would print every warning twice. The
  // watcher keeps running either way.
  const ignoreWatchError = () => {};

  let exiting = false;
  /** @type {() => void} */
  let closeWatch = () => {};
  const shutdown = (code) => {
    if (exiting) return;
    exiting = true;
    closeWatch();
    sup.stop().then(() => onExit(code));
  };

  const sup = createSupervisor({
    restartOnChange: plan.restartOnChange,
    ...(plan.restartFor ? { restartFor: plan.restartFor } : {}),
    log,
    // The child already printed why (the port and its holder); stop with its
    // code rather than restarting a server that can never bind.
    onFinal: (code) => shutdown(code),
    spawnChild: () => {
      const c = spawn(process.execPath, plan.args, {
        // The IPC channel lets the child notice this process is gone and exit,
        // so a killed supervisor never leaves an orphan holding the port.
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        cwd,
        env,
      });
      // A failed spawn emits 'error' and may never emit 'exit'; report it as
      // an exit so the backoff retries it (a repeated exit is ignored).
      c.on('error', (err) => {
        console.error(`[webjs] could not start the dev server: ${err.message}`);
        c.emit('exit', 1, null);
      });
      return c;
    },
  });

  const outputs = readRegenerateOutputs(cwd);
  closeWatch = watchRestartPaths(cwd, {
    dirs: plan.watchDirs,
    files: plan.watchFiles,
    ignore: (rel) => shouldIgnoreRestartPath(rel) || outputs.has(rel.replace(/\\/g, '/')),
    onChange: (rel) => sup.change(rel),
    onError: ignoreWatchError,
  });

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGHUP', () => shutdown(0));
  // Last resort: a watcher error that escaped every listener (a runtime that
  // emits it somewhere else) is never fatal, and the server child reports the
  // same path itself. Anything else is a real
  // supervisor bug, so it is reported and the process exits non-zero after
  // stopping the child.
  process.on('uncaughtException', (err) => {
    if (isWatchError(err)) return;
    console.error(err && err.stack ? err.stack : err);
    shutdown(1);
  });

  sup.start();
  return sup;
}
