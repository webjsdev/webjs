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
 * `devImport` stays content-keyed, so an idle tab adds nothing.
 *
 * Bun has no resolve hook, so there the same state is filled and read by the
 * dev source plugins instead (`installBunModuleVersions`): every app module
 * Bun loads in dev goes through a `Bun.plugin` `onLoad`, which records the
 * module's import edges from its source and rewrites the specifier of a bumped
 * target to its absolute path plus `?webjs-v=<n>` (`bun-app-source.js`), and
 * `devImportSpecifier` adds the version to an entry. Bun keys a plain path's
 * module by the query too, so the result is the same as on Node: the edited
 * chain evaluates fresh and an untouched module keeps its instance, with no
 * `bun --hot` registry reset. A runtime with neither keeps the dev supervisor's
 * restart.
 */
import * as nodeModule from 'node:module';
import { realpathSync, statSync } from 'node:fs';
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
 *   loaded?: Map<string, string>,
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

/**
 * Turn on module versions for an app root on Bun, where the dev source plugins
 * record the edges and stamp the versions (`bun-app-source.js`) because there
 * is no resolve hook. Idempotent. Returns false, doing nothing, off Bun.
 * @param {string} appDir  absolute app root
 * @returns {boolean}
 */
export function installBunModuleVersions(appDir) {
  if (!process.versions.bun) return false;
  const st = state();
  st.roots.add(appDir);
  st.installed = true;
  if (!st.loaded) st.loaded = new Map();
  return true;
}

/** A file's identity on disk, or '' when it is gone. @param {string} abs */
function diskStamp(abs) {
  try {
    const s = statSync(abs);
    return `${s.ino}:${s.size}:${s.mtimeMs}`;
  } catch {
    return '';
  }
}

/**
 * Note that the Bun source plugins just served `abs` as it is on disk now.
 * A rebuild compares every noted file against the disk (`bumpModuleVersions`),
 * because Bun's `fs.watch` (1.3.14) drops the event for a second file written
 * a few milliseconds after another in the same directory, so an agent saving
 * two files at once would otherwise leave the second one stale for good. The
 * `bun --hot` registry reset used to hide that, since it re-evaluated
 * everything. A no-op where module versions are off or not on Bun.
 * @param {string} abs
 */
export function recordModuleLoad(abs) {
  const st = state();
  if (st.loaded && isAppModule(abs, st)) st.loaded.set(abs, diskStamp(abs));
}

/**
 * Record that `importer` imports `target`, the edge a bump walks up. Only an
 * edge between two app modules is kept. The Bun source plugins call this for
 * each import specifier of a module they serve.
 * @param {string} importer  absolute path
 * @param {string} target  absolute path
 */
export function recordModuleImport(importer, target) {
  const st = state();
  if (!st.installed || importer === target || !isAppModule(importer, st) || !isAppModule(target, st)) return;
  let set = st.importers.get(target);
  if (!set) st.importers.set(target, (set = new Set()));
  set.add(importer);
}

/**
 * Whether an absolute path is a module this process versions in place: module
 * versions are on and the path is an app module under a registered root.
 * @param {string} abs
 * @returns {boolean}
 */
export function isVersionedModule(abs) {
  const st = state();
  return st.installed && isAppModule(abs, st);
}

/** Whether module versions are on in this process (the Node resolve hook, or Bun's source plugins). @returns {boolean} */
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
  // On Bun, also every served module that changed on disk without an event
  // reaching the watcher (see `recordModuleLoad`).
  if (st.loaded) {
    for (const [f, stamp] of st.loaded) {
      const now = diskStamp(f);
      if (now !== stamp) { st.loaded.set(f, now); stack.push(f); }
    }
  }
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
