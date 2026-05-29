/**
 * Lightweight module dependency graph.
 *
 * At startup, scans the app directory and builds an in-memory map of
 * `file → Set<imported files>`. The SSR pipeline queries this graph to
 * emit *complete* modulepreload hints: including transitive dependencies
 * of components: so the browser can fetch the entire tree in parallel
 * rather than discovering imports one waterfall at a time.
 *
 * The graph is file-path-based (absolute paths). URLs are derived when
 * emitting preload hints.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';

/** @type {RegExp} match static `import … from '…'` and `import '…'` */
const IMPORT_RE = /\bimport\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;

/**
 * @type {RegExp} match `export … from '…'` re-exports.
 * Examples:
 *   export * from './bar';
 *   export { x } from './bar';
 *   export { x as y } from './bar';
 *   export type { T } from './bar';
 *   export {
 *     a,
 *     b,
 *   } from './bar';     <-- multi-line, very common in real barrel files
 *
 * Barrel files are common (`lib/index.ts` re-exports its siblings),
 * and the graph must follow these edges or downstream consumers of
 * the barrel see authorisation 404s on the underlying files. The
 * gap class excludes quotes and `;` (so the lazy match cannot cross
 * a statement boundary) but DOES allow newlines, so multi-line
 * brace lists are caught.
 */
const EXPORT_FROM_RE = /\bexport\b[^'";]+?\sfrom\s+['"]([^'"]+)['"]/g;

/**
 * @typedef {Map<string, Set<string>>} ModuleGraph
 * A map of absolute file path → Set of absolute file paths it imports.
 */

/**
 * Build the module graph for all source files under `appDir`.
 *
 * @param {string} appDir
 * @returns {Promise<ModuleGraph>}
 */
export async function buildModuleGraph(appDir) {
  /** @type {ModuleGraph} */
  const graph = new Map();
  await walk(appDir, appDir, graph);
  return graph;
}

/**
 * Given a set of entry files, return all transitive dependencies (deduplicated).
 * Entry files themselves are NOT included (they're already preloaded by the
 * boot script).
 *
 * @param {ModuleGraph} graph
 * @param {string[]} entryFiles  absolute paths
 * @param {string} appDir
 * @returns {string[]}  absolute paths of transitive deps
 */
export function transitiveDeps(graph, entryFiles, appDir) {
  /** @type {Set<string>} */
  const visited = new Set(entryFiles);
  /** @type {string[]} */
  const result = [];
  /** @type {string[]} */
  const queue = [...entryFiles];

  while (queue.length) {
    const file = /** @type {string} */ (queue.shift());
    const deps = graph.get(file);
    if (!deps) continue;
    for (const dep of deps) {
      if (visited.has(dep)) continue;
      visited.add(dep);
      // Only include files within the app dir (skip node_modules, core, etc.)
      if (dep.startsWith(appDir)) {
        result.push(dep);
      }
      queue.push(dep);
    }
  }
  return result;
}

/** @type {RegExp} files the dev server NEVER serves as source: it
 * returns a stub instead. We stop graph traversal at these boundaries
 * because the browser never sees their transitive imports anyway. */
const SERVER_FILE_RE = /\.server\.m?[jt]s$/;

/**
 * Compute the set of files reachable from a set of browser-entry files.
 *
 * Same idea as Next.js's bundler-produced manifest: the static import
 * graph from each page / layout / error / loading / not-found / component
 * entry is the authoritative set of "files the browser may legitimately
 * fetch as ES modules". Anything outside this set is server-only or
 * unrelated and must not be served over HTTP.
 *
 * Result includes the entries themselves PLUS all transitive deps, all
 * restricted to absolute paths under `appDir`. Files outside `appDir`
 * (node_modules, @webjsdev/core, vendor URLs) are excluded; those have
 * their own routing layers (`/__webjs/core/*`, `/__webjs/vendor/*`).
 *
 * Traversal stops at `.server.{js,ts,mjs,mts}` files. They ARE in the
 * result (so a client import like `import { fn } from './x.server.ts'`
 * resolves to the RPC stub and the gate lets the request through), but
 * we do not walk INTO them. The browser only ever sees the RPC stub or
 * the throw-at-load stub for those files, so a non-server file imported
 * ONLY by a server file is never legitimately requested by the
 * browser and should stay out of the authorisation set. Matches
 * Next.js's behaviour, where the bundler emits server-component and
 * server-action code into separate chunks that the client bundle
 * never references.
 *
 * The dev server uses this as a runtime authorization gate before
 * serving any `.{js,mjs,ts,mts,css,svg,…}` URL: in-set → served (still
 * subject to the `.server.{js,ts}` stub guardrail), out-of-set → 404.
 *
 * @param {ModuleGraph} graph
 * @param {string[]} entryFiles absolute paths of browser-bound entries
 * @param {string} appDir
 * @returns {Set<string>}
 */
export function reachableFromEntries(graph, entryFiles, appDir) {
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {string[]} */
  const queue = [];
  for (const entry of entryFiles) {
    if (!entry || !entry.startsWith(appDir)) continue;
    visited.add(entry);
    queue.push(entry);
  }
  while (queue.length) {
    const file = /** @type {string} */ (queue.shift());
    // Stop at server-file boundaries. The file itself stays in the
    // visited set so its URL is servable (yields a stub at request
    // time), but we don't add its imports because the browser never
    // sees them.
    if (SERVER_FILE_RE.test(file)) continue;
    const deps = graph.get(file);
    if (!deps) continue;
    for (const dep of deps) {
      if (visited.has(dep)) continue;
      if (!dep.startsWith(appDir)) continue;
      visited.add(dep);
      queue.push(dep);
    }
  }
  return visited;
}

/**
 * Recursively walk a directory, parse imports, and populate the graph.
 * @param {string} dir
 * @param {string} appDir
 * @param {ModuleGraph} graph
 */
async function walk(dir, appDir, graph) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    // Skip filesystem locations the browser-bound graph never
    // touches: node_modules (huge, npm deps reach the browser via
    // the importmap, not direct fs paths), .webjs (framework cache),
    // public/ (served by a separate route with its own containment
    // check). Do NOT skip `_*` dirs: the `_private` / `_components`
    // / `_lib` convention is a ROUTER-ignore mechanism (router.js
    // line 100), but files inside are still importable by pages and
    // layouts, so the graph walker must enter them or the gate
    // 404s legitimate imports.
    if (e.name === 'node_modules' || e.name === '.webjs' || e.name === 'public') continue;
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, appDir, graph);
    } else if (/\.(js|ts|mjs|mts)$/.test(e.name)) {
      await parseFile(full, appDir, graph);
    }
  }
}

