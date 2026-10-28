import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { lookupModuleUrl, isLazy } from '@webjsdev/core';
import { transitiveDeps, bareImports } from '../module-graph.js';

/**
 * Working out which modules a page's HTML should preload, and which vendor
 * specifiers its importmap needs.
 *
 * Pure graph work: it takes the module graph plus the page's entry files and
 * returns URL lists. It touches no request, no response, and no rendering, so
 * it splits cleanly off the render path and is the reason `render.js` fits
 * under the size ceiling with room to spare.
 */

/**
 * @param {string} file
 * @param {string} appDir
 */
export function toUrlPath(file, appDir) {
  let rel = file.startsWith(appDir) ? file.slice(appDir.length) : file;
  return rel.split('\\').join('/').replace(/^\/?/, '/');
}

/**
 * Translate a Set of custom element tag names used on the page into browser
 * URLs for modulepreload. Components that didn't pass a module URL to
 * `register()` are skipped silently (no harm, just no preload hint).
 *
 * Returns separate eager and lazy lists. Lazy components (static lazy = true)
 * are NOT preloaded: they're loaded by the IntersectionObserver-based
 * lazy-loader when the element enters the viewport.
 *
 * Elidable (display-only) components are skipped entirely: their imports
 * are stripped from the served source, so preloading their module would
 * fetch JS the browser never executes.
 *
 * A tag counts as lazy when its class says so at runtime (`isLazy`) OR its
 * file declares `static lazy = true` in source (`lazyFiles`, #1524), the same
 * per-file verdict the served-source rewrite uses, so the two never disagree.
 *
 * @param {Set<string>} usedTags
 * @param {string} appDir
 * @param {Set<string>} [elidable]  absolute paths of elidable component files
 * @param {Map<string, string[]>} [lazyFiles]  lazy component file -> its tags
 * @returns {{ eager: string[], lazy: Record<string, string> }}
 */
export function componentPreloads(usedTags, appDir, elidable, lazyFiles) {
  const eager = [];
  /** @type {Record<string, string>} */
  const lazy = {};
  for (const tag of usedTags) {
    const fileUrl = lookupModuleUrl(tag);
    if (!fileUrl) continue;
    try {
      const abs = fileURLToPath(fileUrl);
      if (!abs.startsWith(appDir)) continue;
      if (elidable && elidable.has(abs)) continue;
      const url = toUrlPath(abs, appDir);
      if (isLazy(tag) || (lazyFiles && lazyFiles.has(abs))) {
        lazy[tag] = url;
      } else {
        eager.push(url);
      }
    } catch { /* ignore */ }
  }
  return { eager, lazy };
}

/**
 * Merge component preloads with transitive dependencies from the module
 * graph, then deduplicate against the already-imported module URLs.
 *
 * The walk ROOTS (`entryFiles`) are the boot's actually-SHIPPED page/layout
 * module set (the caller passes the absolute paths of `moduleUrls`, which
 * already drops an inert page/layout and substitutes an import-only page with
 * its components), NOT the raw `[route.file, ...route.layouts]` route entries.
 * This matches `reachedVendorSpecifiers`' roots so the two walks stay
 * consistent. Rooting at the shipped set means a module reached ONLY through a
 * dropped page/layout (its SSR-only direct app import OR its SSR-only relative
 * helper) is never a walk root's dep, so it gets no `modulepreload` hint (no
 * over-fetch, #780). A module that also ships some other way (a component shared
 * with a live route, or reached via an import-only page's substituted
 * components) is still reached through a real shipped root, so its hint stays
 * (no under-fetch). `seen = new Set(moduleUrls)` already excludes the shipped
 * modules' own URLs; the shipped-roots change closes the TRANSITIVE gap.
 *
 * @param {string[]} componentUrls  direct component module URLs
 * @param {string[]} moduleUrls     boot script imports (page + layouts)
 * @param {import('../module-graph.js').ModuleGraph | undefined} graph
 * @param {string[]} entryFiles     absolute paths of the SHIPPED page/layout modules (from `moduleUrls`)
 * @param {string} appDir
 * @param {Set<string>} [elidableComponents]  absolute paths to skip in the walk
 * @param {Set<string>} [serverFiles]  the action / server-file index, never preloaded
 * @param {string[]} [precomputedDeps]  the transitive closure `pagePreloadHints` already walked for
 *   THESE roots and THIS skip set. Omitted, the walk runs here (a direct caller)
 * @returns {string[]}
 */
