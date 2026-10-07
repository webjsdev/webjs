/**
 * Dev-server reload supervisor planning for `webjs dev` (issues #514, #1521).
 *
 * `webjs dev` runs its server in a CHILD process that a supervising parent
 * restarts, so an edit to a transitively-imported module (an action, query,
 * component, util) takes effect without a manual restart. Both runtimes cache
 * ES modules by resolved URL with no public invalidation API, so the dev
 * re-import in `@webjsdev/server`'s `dev.js` relies on a fresh process (Node)
 * or the runtime's own cache invalidation (Bun):
 *
 * - **Node** has no in-place module-cache eviction, so the parent RESTARTS the
 *   child on a change under the watched paths (a fresh ESM cache each time).
 *   This used to be `node --watch`, which dies on the first watcher error it
 *   cannot handle (an EACCES on a temp file another user created, a file that
 *   vanished mid-scan, #1521) and takes the preview down for good. WebJs's own
 *   supervisor (`lib/dev-reload.js`) watches the same paths with every watcher
 *   error handled, and restarts the child faster.
 * - **Bun** runs the child under `bun --hot`, which invalidates loaded modules
 *   on a file change WITHOUT restarting the process (so a page edit can be
 *   refreshed in place, #1398). But `bun --hot` does not watch a file whose
 *   contents a `Bun.plugin` `onLoad` returned (#1550), and two plugins serve
 *   app modules on Bun: the `'use server'` seed plugin (every `*.server.*`
 *   module, always on) and the SSR source-locations plugin (every other app
 *   JS/TS module when source locations are on). An edit to one of THOSE
 *   restarts the child, like Node; every other edit is left to `bun --hot`.
 *   A module the server re-imports directly (a page, an action module) is fresh
 *   even before the restart lands, because the dev cache-bust import rides a
 *   plain path on Bun (`devImportSpecifier` in `@webjsdev/server`; Bun drops a
 *   `file://` specifier's query).
 *
 * On both runtimes a child that exits on its own (a crash) is restarted on the
 * next file change, and after a short backoff even with no change.
 *
 * This pure planner returns the spawn decision so the bin stays a thin shell and
 * the branch logic is unit-testable without spawning a process.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Project directories whose changes restart the dev server on Node. */
export const WATCH_DIRS = ['app', 'components', 'modules', 'lib', 'actions'];

/**
 * Every extension the server's root-middleware lookup accepts, in the same
 * order. If these two lists diverge, an app gets a middleware that loads but
 * never restarts the dev server when edited, which is the quiet half of the
 * bug where a `middleware.ts` was loaded by neither.
 */
export const WATCH_FILES = ['middleware.ts', 'middleware.js', 'middleware.mts', 'middleware.mjs', ...bootFiles()];

/**
 * The app-root boot hooks the server runs ONCE per process (#1575):
 * `instrumentation.*` (its `register()`) and `env.*` (the env validation). An
 * edit to one restarts the dev server on either runtime, because no in-place
 * reload re-runs them.
 * @returns {string[]}
 */
function bootFiles() {
  return ['instrumentation', 'env'].flatMap((n) => ['ts', 'js', 'mts', 'mjs'].map((x) => `${n}.${x}`));
}

const BOOT_FILE = /^(?:instrumentation|env)\.m?[jt]s$/;

/**
 * Whether a changed (app-relative) path is a boot hook (see `bootFiles`).
 * @param {string} path
 * @returns {boolean}
 */
export function isBootFile(path) {
  return BOOT_FILE.test(path);
}

/**
 * Plan how `webjs dev` runs its server.
 *
 * @param {object} opts
 * @param {boolean} opts.isBun  Whether the host runtime is Bun (`process.versions.bun`).
 * @param {string[]} opts.argv  `process.argv.slice(1)` (the script path followed by its args), forwarded to the child verbatim.
 * @param {boolean} opts.noHot  Whether `--no-hot` was passed (opt out of the supervisor entirely).
 * @param {boolean} [opts.sourceLocations]  Whether dev source locations are on (`WEBJS_SOURCE_LOCATIONS` / `webjs.dev.sourceLocations`), which puts every app module behind a Bun plugin.
 * @returns {{ mode: 'inline' } | { mode: 'supervise', args: string[], env?: Record<string, string>, restartOnChange: boolean, restartFor?: (path: string) => boolean, inPlaceRestartFor?: (path: string) => boolean, watchDirs: string[], watchFiles: string[] }}
 *   `inline` runs the server in this process (no reload watcher); `supervise`
 *   spawns `process.execPath` with `args` and `__WEBJS_DEV_CHILD=1` under the
 *   supervisor, which watches `watchDirs` (recursively) and `watchFiles` (at
 *   the app root). The directories need not exist yet: one created later is
 *   picked up.
 */
