/**
 * Dev-server reload supervisor planning for `webjs dev` (issues #514, #1521).
 *
 * `webjs dev` runs its server in a CHILD process that a supervising parent
 * restarts when it must, so an edit to a transitively-imported module (an
 * action, query, component, util) takes effect without a manual restart. Both
 * runtimes cache ES modules by resolved URL with no public invalidation API, so
 * the server needs the runtime's help to re-evaluate an edit in place:
 *
 * - **Node** gets it from a `module.registerHooks` resolve hook in
 *   `@webjsdev/server` (`dev/esm-hot-hooks.js`, #1689) that gives an edited
 *   module and its importers a new URL, so the child re-evaluates them in
 *   place. The child announces that over IPC once it is up, and from then on
 *   only a restart file (`RESTART_FILES`) restarts it. Until it announces, or on
 *   a Node with no `registerHooks`, every change under the watched paths
 *   restarts it (a fresh ESM cache each time), which is also what brings a
 *   crashed child back. This used to be `node --watch`, which dies on the first
 *   watcher error it cannot handle (an EACCES on a temp file another user
 *   created, a file that vanished mid-scan, #1521) and takes the preview down
 *   for good. WebJs's own supervisor (`lib/dev-reload.js`) watches the same
 *   paths with every watcher error handled.
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

/**
 * Project directories the supervisor watches. A change there restarts a Node
 * child that has not announced in-place reloads, and starts a crashed child on
 * either runtime. `db` is in the list so a schema edit (a new table or
 * relation) reaches such a child too (#1664).
 * Only JS / TS source under it counts: `shouldIgnoreRestartPath` in
 * `dev-reload.js` skips every other file there, so a database file and its
 * sidecars, which change on every write, never restart anything.
 */
export const WATCH_DIRS = ['app', 'components', 'modules', 'lib', 'actions', 'db'];

/**
 * The app-root files only a fresh process can apply, so an edit to one
 * restarts the dev server on either runtime even when it reloads everything
 * else in place:
 *
 * - `instrumentation.*` (its `register()`) and `env.*` (the env validation),
 *   which the server runs ONCE per process (#1575).
 * - `.env`, loaded once at boot, and `package.json`, whose `webjs.*` keys are
 *   mostly read once (#1689). The CLI starts the child with the shell's env,
 *   not one `.env` was already loaded into, so the restarted child reads the
 *   edited file instead of keeping the old values.
 * - The lockfiles, since a dependency change means new code under
 *   `node_modules`, which nothing reloads in place.
 */
export const RESTART_FILES = Object.freeze([
  ...['instrumentation', 'env'].flatMap((n) => ['ts', 'js', 'mts', 'mjs'].map((x) => `${n}.${x}`)),
  '.env',
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'bun.lock',
  'bun.lockb',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const RESTART_FILE = /^(?:(?:instrumentation|env)\.m?[jt]s|\.env|package\.json|package-lock\.json|npm-shrinkwrap\.json|bun\.lockb?|pnpm-lock\.yaml|yarn\.lock)$/;

/**
 * Whether a changed (app-relative) path is a restart file (see
 * `RESTART_FILES`). Root files only: a `package.json` in a subdirectory is not
 * the app's.
 * @param {string} path
 * @returns {boolean}
 */
export function isRestartFile(path) {
  return RESTART_FILE.test(path);
}

/**
 * The env var that hands the child the restart-file pattern (#1689). The child's
 * own watcher sees the same root files, and a frame it sent for one would be a
 * second reload on top of the restart, so it skips exactly what the supervisor
 * restarts for. Passed as the regex source rather than restated in
 * `@webjsdev/server`, which the CLI does not depend on, so the two can never
 * disagree.
 */
export const RESTART_FILES_ENV = '__WEBJS_DEV_RESTART_FILES';
const RESTART_CHILD_ENV = Object.freeze({ [RESTART_FILES_ENV]: RESTART_FILE.source });

/**
 * The app-root files the supervisor watches: every extension the server's
 * root-middleware lookup accepts, in the same order, plus every restart file.
 * If the middleware list diverges from the server's, an app gets a middleware
 * that loads but never restarts the dev server when edited, which is the quiet
 * half of the bug where a `middleware.ts` was loaded by neither.
 */
export const WATCH_FILES = ['middleware.ts', 'middleware.js', 'middleware.mts', 'middleware.mjs', ...RESTART_FILES];

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
    // supervisor narrows to `inPlaceRestartFor`: only the restart files restart.
    const plugin = bunPluginServed(sourceLocations);
    return {
      mode: 'supervise',
      args: ['--hot', ...argv],
      env: { ...BUN_CHILD_ENV, ...RESTART_CHILD_ENV },
      restartOnChange: true,
      restartFor: (p) => plugin(p) || isRestartFile(p),
      inPlaceRestartFor: isRestartFile,
      ...watch,
    };
  }
  // Node: every change restarts a child that has not announced it reloads in
  // place (an older `@webjsdev/server`, a Node with no `module.registerHooks`).
  // Once it announces (#1689), only the restart files do.
  return {
    mode: 'supervise',
    args: [...argv],
    env: RESTART_CHILD_ENV,
    restartOnChange: true,
    restartFor: () => true,
    inPlaceRestartFor: isRestartFile,
    ...watch,
  };
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
