// Pin `@webjsdev/*` imports under Bun zero-install (#709).
//
// Under Bun zero-install a bare `import('@webjsdev/server')` from the cli (run
// out of the global cache) ENOENTs: Bun's runtime auto-install ignores the cli's
// declared range and flakily fetches latest, which fails. An INLINE-versioned
// specifier (`@webjsdev/server@^0.8.0`) resolves reliably. So we read the version
// the APP declares (the scaffold adds `@webjsdev/*` to its deps) and retry inline
// only when the bare import fails, so Node and installed apps are unaffected.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The cli's OWN package.json (one level up from this lib), used as the fallback
// pin source for `@webjsdev/*` packages the app does not declare (mcp, ui).
const CLI_PKG = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

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
 * The version a `package.json` at `pkgPath` declares for `name`, when it is
 * inline-safe; else null.
 * @param {string} name
 * @param {string} pkgPath  absolute path to a package.json
 * @returns {string | null}
 */
function declaredIn(name, pkgPath) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const v = { ...pkg.dependencies, ...pkg.devDependencies }[name];
    if (inlineSafeVersion(v)) return v;
  } catch { /* no readable package.json */ }
  return null;
}

/**
 * The inline-safe version to pin `name` to: the app's `package.json` (in `cwd`)
 * first (it declares `@webjsdev/server` etc.), else the cli's OWN package.json
 * (for `@webjsdev/*` the app does not declare, like `mcp` / `ui`). Null if
 * neither has an inline-safe declaration.
 * @param {string} name
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function appDeclaredVersion(name, cwd = process.cwd()) {
  return declaredIn(name, join(cwd, 'package.json')) || declaredIn(name, CLI_PKG);
}

/**
 * Whether an import error is a resolution / not-found failure (so a version
 * retry is warranted), vs a genuine load-time throw from the module's own code
 * (which we must NOT retry, to avoid masking it and re-running side effects).
 * @param {unknown} err
 * @returns {boolean}
 */
function isResolutionError(err) {
  if (err && /** @type {any} */ (err).code === 'ERR_MODULE_NOT_FOUND') return true;
  const msg = err && String(/** @type {any} */ (err).message || err);
  // Narrow on purpose: Node sets the code above; Bun's auto-install miss is
  // `ENOENT while resolving package '...'`. A broad "cannot find" would match
  // ordinary runtime errors ("Cannot find user") and wrongly trigger a retry.
  return !!msg && /ENOENT|resolving package|module not found/i.test(msg);
}

/**
 * Import an `@webjsdev/*` module, pinning the version under Bun zero-install. On
 * Node or an installed app the bare specifier resolves from `node_modules` (no
 * retry). On a RESOLUTION failure (Bun zero-install), retry with the app's (else
 * the cli's own) declared version inline. A real load-time throw is rethrown,
 * not retried. A subpath (`/check`) is preserved across the rewrite.
 * @param {string} spec  e.g. `@webjsdev/server` or `@webjsdev/server/check`
 * @param {(s: string) => Promise<any>} [importer]  injectable for tests
 * @returns {Promise<any>}
 */
export async function importWebjsdev(spec, importer = (s) => import(s)) {
  try {
    return await importer(spec);
  } catch (err) {
    if (!isResolutionError(err)) throw err;
    const m = /^(@webjsdev\/[^/]+)(\/.*)?$/.exec(spec);
    const pkg = m && m[1];
    const sub = (m && m[2]) || '';
    const v = pkg && appDeclaredVersion(pkg);
    if (v) return await importer(pkg + '@' + v + sub);
    throw err;
  }
}