/**
 * Parse a single file's imports and add them to the graph.
 * Only resolves relative imports (bare specifiers are npm deps, not in the graph).
 *
 * @param {string} file
 * @param {string} appDir
 * @param {ModuleGraph} graph
 */
async function parseFile(file, appDir, graph) {
  let src;
  try { src = await readFile(file, 'utf8'); }
  catch { return; }

  const deps = new Set();
  for (const re of [IMPORT_RE, EXPORT_FROM_RE]) {
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      // Only resolve relative imports within the project.
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const resolved = resolveImport(spec, file, appDir);
      if (resolved) deps.add(resolved);
    }
  }
  if (deps.size) graph.set(file, deps);
}

/**
 * Resolve a relative import specifier to an absolute file path.
 * Handles: exact match, .ts/.js extension fallback, /index.ts fallback.
 *
 * @param {string} spec  e.g. `'../components/theme-toggle.ts'`
 * @param {string} fromFile  absolute path of the importing file
 * @param {string} appDir
 * @returns {string | null}
 */
export function resolveImport(spec, fromFile, appDir) {
  const base = dirname(fromFile);
  let target;
  if (spec.startsWith('/')) {
    // Absolute from app root (how browser sees it)
    target = join(appDir, spec);
  } else {
    target = resolve(base, spec);
  }
  // Sync exact-then-fallback resolution. The graph is advisory (it
  // drives preload hints, not module loading), so a wrong entry is
  // harmless: the browser just gets a redundant preload that 404s.
  // But emitting a working modulepreload when the user wrote
  // `import x from './foo'` (no extension) is much better than
  // leaving the resolver waterfall to discover it lazily, so probe
  // existsSync for the common fallbacks the JSDoc above promises.
  if (existsSync(target)) return target;
  if (!extname(target)) {
    for (const ext of ['.ts', '.js', '.mts', '.mjs']) {
      if (existsSync(target + ext)) return target + ext;
    }
    for (const ext of ['.ts', '.js']) {
      const indexed = join(target, 'index' + ext);
      if (existsSync(indexed)) return indexed;
    }
  }
  // `.js` import maps to a `.ts` sibling: TypeScript's "rewrite to
  // .js at runtime" convention. The browser asks for the `.js`
  // path; the dev server's source branch falls through to the
  // sibling. Mirror that here so the resolved path matches the
  // file actually on disk (and the authorization gate sees the
  // same path the request handler resolves to).
  if (/\.js$/.test(target)) {
    const tsAbs = target.replace(/\.js$/, '.ts');
    if (existsSync(tsAbs)) return tsAbs;
    const mtsAbs = target.replace(/\.js$/, '.mts');
    if (existsSync(mtsAbs)) return mtsAbs;
  }
  // Optimistic fallback: return the original resolution so the graph
  // still has an entry, even though the path may 404 on the browser.
  // Matches prior behavior.
  return target;
}
