import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Resolve a package's installed directory on disk, handling both direct
 * installation and npm workspace hoisting.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {string | null}
 */
function resolvePackageDir(pkgName, appDir) {
  let entry;
  try {
    const req = createRequire(join(appDir, 'package.json'));
    entry = req.resolve(pkgName);
  } catch {
    // Resolve ONLY from the app. Falling back to the framework's own
    // resolution would vendor a package the app never installed, which in a
    // monorepo (where everything hoists to the root) is most of them.
    return null;
  }
  try {
    const parts = entry.split(sep);
    const nmIdx = parts.lastIndexOf('node_modules');
    if (nmIdx < 0) {
      let dir = dirname(entry);
      for (let i = 0; i < 8; i++) {
        if (existsSync(join(dir, 'package.json'))) return realpathSync(dir);
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return null;
    }
    const segmentsAfterNm = pkgName.startsWith('@') ? 2 : 1;
    const root = parts.slice(0, nmIdx + 1 + segmentsAfterNm).join(sep);
    return realpathSync(root);
  } catch {
    return null;
  }
}

/**
 * Read the installed version of a package from `node_modules/<pkg>/
 * package.json`. Handles workspace hoisting and packages that lock
 * down `./package.json` in their exports field.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {string | null}
 */
export function getPackageVersion(pkgName, appDir) {
  const real = resolvePackageDir(pkgName, appDir);
  if (!real) return null;
  try {
    const pkg = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Read the installed package's declared `dependencies` + `peerDependencies`
 * from its `package.json`, hoist-aware (same resolution as `getPackageVersion`,
 * so a monorepo-hoisted dep resolves from the workspace root). Returns null
 * when the package is not installed / unreadable, which the importmap-coherence
 * check (#450) treats as "could not verify" rather than a conflict.
 *
 * This is the "already-resolved metadata, no network" source the coherence
 * check prefers: the package is on disk because the importmap pinned it, so its
 * manifest is a local read.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {{ dependencies: Record<string,string>, peerDependencies: Record<string,string> } | null}
 */
export function getPackageManifest(pkgName, appDir) {
  const real = resolvePackageDir(pkgName, appDir);
  if (!real) return null;
  try {
    const pkg = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
    return {
      dependencies: pkg.dependencies || {},
      peerDependencies: pkg.peerDependencies || {},
    };
  } catch {
    return null;
  }
}

/**
 * The names a package depends on at runtime (`dependencies`,
 * `peerDependencies`, `optionalDependencies`) and its installed directory,
 * resolved from `fromDir` (#1518). Resolving a dependency from its DEPENDENT's
 * directory finds a nested install as well as a hoisted one, so the pin prune
 * can walk the real installed graph. Null when the package is not installed.
 *
 * @param {string} pkgName
 * @param {string} fromDir  a directory holding a package.json (the app, or a dependent package)
 * @returns {{ dir: string, names: string[] } | null}
 */
export function getPackageDeps(pkgName, fromDir) {
  const real = resolvePackageDir(pkgName, fromDir);
  if (!real) return null;
  try {
    const pkg = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
    const names = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      ...Object.keys(pkg.optionalDependencies || {}),
    ]);
    return { dir: real, names: [...names] };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// JSPM Generator API client
// ---------------------------------------------------------------------------
