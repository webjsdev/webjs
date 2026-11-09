/**
 * A fresh, migrated test database for `webjs test`, the Rails test-database
 * habit. Server tests that import the app's `db` used to write into the
 * developer's `db/dev.db`, or hand-apply migration SQL to a temporary file
 * (two of six agents building apps on the scaffold did exactly that). For a
 * SQLite app, `webjs test` now builds a temporary database and runs the server
 * tests with `DATABASE_URL` pointing at it: migrated when the app has
 * migrations, and with the schema pushed when it has none yet (Rails loads
 * `schema.rb` the same way), so the first test run needs no `db generate`.
 *
 * It stands aside when the shell sets `DATABASE_URL` (CI, or a Postgres test
 * database), when `WEBJS_TEST_DB=0`, and for a non-SQLite dialect.
 *
 * @module
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadEnvFiles } from './env-files.js';

/**
 * Whether `webjs test` should give the server tests their own database.
 * @param {string} cwd the app root
 * @param {Record<string, string | undefined>} env the shell environment
 * @returns {boolean}
 */
export function wantsTestDatabase(cwd, env) {
  if (env.WEBJS_TEST_DB === '0') return false;
  if (env.DATABASE_URL && !declaredInEnvFiles(cwd, env.DATABASE_URL)) return false;
  const config = ['drizzle.config.ts', 'drizzle.config.js', 'drizzle.config.mjs']
    .map((f) => join(cwd, f)).find((f) => existsSync(f));
  if (!config) return false;
  return /dialect\s*:\s*['"]sqlite['"]/.test(readFileSync(config, 'utf8'));
}

/** @param {string} cwd */
function hasMigrations(cwd) {
  try {
    return readdirSync(join(cwd, 'db', 'migrations')).length > 0;
  } catch {
    return false;
  }
}

/**
 * Whether `url` is the `DATABASE_URL` one of the app's own env files declares.
 * Bun loads `.env` into `process.env` before any code runs, so on Bun the dev
 * database from the scaffold's `.env` arrived looking like a value the shell
 * set, and the test database stood aside for it. Only a url the env files do
 * not declare is the shell's choice.
 * @param {string} cwd
 * @param {string} url
 * @returns {boolean}
 */
function declaredInEnvFiles(cwd, url) {
  for (const mode of ['development', 'test', 'production']) {
    /** @type {Record<string, string | undefined>} */
    const fromFiles = {};
    loadEnvFiles(cwd, mode, fromFiles);
    if (fromFiles.DATABASE_URL === url) return true;
  }
  return false;
}

/**
 * Create a temporary SQLite file and build the app's schema in it: the app's
 * own `webjs db migrate` when it has migrations, else `webjs db push --force`.
 * @param {string} cwd the app root
 * @param {{ cliBin: string, execPath?: string, env?: Record<string, string | undefined> }} opts
 * @returns {{ url: string, cleanup: () => void, pushed: boolean }}
 */
export function prepareTestDatabase(cwd, opts) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-test-db-'));
  const url = 'file:' + join(dir, 'test.db');
  const pushed = !hasMigrations(cwd);
  const verb = pushed ? ['db', 'push', '--force'] : ['db', 'migrate'];
  const r = spawnSync(opts.execPath || process.execPath, [opts.cliBin, ...verb], {
    cwd,
    env: { ...(opts.env || process.env), DATABASE_URL: url },
    encoding: 'utf8',
  });
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) {
    cleanup();
    throw new Error(`webjs test: could not ${pushed ? 'push the schema to' : 'migrate'} the test database:\n${(r.stdout || '') + (r.stderr || '')}`.trim());
  }
  return { url, cleanup, pushed };
}