export function deduplicatedPreloads(componentUrls, moduleUrls, graph, entryFiles, appDir, serverFiles, elidableComponents, precomputedDeps) {
  const seen = new Set(moduleUrls);
  const result = [];

  // Server-only modules are never useful to preload: they're imported by
  // pages/layouts on the server, or surfaced to client components as
  // generated RPC stubs that load lazily on first call. Preloading them
  // wastes a roundtrip and pollutes the network tab with server-named files.
  //
  // Detection is belt-and-suspenders: filename suffix catches `.server.*`;
  // the `serverFiles` set (built from the action index) also catches files
  // that opted in via `'use server'` directive without the suffix.
  const byName = (url) => /\.server\.m?[jt]s$/.test(url);
  const byIndex = serverFiles
    ? (abs) => (serverFiles.has ? serverFiles.has(abs) : false)
    : () => false;

  // Add direct component URLs
  for (const url of componentUrls) {
    if (seen.has(url) || byName(url)) continue;
    seen.add(url);
    result.push(url);
  }

  // Add transitive deps from the module graph
  if (graph) {
    // `precomputedDeps` is the closure `pagePreloadHints` already walked for
    // this render (#1644); without it (a direct caller) walk it here.
    let deps = precomputedDeps;
    if (!deps) {
      // Combine entry files + component files for graph lookup
      const allEntries = [...entryFiles];
      for (const url of componentUrls) {
        // Convert URL back to absolute path for graph lookup
        const abs = resolve(appDir, url.startsWith('/') ? url.slice(1) : url);
        allEntries.push(abs);
      }
      // Skip elidable components and any subtree reachable only through
      // them: their imports are stripped from served source, so the
      // browser never fetches these modules.
      deps = transitiveDeps(graph, allEntries, appDir, elidableComponents);
    }
    for (const dep of deps) {
      if (byIndex(dep)) continue;
      const url = toUrlPath(dep, appDir);
      if (seen.has(url) || byName(url)) continue;
      seen.add(url);
      result.push(url);
    }
  }

  return result;
}

/**
 * Collect the bare npm vendor specifiers the page's SHIPPED modules import
 * (#754). The walk ROOTS are the boot's actually-shipped module set: the caller
 * passes `entryFiles` = the absolute paths of `moduleUrls` (which already drops
 * inert page/layout modules and substitutes an import-only page with its
 * components), plus `componentUrls` = the rendered components. From those roots
 * it walks the transitive app-graph closure (elidable components and the subtree
 * reachable only through them excluded), and collects each reached file's bare
 * imports, excluding server files. The specifiers are resolved to `modulepreload`
 * targets via the vendor importmap; a specifier not in the map (unpinned /
 * unreached) drops out there.
 *
 * Because the roots are the SHIPPED set, a vendor reached ONLY through a module
 * dropped from the boot, whether a dropped page's SSR-only DIRECT vendor import
 * or its SSR-only RELATIVE HELPER's vendor, is never collected: the dropped
 * module is not a root, and nothing that ships imports it (pages/layouts are not
 * importable). So the canonical SSR-only-dependency pattern (which elision keeps
 * off the client) is never preloaded (no over-fetch).
 *
 * @param {import('../module-graph.js').ModuleGraph | undefined} graph
 * @param {string[]} entryFiles  absolute paths of the SHIPPED page/layout modules (from `moduleUrls`)
 * @param {string[]} componentUrls  rendered eager component URL paths
 * @param {string} appDir
 * @param {Set<string>} [elidableComponents]
 * @param {Set<string>} [serverFiles]  the action / server-file index (`'use server'`, incl. no-`.server.` files)
 * @param {string[]} [precomputedDeps]  the transitive closure `pagePreloadHints` already walked for
 *   THESE roots and THIS skip set. Omitted, the walk runs here (a direct caller)
 * @returns {Set<string>}
 */
