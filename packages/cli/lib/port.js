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
