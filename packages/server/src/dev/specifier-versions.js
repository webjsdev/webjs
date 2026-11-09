/**
 * Browser module versions for `webjs dev` (#1689), runtime-neutral.
 *
 * A browser keeps one module instance per URL for the life of the page, so a
 * re-imported module whose own URL is unchanged comes back as the old instance,
 * and so does every module it imports. To hand a tab the edited code without a
 * reload, a rebuild bumps each changed file the browser holds AND every module
 * that imports it (transitively, through the shipped graph), and the server
 * rewrites the import specifiers of every served app module so an import of a
 * bumped file carries `?t=<n>` (`&t=<n>` when the specifier already has a
 * query), the technique the Remix asset server uses. A re-import of a bumped
 * boundary then walks a fresh URL chain down to the edited file, while every
 * module nothing changed under keeps its bare URL and therefore its original
 * instance, which is what keeps `@webjsdev/core` (a bare specifier, never
 * versioned) and every module-scope signal one instance.
 *
 * The map is separate from the server's (`esm-hot-hooks.js`) because Bun has no
 * resolve hook and the browser's module map is separate anyway. It lives on the
 * handler's state and is never cleared on a rebuild.
 */

import { dynamicEdges, expandImportAlias, importSpecifierRanges, resolveImport } from '../module-graph.js';

/**
 * @typedef {{
 *   bump: (changed: Iterable<string>, graph: Map<string, Set<string>> | null, shipped: Set<string>) => Set<string>,
 *   versionOf: (abs: string) => number,
 *   clear: () => void,
 * }} BrowserVersions
 */

/** @returns {BrowserVersions} */
export function createBrowserVersions() {
  /** @type {Map<string, number>} */
  const versions = new Map();
  let next = 0;
  return {
    // Give each changed file the browser holds and every shipped module that
    // imports it (statically or through a string-literal dynamic import) ONE
    // new version. A changed file outside `shipped` is skipped, since the
    // browser holds no instance of it. Returns the files that moved.
    bump(changed, graph, shipped) {
      /** @type {Set<string>} */
      const reached = new Set();
      if (!graph) return reached;
      /** @type {Map<string, Set<string>>} */
      const importers = new Map();
      const addEdges = (/** @type {Map<string, Set<string>>} */ edges) => {
        for (const [from, tos] of edges) {
          if (!shipped.has(from)) continue;
          for (const to of tos) {
            let set = importers.get(to);
            if (!set) importers.set(to, (set = new Set()));
            set.add(from);
          }
        }
      };
      addEdges(graph);
      addEdges(dynamicEdges(graph));
      const stack = [];
      for (const f of changed) if (shipped.has(f)) stack.push(f);
      while (stack.length) {
        const f = /** @type {string} */ (stack.pop());
        if (reached.has(f)) continue;
        reached.add(f);
        for (const imp of importers.get(f) || []) if (!reached.has(imp)) stack.push(imp);
      }
      if (reached.size) {
        next++;
        for (const f of reached) versions.set(f, next);
      }
      return reached;
    },
    versionOf(abs) {
      return versions.get(abs) || 0;
    },
    clear() {
      versions.clear();
    },
  };
}

/**
 * Append `t=<version>` to every import specifier in `code` that resolves to an
 * app file with a version above 0. Static imports, `export … from` and
 * string-literal dynamic imports are rewritten; a type-only clause, a
 * specifier written inside a string, template or comment, and a bare specifier
 * are left alone. Returns `code` itself when nothing applies.
 *
 * @param {string} code a served module's source (after type stripping)
 * @param {string} importerAbs the module's absolute path
 * @param {string} appDir
 * @param {(abs: string) => number} versionOf
 * @returns {string}
 */
export function versionImportSpecifiers(code, importerAbs, appDir, versionOf) {
  /** @type {Array<{ end: number, add: string }>} */
  const edits = [];
  const seen = new Set();
  for (const { start, end, spec } of importSpecifierRanges(code)) {
    if (seen.has(start)) continue;
    seen.add(start);
    if (!spec.startsWith('.') && !spec.startsWith('/') && !expandImportAlias(spec, appDir)) continue;
    const resolved = resolveImport(spec, importerAbs, appDir);
    if (!resolved) continue;
    const n = versionOf(resolved);
    if (n > 0) edits.push({ end, add: (spec.includes('?') ? '&' : '?') + 't=' + n });
  }
  if (!edits.length) return code;
  edits.sort((a, b) => b.end - a.end);
  let out = code;
  for (const { end, add } of edits) out = out.slice(0, end) + add + out.slice(end);
  return out;
}
