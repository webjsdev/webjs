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
 * - **Bun** keys its module cache by path and IGNORES the `?t=` cache-bust, so
 *   a restart-per-edit model is not needed: `bun --hot` invalidates loaded
 *   modules on a file change WITHOUT restarting the process, and `Bun.serve` is
 *   reused across hot reloads. The parent still supervises it, but only to
 *   bring a CRASHED child back (`restartOnChange: false`).
 *
 * On both runtimes a child that exits on its own (a crash) is restarted on the
 * next file change, and after a short backoff even with no change.
 *
 * This pure planner returns the spawn decision so the bin stays a thin shell and
 * the branch logic is unit-testable without spawning a process.
 */

/** Project directories whose changes restart the dev server on Node. */
export const WATCH_DIRS = ['app', 'components', 'modules', 'lib', 'actions'];

/**
 * Every extension the server's root-middleware lookup accepts, in the same
 * order. If these two lists diverge, an app gets a middleware that loads but
 * never restarts the dev server when edited, which is the quiet half of the
 * bug where a `middleware.ts` was loaded by neither.
 */
export const WATCH_FILES = ['middleware.ts', 'middleware.js', 'middleware.mts', 'middleware.mjs'];

/**
 * Plan how `webjs dev` runs its server.
 *
 * @param {object} opts
 * @param {boolean} opts.isBun  Whether the host runtime is Bun (`process.versions.bun`).
 * @param {string[]} opts.argv  `process.argv.slice(1)` (the script path followed by its args), forwarded to the child verbatim.
 * @param {boolean} opts.noHot  Whether `--no-hot` was passed (opt out of the supervisor entirely).
 * @returns {{ mode: 'inline' } | { mode: 'supervise', args: string[], restartOnChange: boolean, watchDirs: string[], watchFiles: string[] }}
 *   `inline` runs the server in this process (no reload watcher); `supervise`
 *   spawns `process.execPath` with `args` and `__WEBJS_DEV_CHILD=1` under the
 *   supervisor, which watches `watchDirs` (recursively) and `watchFiles` (at
 *   the app root). The directories need not exist yet: one created later is
 *   picked up.
 */
export function planDevSupervisor({ isBun, argv, noHot }) {
  // `--no-hot` opts out of the reload supervisor on either runtime: run the dev
  // server in THIS process with no watcher. Degraded dev (a deep-import edit
  // needs a manual restart) but useful under an external process manager or a
  // debugger that wants a single, un-re-exec'd process.
  if (noHot) return { mode: 'inline' };

  const watch = { watchDirs: [...WATCH_DIRS], watchFiles: [...WATCH_FILES] };
  if (isBun) return { mode: 'supervise', args: ['--hot', ...argv], restartOnChange: false, ...watch };
  return { mode: 'supervise', args: [...argv], restartOnChange: true, ...watch };
}
