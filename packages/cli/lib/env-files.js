/**
 * Load an app's `.env` files the way Next.js does, so a Next project's
 * `.env.local` / `.env.development` / `.env.production` keep working.
 *
 * Order, highest precedence first (Next's `@next/env`):
 *   1. the real environment (`process.env`, never overwritten)
 *   2. `.env.$mode.local`
 *   3. `.env.local` (skipped when mode is `test`, so tests are reproducible)
 *   4. `.env.$mode`
 *   5. `.env`
 * where `$mode` is `development` under `webjs dev`, `production` under
 * `webjs start`, and `test` when `NODE_ENV=test`.
 *
 * Files are read with `readFileSync` + `util.parseEnv`, so loading behaves the
 * same on Node and Bun (`process.loadEnvFile`, which this replaces, does not
 * exist on Bun, so a Bun app never saw its `.env`). A key is assigned only
 * when still unset, which yields the precedence above.
 *
 * The CLI keeps a byte-identical copy (`packages/cli/lib/env-files.js`) because
 * it must load env before the server package is imported (the port, the
 * `webjs.*` tasks); `test/cli/env-files-parity.test.mjs` keeps them in step.
 *
 * @module env-files
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * @param {string} mode `development` | `production` | `test`
 * @returns {string[]} file names, highest precedence first
 */
export function envFileOrder(mode) {
  return [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
}

/**
 * The env mode for a server run: `test` when NODE_ENV says so, else the run's
 * own mode.
 * @param {boolean} dev
 * @returns {'development' | 'production' | 'test'}
 */
export function envMode(dev) {
  if (process.env.NODE_ENV === 'test') return 'test';
  return dev ? 'development' : 'production';
}

/**
 * Load the app's env files into `process.env` (unset keys only).
 * @param {string} appDir
 * @param {string} mode
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]} the files that were found and read
 */
export function loadEnvFiles(appDir, mode, env = process.env) {
  /** @type {string[]} */
  const loaded = [];
  for (const name of envFileOrder(mode)) {
    let text;
    try { text = readFileSync(join(appDir, name), 'utf8'); } catch { continue; }
    let parsed;
    try { parsed = parseEnv(text); } catch { continue; }
    for (const [k, v] of Object.entries(parsed)) {
      if (env[k] === undefined) env[k] = v;
    }
    loaded.push(name);
  }
  return loaded;
}
