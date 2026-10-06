import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep, matchesGlob } from 'node:path';

/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 */

/** @param {string} p */
function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * The workspace globs a root package.json declares (npm / bun / yarn), in
 * either the array form or yarn's `{ packages: [...] }` form, else null.
 * @param {any} pkg
 * @returns {string[] | null}
 */
function workspaceGlobs(pkg) {
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) return ws;
  if (ws && Array.isArray(ws.packages)) return ws.packages;
  return null;
}

/**
 * Find the workspace root that `appDir` is a MEMBER of: the nearest ancestor
 * whose package.json `workspaces` globs match the app's relative path. A plain
 * parent with a package.json but no matching glob is not a workspace for this
 * app, so it does not count.
 * @param {string} appDir
 * @returns {string | null}
 */
export function findWorkspaceRoot(appDir) {
  let dir = dirname(appDir);
  for (;;) {
    const pkg = existsSync(join(dir, 'package.json')) ? readJson(join(dir, 'package.json')) : null;
    const globs = workspaceGlobs(pkg);
    if (globs) {
      const rel = relative(dir, appDir).split(sep).join('/');
      const included = globs.filter((g) => !g.startsWith('!')).some((g) => matchesGlob(rel, g.replace(/^\.\//, '').replace(/\/$/, '')));
      const excluded = globs.filter((g) => g.startsWith('!')).some((g) => matchesGlob(rel, g.slice(1).replace(/^\.\//, '')));
      if (included && !excluded) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * CHECK (#1492), dependency overrides declared in a workspace MEMBER. npm and
 * bun honour `overrides` (and yarn / bun `resolutions`) only in the workspace
 * ROOT package.json, so the same block in a member is silently ignored and the
 * security floor it encodes (the scaffold's puppeteer-core and basic-ftp
 * floors) never applies. WARN naming the root to move it to; PASS otherwise.
 * @param {string} appDir
 * @returns {DoctorResult}
 */
export function checkWorkspaceOverrides(appDir) {
  const name = 'workspace-overrides';
  const pkg = readJson(join(appDir, 'package.json'));
  const keys = ['overrides', 'resolutions'].filter((k) => pkg && pkg[k] && typeof pkg[k] === 'object' && Object.keys(pkg[k]).length);
  if (keys.length === 0) {
    return { name, status: 'pass', message: 'No dependency overrides in this package.json.' };
  }
  const root = findWorkspaceRoot(appDir);
  if (!root) {
    return { name, status: 'pass', message: `\`${keys.join('` / `')}\` apply: this app is not a workspace member.` };
  }
  const rel = relative(appDir, join(root, 'package.json')) || 'package.json';
  return {
    name,
    status: 'warn',
    message: `package.json declares \`${keys.join('` / `')}\`, but this app is a member of the workspace at ${rel}, `
      + 'and package managers honour overrides only at the workspace root, so these are ignored.',
    fix: `Move the \`${keys.join('` / `')}\` block into ${rel} (merge it with any the root already has).`,
  };
}