export function planDevSupervisor({ isBun, argv, noHot, sourceLocations = false }) {
  // `--no-hot` opts out of the reload supervisor on either runtime: run the dev
  // server in THIS process with no watcher. Degraded dev (a deep-import edit
  // needs a manual restart) but useful under an external process manager or a
  // debugger that wants a single, un-re-exec'd process.
  if (noHot) return { mode: 'inline' };

  const watch = { watchDirs: [...WATCH_DIRS], watchFiles: [...WATCH_FILES] };
  if (isBun) {
    // `restartFor` covers a server that cannot reload a plugin-served module in
    // place. A server that can says so over IPC once it is up (#1575), and the
    // supervisor narrows to `inPlaceRestartFor`: only the boot hooks restart.
    const plugin = bunPluginServed(sourceLocations);
    return {
      mode: 'supervise',
      args: ['--hot', ...argv],
      env: BUN_CHILD_ENV,
      restartOnChange: true,
      restartFor: (p) => plugin(p) || isBootFile(p),
      inPlaceRestartFor: isBootFile,
      ...watch,
    };
  }
  return { mode: 'supervise', args: [...argv], restartOnChange: true, ...watch };
}

/**
 * Extra env for the Bun dev child: turn off Bun's runtime transpiler cache.
 *
 * Bun caches the transpile of every source over 50KB on disk, keyed by the
 * file's CONTENT, with the import paths a `Bun.plugin` `onResolve` returned
 * baked in. The dev alias resolver (#1575) returns absolute paths, so the
 * cached output of a large app module pins its `#` imports to the checkout
 * that first ran `webjs dev`. Any other copy of the same file (a git worktree,
 * a moved or copied app, a later `webjs start`) then imports from that old
 * directory: a 500 when it is gone, the other copy's code when it is not. The
 * variable is read at process start, so it has to be set on the child.
 */
const BUN_CHILD_ENV = Object.freeze({ BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' });

const SERVER_MODULE = /\.server\.m?[jt]s$/;
const APP_MODULE = /\.m?[jt]s$/;

/**
 * The changed paths `bun --hot` cannot reload because a `Bun.plugin` serves
 * them (#1550): every `*.server.*` module (the `'use server'` seed plugin), and
 * with source locations on every JS/TS app module (the source-locations
 * plugin). Paths are app-relative, as the supervisor's watcher reports them.
 *
 * @param {boolean} sourceLocations
 * @returns {(path: string) => boolean}
 */
export function bunPluginServed(sourceLocations) {
  return (path) => SERVER_MODULE.test(path) || (sourceLocations && APP_MODULE.test(path));
}

/**
 * Whether dev source locations are on, the same rule the server applies
 * (`sourceLocationsRequested` in `@webjsdev/server`): `WEBJS_SOURCE_LOCATIONS`
 * set to 1/true or 0/false wins, otherwise `webjs.dev.sourceLocations`.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {unknown} configured the app's `webjs.dev.sourceLocations`
 * @returns {boolean}
 */
export function sourceLocationsOn(env, configured) {
  const v = String(env.WEBJS_SOURCE_LOCATIONS || '').trim().toLowerCase();
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return configured === true;
}

/**
 * The app's `webjs.dev.sourceLocations` from `<appDir>/package.json`, or
 * undefined when the file or the key is missing or unreadable.
 *
 * @param {string} appDir
 * @returns {unknown}
 */
export function readDevSourceLocations(appDir) {
  try {
    return JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'))?.webjs?.dev?.sourceLocations;
  } catch {
    return undefined;
  }
}