export function reachedVendorSpecifiers(graph, entryFiles, componentUrls, appDir, elidableComponents, serverFiles, precomputedDeps) {
  /** @type {Set<string>} */
  const specs = new Set();
  if (!graph) return specs;
  const bare = bareImports(graph);
  if (!bare.size) return specs;
  // Roots = the SHIPPED page/layout modules (already inert-dropped + import-only
  // expanded by the caller) + the rendered components, keyed by the graph's own
  // absolute paths. Walk their non-elided transitive closure, unless
  // `pagePreloadHints` already walked it for this render (#1644).
  const allEntries = [...entryFiles];
  for (const url of componentUrls) {
    allEntries.push(resolve(appDir, url.startsWith('/') ? url.slice(1) : url));
  }
  const files = new Set(allEntries);
  for (const dep of precomputedDeps || transitiveDeps(graph, allEntries, appDir, elidableComponents)) files.add(dep);
  for (const file of files) {
    // A server file is never served to the browser (its source is an RPC /
    // throw-at-load stub), so a vendor it imports never ships and must NOT be
    // preloaded. `transitiveDeps` stops AT a server-file boundary but still
    // returns the boundary file itself, so filter it: the `.server.*` suffix
    // AND the action index (a `'use server'` file without the suffix), matching
    // `deduplicatedPreloads`' `byIndex` filter.
    if (/\.server\.m?[jt]s$/.test(file)) continue;
    if (serverFiles && serverFiles.has && serverFiles.has(file)) continue;
    const fileBare = bare.get(file);
    if (fileBare) for (const spec of fileBare) specs.add(spec);
  }
  return specs;
}

/**
 * The skip set for the preload walks: the elidable components plus, when the
 * app has `static lazy` components (#1524), every lazy file. Built once per
 * lazy map (a per-build object), since it was rebuilt per render (#1644).
 * @type {WeakMap<Map<string, string[]>, WeakMap<Set<string>, Set<string>>>}
 */
const SKIP_MEMO = new WeakMap();
const NO_ELIDABLE = new Set();

/**
 * @param {Set<string> | undefined} elidable
 * @param {Map<string, string[]> | undefined} lazyFiles
 * @returns {Set<string> | undefined}
 */
function preloadSkipSet(elidable, lazyFiles) {
  if (!lazyFiles || !lazyFiles.size) return elidable;
  const key = elidable || NO_ELIDABLE;
  let byElidable = SKIP_MEMO.get(lazyFiles);
  if (!byElidable) { byElidable = new WeakMap(); SKIP_MEMO.set(lazyFiles, byElidable); }
  let skip = byElidable.get(key);
  if (!skip) {
    skip = new Set([...(elidable || []), ...lazyFiles.keys()]);
    byElidable.set(key, skip);
  }
  return skip;
}

/**
 * The page's preload hints in ONE graph walk (#1644). The app-module preload
 * pass (`deduplicatedPreloads`) and the vendor pass
 * (`reachedVendorSpecifiers`) root at the same shipped set with the same skip
 * set, so they used to walk the identical closure twice per render. This
 * walks it once and hands the closure to both.
 *
 * The walk roots are the BOOT's actually-shipped module set (`moduleUrls`,
 * inert modules already dropped and an import-only page already substituted)
 * plus the rendered eager components, NOT the raw route entries: rooting at
 * the raw entries would walk a dropped page's SSR-only subtree and hint a
 * `modulepreload` for a module nothing that ships imports (#780, the
 * app-module analog of the #754 vendor over-fetch).
 *
 * @param {{
 *   graph: import('../module-graph.js').ModuleGraph | undefined,
 *   appDir: string,
 *   moduleUrls: string[],
 *   eagerComponents: string[],
 *   elidableComponents: Set<string> | undefined,
 *   lazyFiles: Map<string, string[]> | undefined,
 *   serverFiles: Set<string> | undefined,
 * }} input
 * @returns {{ preloads: string[], vendorSpecifiers: Set<string>, skip: Set<string> | undefined }}
 */
export function pagePreloadHints(input) {
  const { graph, appDir, moduleUrls, eagerComponents, elidableComponents, lazyFiles, serverFiles } = input;
  const skip = preloadSkipSet(elidableComponents, lazyFiles);
  const shippedRoots = moduleUrls.map((u) => resolve(appDir, u.startsWith('/') ? u.slice(1) : u));
  /** @type {string[] | undefined} */
  let deps;
  if (graph) {
    const allEntries = [...shippedRoots];
    for (const url of eagerComponents) allEntries.push(resolve(appDir, url.startsWith('/') ? url.slice(1) : url));
    deps = transitiveDeps(graph, allEntries, appDir, skip);
  }
  const preloads = deduplicatedPreloads(eagerComponents, moduleUrls, graph, shippedRoots, appDir, serverFiles, skip, deps);
  const vendorSpecifiers = reachedVendorSpecifiers(graph, shippedRoots, eagerComponents, appDir, skip, serverFiles, deps);
  return { preloads, vendorSpecifiers, skip };
}
