/**
 * In-place server module freshness for `webjs dev` on Node (#1689).
 *
 * Node keys its ESM cache by the full resolved URL and has no API to evict a
 * module. The dev re-import (`dev-import.js`) gives the module the server
 * imports directly a content `?t=` query, so an edited page loads fresh, but
 * every module that page imports comes back from the cache unchanged. That is
 * why the dev supervisor used to restart the whole process on any edit.
 *
 * This module makes the restart unnecessary with a `module.registerHooks`
 * RESOLVE hook and no source rewriting. The hook calls `nextResolve` first,
 * then, for an app ESM module, records the edge `importer -> module` and, when
 * the module has been bumped, returns its URL with `webjs-v=<n>` set. A rebuild
 * calls `bumpModuleVersions(changed)`, which gives the edited files and every
 * transitive importer the hook has seen ONE new number. The next request's
 * import of the entry then resolves its whole static chain again: edited
 * modules and their importers evaluate fresh, and every other module keeps its
 * instance and its module-scope state (a session map, a `cache()` store, a
 * counter, an open connection).
 *
 * Why a resolve hook rather than a load hook that rewrites import specifiers
 * (the Remix `node-hmr` shape): the resolve hook sees every edge Node actually
 * links, static, `export from`, string and computed dynamic `import()`, `#`
 * aliases and `.js`-to-`.ts`, and nothing touches source bytes, so stack
 * positions and source maps stay exact. Edges come from the hook, never from
 * the analysis graph, because the hook's edges are exactly the modules that
 * have instances to invalidate, including `db/`, `route.ts`, middleware and
 * `*.server.*` files the browser graph never walks.
 *
 * Every other query on the URL is kept (`?t=` from `devImport`, the seed
 * facade's `webjs-seed-orig`), so the seed facade and the original it imports
 * carry the same `webjs-v` and move together.
 *
 * State lives on `globalThis` under a registered symbol, so a second handler in
 * one process (tests) shares it with the hook. Old module instances stay in
 * Node's cache for the life of the dev process, the trade Remix accepts too;
 * `devImport` stays content-keyed, so an idle tab adds nothing. Node only: on
 * Bun `bun --hot` and the fresh-reading app plugin do this job (`hot-host.js`,
 * `bun-app-source.js`), and a runtime with no `registerHooks` keeps the dev
 * supervisor's restart.
 */
import * as nodeModule from 'node:module';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative, isAbsolute } from 'node:path';

/** What the hook may version: an app ESM module. */
const MODULE_FILE = /\.(?:m?[jt]s|json)$/;

/**
 * @typedef {{
 *   roots: Set<string>,
 *   versions: Map<string, number>,
 *   importers: Map<string, Set<string>>,
 *   next: number,
 *   installed: boolean,
 * }} EsmHotState
 */

/** @returns {EsmHotState} */
function state() {
  const g = /** @type {any} */ (globalThis);
  const key = Symbol.for('webjs.dev.esmHot');
  if (!g[key]) {
    g[key] = { roots: new Set(), versions: new Map(), importers: new Map(), next: 1, installed: false };
  }
  return g[key];
}

/**
 * Whether an absolute path is an app module the hook versions: under a
 * registered app root, outside its `node_modules` and `.webjs`, with a module
 * extension.
 * @param {string} abs
 * @param {EsmHotState} st
 */
function isAppModule(abs, st) {
  if (!MODULE_FILE.test(abs)) return false;
  for (const root of st.roots) {
    const rel = relative(root, abs);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue;
    if (/(?:^|[\\/])(?:node_modules|\.webjs)(?:[\\/]|$)/.test(rel)) return false;
    return true;
  }
  return false;
}

/** The path of a `file:` URL with its query dropped, or null. @param {string | undefined} url */
function pathOf(url) {
  if (typeof url !== 'string' || !url.startsWith('file:')) return null;
  return fileURLToPath(new URL(url));
}

