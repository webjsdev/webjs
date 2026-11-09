/**
 * A signing secret for development and tests when the app sets none (#1686),
 * the way Rails keeps `tmp/local_secret.txt` and NextAuth v4 fell back to a
 * generated secret outside production. `.env` is gitignored, so a fresh clone
 * or a git worktree had no `AUTH_SECRET` / `SESSION_SECRET` and every page
 * behind `session()` or `createAuth()` answered 500 until someone wrote one.
 *
 * The secret is generated once and kept in `.webjs/dev-secret` under the
 * current directory (the app root for `webjs dev` and `webjs test`), which the
 * scaffold's `.gitignore` already excludes, so sessions survive a restart.
 * Production never gets one: `NODE_ENV=production` returns undefined and the
 * caller throws as before.
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const warned = new Set();

/**
 * The development secret, created on first use, or undefined in production.
 * @param {string} name the variable the app left unset, named in the warning
 * @param {{ dir?: string, env?: Record<string, string | undefined>, warn?: (msg: string) => void }} [opts]
 * @returns {string | undefined}
 */
export function devSecret(name, opts = {}) {
  const env = opts.env || process.env;
  if (env.NODE_ENV === 'production') return undefined;
  const file = join(opts.dir || process.cwd(), '.webjs', 'dev-secret');
  let secret = '';
  try {
    if (existsSync(file)) secret = readFileSync(file, 'utf8').trim();
  } catch {}
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    try {
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, secret + '\n', { mode: 0o600 });
    } catch {
      // A read-only directory still gets a secret, just one per process.
    }
  }
  if (!warned.has(name)) {
    warned.add(name);
    (opts.warn || ((m) => console.warn(m)))(
      `[webjs] ${name} is not set, so a generated development secret in .webjs/dev-secret signs the cookie. `
      + `Set ${name} in .env for production, where it is required.`,
    );
  }
  return secret;
}
