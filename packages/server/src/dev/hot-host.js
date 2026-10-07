/**
 * One dev server per process under `bun --hot` (#1575).
 *
 * `bun --hot` re-evaluates the entry module whenever a file it loaded changes,
 * with a fresh module registry and `globalThis` preserved. For `webjs dev` the
 * entry is the CLI, so every page, layout or component edit ran `startServer`
 * again: a second request handler, a second set of file watchers, a second SSE
 * hub, another `instrumentation.register()`, and both `Bun.plugin` hooks
 * registered again. Nothing from the previous run was disposed, because nothing
 * could reach it. Measured on the scaffold: about 25 MB more per edit, 5.8 GB
 * after 225 edits, after which `bun --hot` stopped reloading at all and a
 * component edit was never served again until a restart. A second instance also
 * built its route table before its watchers existed, so a file added or renamed
 * while it booted was invisible to the instance that ended up serving (a 404
 * for a route that exists, an unknown action).
 *
 * So the first run owns the process: its listener, hub, watchers and request
 * handler stay, and a later run only tells it the module registry was reset
 * (`rerun`). The handler then re-derives its analysis on the next request,
 * which re-imports the app's modules from the fresh registry. The framework's
 * own code stays the first run's, so its caches stay warm. Mixing that code
 * with app modules from a later registry is safe by design: core's type checks
 * are structural (`_$webjs`) and its shared state is keyed by `Symbol.for`.
 *
 * The state lives on `globalThis` under a `Symbol.for` key because a re-run
 * evaluates a NEW copy of this module, whose own module variables start empty.
 *
 * @module dev/hot-host
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const HOSTS = Symbol.for('webjs.dev.hotHosts');

/**
 * Sent to the `webjs dev` supervisor over IPC once the hot host is up, so it
 * stops restarting the process for plugin-served edits this server now reloads
 * in place. Mirrors `HOT_IN_PLACE_MESSAGE` in `@webjsdev/cli`'s `dev-reload.js`.
 */
export const HOT_IN_PLACE_MESSAGE = 'hot-reload-in-place';

/** Tell the supervisor (when there is one) that edits reload in place. */
export function announceHotInPlace() {
  try {
    if (typeof process.send === 'function' && process.connected) process.send({ webjs: HOT_IN_PLACE_MESSAGE });
  } catch { /* no supervisor, or it is gone */ }
}

/**
 * Whether this process re-runs its entry on a file change: Bun under `--hot`.
 *
 * @param {{ isBun?: boolean, execArgv?: string[] }} [env]
 * @returns {boolean}
 */
export function hotRerunCapable({ isBun = !!process.versions.bun, execArgv = process.execArgv } = {}) {
  return isBun && Array.isArray(execArgv) && execArgv.includes('--hot');
}

/**
 * @typedef {{
 *   version: string,
 *   rerun: () => Promise<unknown>,
 *   poke: () => void,
 * }} HotHost
 */

/** @returns {Map<string, HotHost>} */
function hosts() {
  const g = /** @type {any} */ (globalThis);
  if (!(g[HOSTS] instanceof Map)) g[HOSTS] = new Map();
  return g[HOSTS];
}

/**
 * The host key: one dev server per app directory and port.
 * @param {string} appDir absolute
 * @param {number} port
 */
export function hotHostKey(appDir, port) {
  return `${appDir}\0${port}`;
}

/** @param {string} key @returns {HotHost | undefined} */
export function getHotHost(key) {
  return hosts().get(key);
}

/** @param {string} key @param {HotHost} host */
export function setHotHost(key, host) {
  hosts().set(key, host);
}

/** @param {string} key */
export function deleteHotHost(key) {
  hosts().delete(key);
}

/**
 * The sentinel module that lets the dev server ask `bun --hot` for a re-run.
 * `bun --hot` does not watch a module a `Bun.plugin` served (#1550), and in dev
 * every app module is one (`*.server.*` through the seed plugin, the rest
 * through `dev/bun-app-source.js`). A `*.server.*` edit used to restart the
 * whole process, which dropped requests for 0.3 to 2 seconds. Writing this file
 * instead re-runs the entry within milliseconds, which resets the registry.
 *
 * It lives in the OS temp dir, per process: inside the app it would match the
 * app-source plugin's filter (and so not be watched) and the dev watcher.
 *
 * @param {string} appDir
 * @returns {string} absolute path
 */
export function hotSentinelPath(appDir) {
  const tag = createHash('sha1').update(appDir).digest('hex').slice(0, 12);
  return join(tmpdir(), 'webjs-dev-hot', `${process.pid}-${tag}.mjs`);
}

/**
 * Create (if needed) and import the sentinel so `bun --hot` watches it. A
 * re-run's fresh registry imports (and so watches) it again.
 *
 * @param {string} appDir
 * @returns {Promise<void>}
 */
export async function armHotSentinel(appDir) {
  const file = hotSentinelPath(appDir);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'export default 0;\n', { flag: 'wx' });
  } catch { /* already there */ }
  try { await import(pathToFileURL(file).href); } catch { /* best effort: without it a poke is a no-op */ }
}

/** Remove the sentinel (the server is closing). @param {string} appDir */
export function removeHotSentinel(appDir) {
  try { rmSync(hotSentinelPath(appDir), { force: true }); } catch { /* best effort */ }
}

/**
 * Ask `bun --hot` for a re-run by changing the sentinel.
 * @param {string} appDir
 */
export function pokeHotSentinel(appDir) {
  try { writeFileSync(hotSentinelPath(appDir), `export default ${Date.now()};\n`); } catch { /* best effort */ }
}

const APP_MODULE = /\.m?[jt]s$/;
/** Files no module imports at runtime: an edit to one never needs a registry reset. */
const INERT_ASSET = /\.(?:css|md|mdx|txt|log|map|png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|otf)$/i;

/**
 * Whether a changed path could leave a stale module in the registry, so the
 * dev server has to ask `bun --hot` for a reset. In dev on Bun every JS/TS
 * module of the app is served by a `Bun.plugin` (`*.server.*` through the seed
 * plugin, the rest through `dev/bun-app-source.js` or the source-locations
 * plugin), which `bun --hot` never watches.
 *
 * `isRouteOnly` answers whether a module path is one only the router loads
 * (nothing imports it; see `needsRegistryReset` on the request handler): its
 * dev re-import is keyed by content, so it needs no reset. Anything the
 * dev server cannot place, such as the extensionless temp file `sed -i`
 * renames over the real one, gets the reset, because the event may name the
 * temp file rather than the module it replaced.
 *
 * @param {string} path  relative to the watched root
 * @param {(path: string) => boolean} isRouteOnly
 * @returns {boolean}
 */
export function needsHotReset(path, isRouteOnly) {
  if (/(?:^|[\\/])node_modules[\\/]/.test(path)) return false;
  if (INERT_ASSET.test(path)) return false;
  if (APP_MODULE.test(path)) return !isRouteOnly(path);
  return true;
}