/**
 * The resolve hook. Fail-open: anything it cannot handle returns
 * `nextResolve`'s result unchanged, and an error from `nextResolve` itself (a
 * file that does not exist yet) propagates as is. Node does not keep a link
 * that failed on resolution, so once the file exists the unchanged importer
 * links again with no version of its own.
 * @param {string} specifier
 * @param {{ parentURL?: string }} context
 * @param {(s: string, c: any) => { url: string, format?: string | null }} nextResolve
 */
function resolveHook(specifier, context, nextResolve) {
  const result = nextResolve(specifier, context);
  try {
    if (!result || typeof result.url !== 'string' || !result.url.startsWith('file:')) return result;
    if (typeof result.format === 'string' && result.format.startsWith('commonjs')) return result;
    const st = state();
    const url = new URL(result.url);
    const abs = fileURLToPath(url);
    if (!isAppModule(abs, st)) return result;
    const parent = pathOf(context && context.parentURL);
    if (parent && parent !== abs && isAppModule(parent, st)) {
      let set = st.importers.get(abs);
      if (!set) st.importers.set(abs, (set = new Set()));
      set.add(parent);
    }
    const n = st.versions.get(abs) || 0;
    if (!n) return result;
    url.searchParams.set('webjs-v', String(n));
    return { ...result, url: url.href };
  } catch {
    return result;
  }
}

/**
 * Install the resolve hook for an app root. Idempotent: the hook registers once
 * per process and each call adds a root. Returns false, installing nothing, on
 * Bun and on a Node with no `module.registerHooks`.
 * @param {string} appDir  absolute app root
 * @returns {boolean}
 */
export function installEsmHotHooks(appDir) {
  if (process.versions.bun) return false;
  if (typeof nodeModule.registerHooks !== 'function') return false;
  const st = state();
  st.roots.add(appDir);
  if (!st.installed) {
    nodeModule.registerHooks({ resolve: resolveHook });
    st.installed = true;
  }
  return true;
}

/** Whether the resolve hook is installed in this process. @returns {boolean} */
export function hotHooksInstalled() {
  return state().installed;
}

/**
 * The version the hook stamps on a module, 0 when it was never bumped.
 * @param {string} abs
 * @returns {number}
 */
export function moduleVersion(abs) {
  return state().versions.get(abs) || 0;
}

/**
 * The spellings a changed path can have in the hook's maps. The watcher
 * reports a path under the app dir as given, while Node resolves module URLs to
 * real paths, so a symlinked app dir needs both. A deleted file has no
 * realpath, so its directory's is used.
 * @param {string} abs
 * @returns {string[]}
 */
function spellings(abs) {
  const out = [abs];
  try {
    const real = realpathSync(abs);
    if (real !== abs) out.push(real);
  } catch {
    try {
      const real = join(realpathSync(dirname(abs)), basename(abs));
      if (real !== abs) out.push(real);
    } catch { /* the directory is gone too */ }
  }
  return out;
}

/**
 * Give the changed files and every transitive importer the hook has recorded
 * ONE new version. The next import of any of them gets a new URL and evaluates
 * fresh; everything else keeps its instance. Only app modules are versioned. A
 * no-op returning an empty set when the hook is not installed.
 * @param {Iterable<string>} absFiles  absolute paths of the changed files
 * @returns {Set<string>} every path that got the new version
 */
export function bumpModuleVersions(absFiles) {
  const st = state();
  /** @type {Set<string>} */
  const bumped = new Set();
  if (!st.installed) return bumped;
  const n = st.next++;
  const stack = [];
  for (const f of absFiles) stack.push(...spellings(f));
  while (stack.length) {
    const f = /** @type {string} */ (stack.pop());
    if (bumped.has(f) || !isAppModule(f, st)) continue;
    bumped.add(f);
    st.versions.set(f, n);
    const importers = st.importers.get(f);
    if (importers) for (const i of importers) stack.push(i);
  }
  return bumped;
}
