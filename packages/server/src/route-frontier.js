/**
 * Route modules never ship to the browser (#1686, Plan v2 workstream 1).
 *
 * A page, layout or boundary module (error, not-found, forbidden, unauthorized,
 * global-not-found, loading) runs ONLY on the server, the way a Next.js server
 * component does. Nothing in the browser ever read a page export: the boot
 * script is a list of bare `import "<url>"` lines and the client router never
 * imports a route module. So the boot imports each route module's component
 * FRONTIER instead: the shipping components reachable from it on a path that
 * does not pass through another component (a component's own subtree loads
 * with it).
 *
 * This replaced a lexical guess about whether a page did "client work" at
 * module scope, which decided whether the page itself shipped. The guess had
 * false positives (`new Intl.DateTimeFormat()`, `Array.from(...)`, a class-name
 * helper call at module scope), and a page wrongly judged to ship had its
 * server-only import refused by `no-server-import-in-browser-module`. With no
 * route module ever shipping, there is nothing to guess.
 *
 * Pure and graph-only: it reads no file.
 *
 * @module
 */

const SERVER_FILE_RE = /\.server\.m?[jt]s$/;

/**
 * The component frontier of every route module.
 *
 * @param {Iterable<string>} routeFiles  absolute route-module paths (`collectBootRouteModules`)
 * @param {Map<string, Set<string>>} moduleGraph  file -> its static imports
 * @param {Set<string>} componentFiles  every registered component's file
 * @param {Set<string>} skip  files that never load in the browser: elided display-only components and server files
 * @returns {Map<string, string[]>}  route file -> component files to import in its place (possibly empty)
 */
export function routeFrontiers(routeFiles, moduleGraph, componentFiles, skip) {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (const file of routeFiles) {
    /** @type {string[]} */
    const frontier = [];
    const visited = new Set([file]);
    const queue = [file];
    while (queue.length) {
      const cur = /** @type {string} */ (queue.shift());
      const deps = moduleGraph.get(cur);
      if (!deps) continue;
      for (const dep of deps) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        // An elided component never loads; a `.server.*` module is a stub in the
        // browser, so nothing behind it can load either (inside or outside appDir).
        if (skip.has(dep) || SERVER_FILE_RE.test(dep)) continue;
        // A component is imported in the route module's place, and its own
        // subtree loads with it, so the walk stops there.
        if (componentFiles.has(dep)) { frontier.push(dep); continue; }
        // Anything else (a helper, a barrel, core) is only a carrier on the way
        // to components: walked, never emitted.
        queue.push(dep);
      }
    }
    out.set(file, frontier);
  }
  return out;
}

/**
 * Every route module the client boot could be asked to stand in for, with its
 * kind: pages, layouts and every boundary (error, loading, not-found,
 * forbidden, unauthorized, global-not-found). None of them ships; each is
 * replaced in the boot by its component frontier. `global-error` is left out:
 * it renders its own document with no boot script.
 *
 * Route-ness comes from the route table, never from a file name (a plain
 * helper may be called `page.ts`). A file used as more than one kind keeps
 * the first kind found, pages first.
 *
 * @param {any} routeTable  the router's table (`buildRouteTable`)
 * @returns {Map<string, 'page'|'layout'|'error'|'loading'|'not-found'|'forbidden'|'unauthorized'|'global-not-found'>}
 */
export function routeModuleKinds(routeTable) {
  /** @type {Map<string, any>} */
  const kinds = new Map();
  const add = (/** @type {string|undefined} */ f, /** @type {string} */ kind) => { if (f && !kinds.has(f)) kinds.set(f, kind); };
  const pages = routeTable.pages || [];
  for (const page of pages) add(page.file, 'page');
  for (const [key, kind] of /** @type {const} */ ([
    ['layouts', 'layout'], ['errors', 'error'], ['loadings', 'loading'], ['notFounds', 'not-found'],
    ['forbiddens', 'forbidden'], ['unauthorizeds', 'unauthorized'],
  ])) {
    for (const page of pages) for (const f of page[key] || []) add(f, kind);
  }
  add(routeTable.notFound, 'not-found');
  if (routeTable.notFounds) for (const f of routeTable.notFounds.values()) add(f, 'not-found');
  add(routeTable.globalNotFound, 'global-not-found');
  return kinds;
}

/**
 * The route modules `routeModuleKinds` lists, as an array.
 * @param {any} routeTable
 * @returns {string[]}
 */
export function collectBootRouteModules(routeTable) {
  return [...routeModuleKinds(routeTable).keys()];
}
