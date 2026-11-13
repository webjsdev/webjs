import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {object} WalkOptions
 * @property {boolean} [skipNestedPackages] Skip any directory BELOW `dir`
 *   that holds its own `package.json`, and everything under it. Such a
 *   directory is a separate package (an Expo app in `mobile/`, a workspace
 *   member), the same boundary npm, Bun workspaces and TypeScript project
 *   references draw. The root's own `package.json` is never a boundary.
 *   `webjs check` sets it (#1700); the router, action and component scans do
 *   not.
 */

/**
 * Recursively walk a directory, yielding absolute file paths. Dot-entries and
 * `node_modules` are always skipped.
 *
 * @param {string} dir
 * @param {(path: string) => boolean} [filter]
 * @param {WalkOptions} [options]
 * @returns {AsyncGenerator<string>}
 */
export async function* walk(dir, filter, options = {}) {
  yield* walkDir(dir, filter, options, true);
}

/**
 * @param {string} dir
 * @param {((path: string) => boolean) | undefined} filter
 * @param {WalkOptions} options
 * @param {boolean} isRoot
 * @returns {AsyncGenerator<string>}
 */
async function* walkDir(dir, filter, options, isRoot) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (
    options.skipNestedPackages &&
    !isRoot &&
    entries.some((e) => e.name === 'package.json' && e.isFile())
  ) {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full, filter, options, false);
    } else if (entry.isFile()) {
      if (!filter || filter(full)) yield full;
    }
  }
}
