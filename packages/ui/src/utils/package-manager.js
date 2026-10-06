/**
 * Package-manager detection for `webjs ui add` (#1494).
 *
 * KEEP IN SYNC with `packages/cli/lib/package-manager.js`. The two published
 * packages carry the same small module rather than one importing the other,
 * so a `@webjsdev/cli` release can never fail at import time against an older
 * `@webjsdev/ui` that lacks the export. `packages/cli/test/package-manager.test.mjs`
 * asserts both copies agree on every fixture.
 *
 * Detection order (with `prefer: 'lockfile'`, the default):
 *   1. A lockfile in `cwd` or any ancestor. The walk stops at the first
 *      workspace root (a package.json declaring `workspaces`, or a
 *      `pnpm-workspace.yaml`) or at the filesystem root, so an app nested in a
 *      workspace finds the root's lockfile. Within one directory the order is
 *      pnpm, yarn, bun (`bun.lock`, the text lockfile Bun writes since 1.2,
 *      and the older binary `bun.lockb`), then npm.
 *   2. `npm_config_user_agent`, which npm, pnpm, yarn and bun set when they
 *      run a script or a `dlx` / `bunx` / `npx` binary.
 *   3. `npm`.
 * With `prefer: 'agent'` steps 1 and 2 swap, which suits `webjs create`: the
 * tool that invoked it is the strongest signal for a directory that has no
 * lockfile yet.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** @typedef {'npm'|'pnpm'|'yarn'|'bun'} PackageManager */

/** Lockfile name to manager, in per-directory precedence order. */
const LOCKFILES = /** @type {const} */ ([
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
]);

/**
 * Whether `dir` is a workspace root, where the lockfile walk stops.
 * @param {string} dir
 * @returns {boolean}
 */
function isWorkspaceRoot(dir) {
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return true;
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    return Boolean(JSON.parse(readFileSync(pkgPath, 'utf8')).workspaces);
  } catch {
    return false;
  }
}

/**
 * Walk up from `cwd` looking for a lockfile.
 * @param {string} cwd
 * @returns {PackageManager | null}
 */
export function managerFromLockfile(cwd) {
  let dir = resolve(cwd);
  for (;;) {
    for (const [file, manager] of LOCKFILES) {
      if (existsSync(join(dir, file))) return manager;
    }
    if (isWorkspaceRoot(dir)) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Read the manager from an `npm_config_user_agent` value such as
 * `bun/1.3.14 npm/? node/v24.0.0 linux x64`.
 * @param {string | undefined} ua
 * @returns {PackageManager | null}
 */
export function managerFromUserAgent(ua) {
  const name = String(ua || '').split('/')[0];
  return name === 'pnpm' || name === 'yarn' || name === 'bun' || name === 'npm' ? name : null;
}

/**
 * @param {{ cwd?: string | null, env?: Record<string, string | undefined>, prefer?: 'lockfile' | 'agent' }} [opts]
 * @returns {PackageManager}
 */
export function detectPackageManager({ cwd = null, env = process.env, prefer = 'lockfile' } = {}) {
  const fromLock = () => (cwd ? managerFromLockfile(cwd) : null);
  const fromAgent = () => managerFromUserAgent(env.npm_config_user_agent);
  return (prefer === 'agent' ? fromAgent() ?? fromLock() : fromLock() ?? fromAgent()) ?? 'npm';
}
