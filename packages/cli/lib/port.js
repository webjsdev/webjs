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
import { join } from 'node:path';

/**
 * Load `<appDir>/.env` into `process.env`, guarded exactly like the server's
 * own `loadAppEnv` (`packages/server/src/dev.js`): only on a Node with the
 * built-in `process.loadEnvFile`, and swallowing a missing or malformed file.
 *
 * Node's `loadEnvFile` does NOT override a var already present in
 * `process.env`, so a real shell-exported `PORT=NNNN npm run dev` still wins
 * over the file. That "shell beats file" precedence is intentional and
 * matches what the server does after its own load.
 *
 * @param {string} appDir
 */
export function loadAppEnv(appDir) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(join(appDir, '.env'));
    }
  } catch {
    // No .env, malformed file, or a Node without loadEnvFile. Fall through
    // silently: the app may not need any env vars, or they may be set via
    // the shell.
  }
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
