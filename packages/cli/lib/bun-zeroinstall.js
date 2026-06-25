// Run spawned CLI tooling (drizzle-kit, tsc) under Bun zero-install (#704).
//
// `webjs db` / `typecheck` spawn a tool as a SEPARATE Bun process. Under Bun
// zero-install there is no `node_modules`, so `resolveBin` cannot find the tool
// bin. Instead we let Bun auto-install resolve it: the cli pins the bin spec to
// the app-declared version, and a `bun --preload <server pin>` rewrites the
// tool's transitive bare imports (the user schema's `import 'drizzle-orm'`) to
// the app's pinned versions. See `bun-tool-run.mjs`.

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { appDeclaredVersion, importWebjsdev } from './import-webjsdev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * True when running on Bun with NO `node_modules` in `cwd` (genuine
 * zero-install). On Node, or an installed app, this is false and the caller
 * keeps its existing `resolveBin` path.
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function isBunZeroInstall(cwd = process.cwd()) {
  return !!process.versions.bun && !existsSync(join(cwd, 'node_modules'));
}

/**
 * The pinned bin specifier for a tool: `<pkg>@<app-declared-version>/<binSubpath>`
 * when the app declares an inline-safe version, else the bare `<pkg>/<binSubpath>`
 * (Bun resolves it to latest, the pre-feature behaviour). Pure, for testing.
 * @param {string} pkg
 * @param {string} binSubpath
 * @param {string} [cwd]
 * @returns {string}
 */
export function pinnedBinSpec(pkg, binSubpath, cwd = process.cwd()) {
  const v = appDeclaredVersion(pkg, cwd);
  return (v ? `${pkg}@${v}` : pkg) + '/' + binSubpath;
}

/**
 * Build the `bun` argv to run a tool under zero-install. Pure, for testing.
 * @param {{ preloadPath: string, binSpec: string, argv0: string, args: string[] }} o
 * @returns {string[]}
 */
export function bunToolArgv({ preloadPath, binSpec, argv0, args }) {
  const runner = join(__dirname, 'bun-tool-run.mjs');
  return ['--preload', preloadPath, runner, binSpec, argv0, ...args];
}

/**
 * Spawn a CLI tool under Bun zero-install and resolve with its exit code. Reads
 * the server's spawn pin preload path off the already-loaded `@webjsdev/server`
 * (no extra resolution under zero-install).
 * @param {{ pkg: string, binSubpath: string, argv0: string, args: string[], cwd?: string }} o
 * @returns {Promise<number>}
 */
export async function runBunTool({ pkg, binSubpath, argv0, args, cwd = process.cwd() }) {
  const server = await importWebjsdev('@webjsdev/server');
  const preloadPath = server.bunPinPreloadPath;
  if (!preloadPath) throw new Error('@webjsdev/server did not expose bunPinPreloadPath');
  const argv = bunToolArgv({ preloadPath, binSpec: pinnedBinSpec(pkg, binSubpath, cwd), argv0, args });
  return new Promise((resolve) => {
    const child = spawn('bun', argv, { stdio: 'inherit', cwd });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}
