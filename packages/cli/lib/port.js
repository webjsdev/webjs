/**
 * Port resolution for `webjs dev` / `webjs start` (issue #447).
 *
 * The bug this fixes: the CLI read `process.env.PORT || 8080` BEFORE the
 * server's bootstrap ran `process.loadEnvFile('.env')`, so a `PORT` set in
 * the project's `.env` never reached the port comparison and the server
 * always came up on 8080. Every OTHER `.env` var worked, because the server
 * loads `.env` early enough for everything IT reads; only the port, computed
 * one layer up in the CLI, missed the load.
 *
 * The fix loads `.env` into `process.env` here, in the CLI, before the port
 * is computed. Both functions live in this module so `dev` and `start` share
 * one implementation and the logic is unit-testable without spawning a
 * server.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { loadEnvFiles } from './env-files.js';

/**
 * Load the app's env files into `process.env` in Next.js's order
 * (`.env.$mode.local`, `.env.local`, `.env.$mode`, `.env`; see env-files.js),
 * where the mode follows `NODE_ENV` (`test`, `production`, else
 * `development`). The dev and start commands set `NODE_ENV` first when it is
 * unset, so `webjs start` reads `.env.production`.
 *
 * A key already in `process.env` is never overwritten, so a real
 * shell-exported `PORT=NNNN npm run dev` still wins over a file.
 *
 * @param {string} appDir
 * @returns {string[]} the files read
 */
export function loadAppEnv(appDir) {
  const nodeEnv = process.env.NODE_ENV;
  const mode = nodeEnv === 'test' ? 'test' : nodeEnv === 'production' ? 'production' : 'development';
  return loadEnvFiles(appDir, mode);
}

/**
 * The environment the user's shell set, for the `webjs dev` child (#1689).
 *
 * The dev child is started from the shell's env rather than the CLI's own, so a
 * child restarted for a `.env` edit loads the EDITED file (a loaded variable is
 * never overridden). Node gives the CLI exactly the shell's env until
 * `loadAppEnv` runs, but Bun loads the app's `.env` files into `process.env`
 * before any code runs (the CLI parent is not started with `--no-env-file`), so
 * on Bun the snapshot already holds the values from before the edit and the
 * restarted child kept them. So on Bun each key whose value is exactly what
 * `.env`, `.env.<NODE_ENV>` or `.env.local` (Bun's own auto-load set) sets is
 * dropped, and the child, which runs with `--no-env-file`, reads the files
 * fresh through `loadAppEnv` in Next's order. A shell variable
 * that happens to equal the file's value is dropped too, which changes
 * nothing, since the file supplies the same value.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {string} appDir
 * @param {boolean} [isBun]
 * @returns {Record<string, string | undefined>}
 */
export function shellEnvOf(env, appDir, isBun = !!process.versions.bun) {
  const out = { ...env };
  if (!isBun) return out;
  for (const file of ['.env', `.env.${env.NODE_ENV || 'development'}`, '.env.local']) {
    let parsed;
    try { parsed = parseEnv(readFileSync(join(appDir, file), 'utf8')); } catch { continue; }
    for (const [k, v] of Object.entries(parsed)) if (out[k] === v) delete out[k];
  }
  return out;
}

/**
 * Resolve the server port with precedence `--port` flag > `PORT` (shell env
 * or `.env`, whichever landed in `process.env`) > 8080.
 *
 * Kept pure (no `.env` loading, no `process.env` mutation) so it is trivially
 * testable: the caller loads `.env` first via `loadAppEnv`, then passes the
 * resulting `process.env` in. A non-numeric or empty `--port` / `PORT`
 * surfaces as `NaN`, same as the previous inline `Number(...)`, so behaviour
 * for bad input is unchanged.
 *
 * @param {string | undefined} portFlag  The `--port` value, or undefined.
 * @param {NodeJS.ProcessEnv} [env]      Defaults to `process.env`.
 * @returns {number}
 */
export function resolvePort(portFlag, env = process.env) {
  if (portFlag !== undefined) return Number(portFlag);
  if (env.PORT) return Number(env.PORT);
  return 8080;
}

/**
 * The exit code of a server that could not bind because its port is taken
 * (#1527): Linux's EADDRINUSE errno. The dev supervisor treats it as final and
 * stops instead of restarting a child that can never bind.
 */
export const PORT_IN_USE_EXIT_CODE = 98;

/**
 * Await a server start; on a taken port print the server's message (it names
 * the process holding the port) and exit with `PORT_IN_USE_EXIT_CODE`. Any
 * other error propagates unchanged.
 *
 * @template T
 * @param {Promise<T>} started
 * @param {{ error?: (line: string) => void, exit?: (code: number) => never }} [io]
 * @returns {Promise<T>}
 */
export async function failFastOnPortInUse(started, io = {}) {
  const error = io.error || ((line) => console.error(line));
  const exit = io.exit || ((code) => process.exit(code));
  try {
    return await started;
  } catch (e) {
    const err = /** @type {any} */ (e);
    if (err && err.code === 'EADDRINUSE') {
      error(`[webjs] ${err.message || 'the port is already in use'}`);
      return exit(PORT_IN_USE_EXIT_CODE);
    }
    throw e;
  }
}

/**
 * Where a running `webjs dev` records the port it serves on (#1686), so
 * `webjs status` finds a server started with `--port 8910` without being told
 * again. An agent starts the dev server on a port of its choosing and then
 * runs `webjs status` after each edit; with the 8080 default it booted a
 * second, in-process copy instead of reporting on the server that was up.
 */
const DEV_SERVER_FILE = join('.webjs', 'dev-server.json');

/**
 * Record this process as the app's dev server on `port`, removed again on
 * exit. Best effort: a read-only app directory only loses the convenience. A
 * process killed by a signal skips its exit handler and leaves the record
 * behind, which `recordedDevPort` ignores once that pid is gone.
 * @param {string} cwd the app root
 * @param {number} port
 */
export function recordDevPort(cwd, port) {
  const file = join(cwd, DEV_SERVER_FILE);
  try {
    mkdirSync(join(cwd, '.webjs'), { recursive: true });
    writeFileSync(file, JSON.stringify({ port, pid: process.pid }) + '\n');
  } catch {
    return;
  }
  process.once('exit', () => {
    try {
      if (JSON.parse(readFileSync(file, 'utf8')).pid === process.pid) rmSync(file, { force: true });
    } catch { /* gone already */ }
  });
}

/**
 * The port a still-running `webjs dev` recorded for this app, or null.
 * @param {string} cwd
 * @returns {number | null}
 */
export function recordedDevPort(cwd) {
  try {
    const { port, pid } = JSON.parse(readFileSync(join(cwd, DEV_SERVER_FILE), 'utf8'));
    process.kill(pid, 0);
    return Number.isInteger(port) ? port : null;
  } catch {
    return null;
  }
}
