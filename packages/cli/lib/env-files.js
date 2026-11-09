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
 * Values are expanded the way `@next/env` does with dotenv-expand: `$NAME`,
 * `${NAME}` and `${NAME:-default}` (also `${NAME-default}`) resolve against the
 * real environment and the files already loaded, then the same file's keys,
 * else empty (or the default); `\$` is a literal dollar, and a single-quoted
 * value is left as written.
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
    const literal = singleQuotedKeys(text);
    /** @type {Record<string, string>} */
    const done = {};
    /** @type {Set<string>} */
    const active = new Set();
    /** @param {string} key @returns {string | undefined} undefined when unset */
    const resolve = (key) => {
      if (env[key] !== undefined) return env[key];
      if (!(key in parsed)) return undefined;
      if (key in done) return done[key];
      if (active.has(key)) return ''; // a cycle expands to empty rather than looping
      active.add(key);
      const out = literal.has(key) ? parsed[key] : expandValue(parsed[key], resolve);
      active.delete(key);
      return (done[key] = out);
    };
    for (const k of Object.keys(parsed)) {
      if (env[k] === undefined) env[k] = literal.has(k) ? parsed[k] : expandValue(parsed[k], resolve);
    }
    loaded.push(name);
  }
  return loaded;
}

/**
 * Expand `$NAME`, `${NAME}`, `${NAME:-default}` and `${NAME-default}` in one
 * value, with `\$` as a literal dollar (dotenv-expand's syntax). `:-` uses the
 * default when NAME is unset or empty, `-` only when it is unset.
 * @param {string} value
 * @param {(key: string) => string | undefined} lookup undefined when unset
 * @returns {string}
 */
export function expandValue(value, lookup) {
  return value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?-)([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, braced, op, fallback, bare) => {
    if (m === '\\$') return '$';
    const v = lookup(braced || bare);
    if (op === ':-') return v === undefined || v === '' ? fallback : v;
    if (op === '-') return v === undefined ? fallback : v;
    return v ?? '';
  });
}

/**
 * The keys whose value is single-quoted in the file text, which dotenv-expand
 * leaves unexpanded (`util.parseEnv` strips the quotes, so read them here).
 * @param {string} text
 * @returns {Set<string>}
 */
function singleQuotedKeys(text) {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const m of text.matchAll(/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*'/gm)) keys.add(m[1]);
  return keys;
}
