// Pin `@webjsdev/*` imports under Bun zero-install (#709).
//
// Under Bun zero-install a bare `import('@webjsdev/server')` from the cli (run
// out of the global cache) ENOENTs: Bun's runtime auto-install ignores the cli's
// declared range and flakily fetches latest, which fails. An INLINE-versioned
// specifier (`@webjsdev/server@^0.8.0`) resolves reliably. So we read the version
// the APP declares (the scaffold adds `@webjsdev/*` to its deps) and retry inline
// only when the bare import fails, so Node and installed apps are unaffected.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Whether a declared version is a Bun inline-safe specifier: an exact version or
 * a single caret / tilde / comparator range, but NOT a range over a prerelease
 * (`^1.0.0-rc.3`, which Bun ENOENTs on, #703), a wildcard, a multi-token range,
 * or a protocol range (`workspace:` / `file:`).
 * @param {unknown} v
 * @returns {boolean}
 */
export function inlineSafeVersion(v) {
  if (typeof v !== 'string') return false;
  const m = /^(>=|<=|>|<|=|\^|~)?(\d+(?:\.\d+){0,2})([-+][0-9A-Za-z.-]+)?$/.exec(v);
  return !!m && !(m[1] && m[3]);
}

/**
 * The version the app's `package.json` (in `cwd`) declares for `name`, when it
 * is inline-safe; else null.
 * @param {string} name
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function appDeclaredVersion(name, cwd = process.cwd()) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    const v = { ...pkg.dependencies, ...pkg.devDependencies }[name];
    if (inlineSafeVersion(v)) return v;
  } catch { /* no readable package.json */ }
  return null;
}

/**
 * Import an `@webjsdev/*` module, pinning the version under Bun zero-install. On
 * Node or an installed app the bare specifier resolves from `node_modules` (no
 * retry). On a bare-import failure (Bun zero-install), retry with the app's
 * declared version inline. A subpath (`/check`) is preserved across the rewrite.
 * @param {string} spec  e.g. `@webjsdev/server` or `@webjsdev/server/check`
 * @param {(s: string) => Promise<any>} [importer]  injectable for tests
 * @returns {Promise<any>}
 */
export async function importWebjsdev(spec, importer = (s) => import(s)) {
  try {
    return await importer(spec);
  } catch (err) {
    const m = /^(@webjsdev\/[^/]+)(\/.*)?$/.exec(spec);
    const pkg = m && m[1];
    const sub = (m && m[2]) || '';
    const v = pkg && appDeclaredVersion(pkg);
    if (v) return await importer(pkg + '@' + v + sub);
    throw err;
  }
}
