/**
 * Evict Bun transpiler-cache entries written by @webjsdev/server 0.8.85 and
 * 0.8.86 (#1575).
 *
 * Those versions resolved the app's `#` imports through a Bun runtime
 * `onResolve` in dev. Bun caches the transpile of every source over 50KB on
 * disk, keyed by the file's CONTENT, with the resolved import paths baked in,
 * so a large app module kept a broken `file:/...` path (or an absolute path
 * into whichever checkout first ran it) after the fix: same bytes, same key,
 * same poisoned output, a 500 on every request that reaches it. Nothing in a
 * fixed version writes such an entry any more, but the old entries outlive the
 * upgrade.
 *
 * The cache is only a cache, so the cure is to empty it once per machine: the
 * first WebJs server on Bun at or after this version removes the entries and
 * leaves a marker beside them, and every later start sees the marker and does
 * nothing. Bun rebuilds what it needs on the next load.
 *
 * @module bun-transpiler-cache
 */
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const MARKER = 'webjs-1575-evicted';

/**
 * The directory Bun keeps its runtime transpiler cache in, or null when the
 * cache is off (`BUN_RUNTIME_TRANSPILER_CACHE_PATH` set to `0` or empty).
 * @param {NodeJS.ProcessEnv} env
 * @param {string} home
 * @returns {string | null}
 */
export function bunTranspilerCacheDir(env = process.env, home = homedir()) {
  const set = env.BUN_RUNTIME_TRANSPILER_CACHE_PATH;
  if (set !== undefined) return set === '0' || set === '' ? null : set;
  return join(env.XDG_CACHE_HOME || join(home, '.cache'), 'bun', '@t@');
}

/**
 * Empty the Bun transpiler cache once per machine (see the module comment).
 * Never throws: a cache it cannot read or write is left alone.
 * @param {{ env?: NodeJS.ProcessEnv, home?: string, isBun?: boolean }} [opts]
 * @returns {number} entries removed (0 when there was nothing to do)
 */
export function evictPoisonedBunTranspilerCache({ env = process.env, home = homedir(), isBun = !!process.versions.bun } = {}) {
  if (!isBun) return 0;
  const dir = bunTranspilerCacheDir(env, home);
  if (!dir) return 0;
  const marker = join(dirname(dir), MARKER);
  try {
    if (existsSync(marker)) return 0;
    let removed = 0;
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        try { rmSync(join(dir, name), { recursive: true, force: true }); removed++; } catch { /* in use; leave it */ }
      }
    }
    writeFileSync(marker, `emptied by @webjsdev/server at ${new Date().toISOString()} (#1575)\n`);
    return removed;
  } catch {
    return 0;
  }
}
