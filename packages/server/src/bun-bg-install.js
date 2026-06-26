/**
 * Transparent Bun install.
 *
 * Bun's RUNTIME auto-install is latest-only: a bare (or inline-range) import
 * resolves the package's latest matching version, and an inline EXACT, non-latest
 * specifier ENOENTs on a cold cache (proven). So a prerelease, an exact pin, or a
 * reproducible `bun.lock` version cannot be served zero-install. The honest path
 * is to run `bun install` FOR the user (never asking) when correctness requires
 * it, producing `node_modules` so Bun resolves from disk in installed mode (the
 * #698 gate then disables the pin rewrite). "No MANUAL install," not "no install."
 *
 * Two modes:
 *   - `blocking`: awaited on the boot path (or by `webjs db` / `--browser`) BEFORE
 *     the first request can hit an ENOENT for a non-latest dep. A one-time ~1s
 *     cost that is strictly better than a guaranteed first-request crash.
 *   - `detached`: fired-and-forgotten after the server is listening, to converge a
 *     zero-install box to installed mode (editor types / typecheck) and to
 *     self-heal an undetectable non-latest exact on the NEXT boot. Runs with a
 *     reduced network concurrency so it does not starve first requests.
 *
 * Bun-only by CALLER contract (invoked from the `serverRuntime() === 'bun'`
 * branches). The module itself references no `Bun.*` global (only `node:*`), so it
 * stays unit-testable on Node with an injected spawn.
 *
 * A lock-marker (`.webjs/.bun-install.lock`) serializes concurrent boots and
 * `bun --hot` restarts so two installs never run at once. Fail-open on every axis:
 * a missing `bun`, an offline registry, or a marker contention degrades to
 * returning `false` (the caller falls back to the zero-install pin), never throws.
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** A marker older than this is treated as stale (a crashed / killed install) and stolen. */
const STALE_MARKER_MS = 10 * 60 * 1000;

let _warned = false;

/**
 * Build the `bun install` argv. PURE and exported for unit testing.
 *
 * `--frozen-lockfile` is added iff a `bun.lock` exists, so a committed lock
 * installs reproducibly (and a package.json/lock mismatch fails fast, then
 * fail-opens). A detached background install adds a reduced `--network-concurrency`
 * so it does not starve first requests. `--lockfile-only` is NEVER used: it writes
 * no `node_modules`, so it cannot move the box to installed mode (verified useless
 * for this purpose).
 *
 * @param {{ hasLock: boolean, detached?: boolean }} opts
 * @returns {string[]}
 */
export function buildBunInstallArgs({ hasLock, detached }) {
  const args = ['install'];
  if (hasLock) args.push('--frozen-lockfile');
  if (detached) args.push('--network-concurrency', '4');
  return args;
}

/**
 * Run a transparent `bun install` in the app directory.
 *
 * @param {string} appDir
 * @param {object} [opts]
 * @param {'blocking' | 'detached'} [opts.mode]  default `'blocking'`
 * @param {(msg: string) => void} [opts.log]  progress sink (default `console.error`)
 * @param {typeof nodeSpawn} [opts._spawn]  injectable spawn (tests)
 * @param {string} [opts._bunPath]  bun executable (default `process.execPath`, which
 *   IS bun when the server runs under `bun --bun`)
 * @param {() => number} [opts._now]  injectable clock (tests)
 * @returns {Promise<boolean>}  true when the install ran (blocking: to completion
 *   with exit 0; detached: spawned), false when skipped or failed (fail-open)
 */
export async function startTransparentInstall(appDir, opts = {}) {
  const mode = opts.mode || 'blocking';
  const spawn = opts._spawn || nodeSpawn;
  const bunPath = opts._bunPath || process.execPath;
  const now = opts._now || Date.now;
  const log = opts.log || ((m) => { try { console.error(m); } catch { /* ignore */ } });

  const hasLock = existsSync(join(appDir, 'bun.lock'));
  const webjsDir = join(appDir, '.webjs');
  const marker = join(webjsDir, '.bun-install.lock');

  // Acquire the lock-marker (O_EXCL). On contention, steal a stale marker once
  // (a crashed prior install would otherwise deadlock every future boot).
  let handle;
  try { mkdirSync(webjsDir, { recursive: true }); } catch { /* best-effort */ }
  try {
    handle = await open(marker, 'wx');
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      let stale = false;
      try { stale = (now() - statSync(marker).mtimeMs) > STALE_MARKER_MS; } catch { stale = true; }
      if (!stale) return false; // an install is already in progress
      try { await rm(marker, { force: true }); } catch { /* ignore */ }
      try { handle = await open(marker, 'wx'); } catch { return false; }
    } else {
      return false; // cannot create the marker (read-only FS, etc.): fail-open
    }
  }

  const release = async () => {
    try { await handle.close(); } catch { /* ignore */ }
    try { await rm(marker, { force: true }); } catch { /* ignore */ }
  };

  const args = buildBunInstallArgs({ hasLock, detached: mode === 'detached' });

  if (mode === 'detached') {
    try {
      const child = spawn(bunPath, args, { cwd: appDir, detached: true, stdio: 'ignore' });
      child.on('exit', () => { void release(); });
      child.on('error', () => { void release(); });
      if (typeof child.unref === 'function') child.unref();
      return true;
    } catch {
      await release();
      return false;
    }
  }

  // blocking
  log('webjs: installing dependencies with bun (one-time; future boots reuse node_modules)…');
  try {
    const code = await new Promise((res) => {
      let child;
      try {
        child = spawn(bunPath, args, { cwd: appDir, stdio: ['ignore', 'inherit', 'inherit'] });
      } catch {
        res(-1);
        return;
      }
      child.on('exit', (c) => res(c == null ? -1 : c));
      child.on('error', () => res(-1));
    });
    if (code !== 0) {
      if (!_warned) {
        _warned = true;
        log(`webjs: transparent \`bun install\` exited ${code}; falling back to zero-install (non-latest deps may not resolve).`);
      }
      return false;
    }
    return existsSync(join(appDir, 'node_modules'));
  } finally {
    await release();
  }
}
