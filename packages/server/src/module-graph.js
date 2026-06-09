/**
 * Lightweight module dependency graph.
 *
 * On the first request (lazily, via `ensureReady`), scans the app directory and builds an in-memory map of
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
import { join, resolve, dirname, extname, sep } from 'node:path';
import { redactStringsAndTemplates } from './js-scan.js';

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
  /** @type {Set<string>} every file walked this build (graph holds only files
   * with deps, so a separate set is needed to know what is still live). */
  const seen = new Set();
  await walk(appDir, appDir, graph, seen);
  // Evict parse-cache entries for files no longer in the tree (a rebuild after
  // a rename or delete), so a long dev session does not accumulate dead
  // entries. Scoped to appDir so a multi-app process (tests, dogfood smoke)
  // keeps other apps' entries.
  const prefix = appDir.endsWith(sep) ? appDir : appDir + sep;
  for (const key of PARSE_CACHE.keys()) {
    if ((key === appDir || key.startsWith(prefix)) && !seen.has(key)) PARSE_CACHE.delete(key);
  }
  return graph;
}

/**
 * Given a set of entry files, return all transitive dependencies (deduplicated).
 * Entry files themselves are NOT included (they're already preloaded by the
 * boot script).
 *
 * `skip` files are neither included nor traversed into: used to prune
 * display-only components (and the subtree reachable only through them)
 * from preload hints, since their imports are stripped from the served
 * source and the browser never fetches them.
 *
 * @param {ModuleGraph} graph
 * @param {string[]} entryFiles  absolute paths
 * @param {string} appDir
 * @param {Set<string>} [skip]  absolute paths to exclude and not traverse
 * @returns {string[]}  absolute paths of transitive deps
 */
export function transitiveDeps(graph, entryFiles, appDir, skip) {
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
      if (skip && skip.has(dep)) continue;
      visited.add(dep);
      // Only include files within the app dir (skip node_modules, core, etc.)
      if (dep.startsWith(appDir)) {
        result.push(dep);
      }
      // Stop at server-file boundaries, exactly like reachableFromEntries
      // (the authorization gate). The browser fetches a `.server.*` URL as
      // an RPC or throw-at-load stub, never its source, so the server
      // file's own imports are never fetched. Following them would emit
      // modulepreload hints for server-only modules that the gate then
      // 404s (a preload set wider than the servable set). The `.server.*`
      // file itself stays in the result; the preload emitter filters it via
      // the server-file index. A file imported through BOTH a server file
      // and a real client path is still reached via the client path, so it
      // is not wrongly dropped.
      if (SERVER_FILE_RE.test(dep)) continue;
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
async function walk(dir, appDir, graph, seen) {
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
      await walk(full, appDir, graph, seen);
    } else if (/\.(js|ts|mjs|mts)$/.test(e.name)) {
      await parseFile(full, appDir, graph, seen);
    }
  }
}

/**
 * mtime-keyed parse cache so a rebuild re-reads only files that actually
 * changed. `buildModuleGraph` re-walks the (cheap) directory tree on every
 * rebuild, but reading + regex-parsing each file is the cost; on an unchanged
 * file the cached import set is reused after a single `stat`. This makes
 * rebuilds incremental for large apps without restructuring the caller.
 * Keyed by mtime AND size: a same-tick edit that also changes the file length
 * is caught even on coarse-resolution filesystems where mtime alone could miss.
 * @type {Map<string, { mtimeMs: number, size: number, deps: Set<string> }>}
 */
const PARSE_CACHE = new Map();

/** Introspection for tests/ops: is `file` currently in the parse cache? */
export function _parseCacheHas(file) { return PARSE_CACHE.has(file); }

/**
 * Parse a single file's imports and add them to the graph.
 * Only resolves relative imports (bare specifiers are npm deps, not in the graph).
 *
 * @param {string} file
 * @param {string} appDir
 * @param {ModuleGraph} graph
 */
async function parseFile(file, appDir, graph, seen) {
  let mtimeMs, size;
  try { const st = await stat(file); mtimeMs = st.mtimeMs; size = st.size; }
  catch { return; }
  seen?.add(file); // mark live (both cache-hit and miss paths) for cache eviction
  const cached = PARSE_CACHE.get(file);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
    if (cached.deps.size) graph.set(file, cached.deps);
    return;
  }

  let src;
  try { src = await readFile(file, 'utf8'); }
  catch { return; }

  // Mask of `src` with all string / template-literal / comment / regex
  // CONTENT blanked to spaces (positions preserved). Used to reject an
  // `import '…'` / `export … from '…'` that appears as TEXT inside a
  // literal (e.g. example code shown in a `<pre>` inside an `html\`\``
  // template, as the docs site does, OR a code-example written as a plain
  // quoted string) rather than as a real statement. We still read the
  // specifier from the RAW `src` (the specifier is itself a string,
  // blanked in the mask), and only consult the mask to confirm the
  // `import` / `export` KEYWORD survived redaction, i.e. sits in code
  // position and not inside a literal.
  //
  // `blankStrings: true` is load-bearing: the default mask keeps PLAIN
  // string + verbatim-template bodies verbatim (so `register('tag')` stays
  // readable for other scanners), which would leave an `import` written
  // inside a plain string looking like a real keyword and create a phantom
  // graph edge to whatever path that string names. Since this caller only
  // checks keyword-in-code-position, blank every literal body so a
  // code-example `import` string never becomes an edge.
  const masked = redactStringsAndTemplates(src, true);
  const deps = new Set();
  for (const re of [IMPORT_RE, EXPORT_FROM_RE]) {
    for (const m of src.matchAll(re)) {
      // m.index is the keyword start (`\bimport` / `\bexport`). If that
      // position is blanked in the mask, the match lives inside a literal
      // and is not a real import edge.
      if (masked[m.index] === ' ') continue;
      const spec = m[1];
      // Only resolve relative imports within the project.
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const resolved = resolveImport(spec, file, appDir);
      if (resolved) deps.add(resolved);
    }
  }
  PARSE_CACHE.set(file, { mtimeMs, size, deps });
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
