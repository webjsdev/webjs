/**
 * Resolve a dependency's executable from an app's node_modules (#570).
 *
 * `webjs db` / `webjs test --browser` used to shell `npx drizzle-kit` / `npx
 * wtr`, but `npx` is absent in a pure `oven/bun` image (and the whole point of
 * runtime-native commands is to run under whatever the current runtime is). So
 * instead resolve the tool's bin from the APP's node_modules and let the caller
 * spawn it with `process.execPath` (Node or Bun), the same pattern `webjs
 * typecheck` uses for the app's `tsc`.
 *
 * The wrinkle: CLIs like drizzle-kit and @web/test-runner do NOT expose
 * `./package.json` or their bin subpath in `exports`, so `require.resolve(
 * 'drizzle-kit/bin.cjs')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. The `.` main
 * entry DOES resolve, so resolve that, walk up to the package root (the nearest
 * dir with a package.json), and read the `bin` field, which is version-robust.
 *
 * Installed means reachable through a `node_modules/<pkg>` entry in `cwd` or an
 * ancestor, the lookup Node's resolver does. That is checked BEFORE resolving
 * because Bun auto-installs: when no `node_modules` sits above `cwd`, Bun's
 * `require.resolve` fetches an undeclared package into its global cache and
 * returns that path. Without the check, an app that never installed
 * @web/test-runner would launch whatever version Bun downloaded instead of
 * getting the "not installed" remedy.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

/**
 * @param {string} cwd  the app root (a dir containing the app's package.json)
 * @param {string} pkgName  the dependency package name (e.g. 'drizzle-kit')
 * @param {string} binName  the key in the package's `bin` map (e.g. 'wtr');
 *   ignored when `bin` is a plain string
 * @returns {string} absolute path to the bin's JS entry
 * @throws if the package is not installed or has no matching bin
 */
export function resolveBin(cwd, pkgName, binName) {
  if (!hasNodeModulesEntry(cwd, pkgName)) {
    throw new Error(`Cannot find package '${pkgName}' in a node_modules above ${cwd}`);
  }
  const req = createRequire(join(cwd, 'package.json'));
  // `.` (the main entry) is exported even when subpaths are not.
  let pkgDir = dirname(req.resolve(pkgName));
  while (!existsSync(join(pkgDir, 'package.json'))) {
    const parent = dirname(pkgDir);
    if (parent === pkgDir) throw new Error(`package.json not found for ${pkgName}`);
    pkgDir = parent;
  }
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binName];
  if (!binRel) throw new Error(`bin '${binName}' not found in ${pkgName}`);
  return resolve(pkgDir, binRel);
}

/**
 * @param {string} cwd
 * @param {string} pkgName
 * @returns {boolean} whether `node_modules/<pkgName>` exists in cwd or an ancestor
 */
function hasNodeModulesEntry(cwd, pkgName) {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(join(dir, 'node_modules', pkgName))) return true;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}
