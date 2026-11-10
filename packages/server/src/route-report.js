/**
 * What each route costs the browser (#1686).
 *
 * A page, layout or boundary never ships; the boot loads the components it
 * renders, its frontier (`route-frontier.js`). This report runs the same walk
 * the dev server runs and projects it into a sorted, app-relative,
 * JSON-serializable object:
 *
 *   - `routeModules`: every page, layout and boundary with its kind, the
 *     component modules the boot imports in its place (`emits`, empty means
 *     the route loads no JavaScript), and `hints`: code in it that looks meant
 *     for the browser but runs only on the server (`routeModuleBrowserHints`).
 *   - `orphans`: a `class X extends WebComponent` with no literal-tag
 *     registration, either because there is no registration call or because
 *     the tag is computed. The scanner never sees it (invariant 3 requires a
 *     literal tag), so it is never booted and never upgrades unless something
 *     that ships imports it.
 *
 * Consumed by `webjs doctor` (`ROUTE_BROWSER_CODE` and `ORPHAN_COMPONENTS`,
 * which share ONE call so the module graph is built once per run). Advisory
 * only: it never fails anything.
 *
 * Nothing is cached here. Every out-of-process consumer runs the analysis once
 * and exits, so a cache would never hit and would only add a staleness bug.
 */
import { readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { buildModuleGraph } from './module-graph.js';
import { scanComponents, findOrphanComponents } from './component-scanner.js';
import { buildRouteTable } from './router.js';
import { routeModuleBrowserHints } from './client-signals.js';
import { routeFrontiers, routeModuleKinds, leadsToComponent } from './route-frontier.js';

/**
 * @typedef {'page'|'layout'|'error'|'loading'|'not-found'|'forbidden'|'unauthorized'|'global-not-found'} RouteModuleKind
 * @typedef {{ file: string, kind: RouteModuleKind, emits: string[], hints: string[] }} RouteModuleRow
 * @typedef {{ file: string, className: string }} OrphanRow
 * @typedef {{ routeModules: number, zeroJs: number, carriers: number, orphans: number }} RouteReportSummary
 * @typedef {{ analysed: boolean, skipped: 'no-app'|'unanalysable'|null, routeModules: RouteModuleRow[], orphans: OrphanRow[], summary: RouteReportSummary }} RouteReport
 */

/**
 * @param {string} appDir
 * @returns {Promise<RouteReport>}
 */
export async function analyzeRouteModules(appDir) {
  // Every path the analysis compares is absolute, so a relative app dir would
  // match nothing and report empty frontiers.
  appDir = resolve(appDir);
  // No `app/` means this is not a routable app (a bare component library, a
  // lib-only fixture); there is nothing to report on.
  if (!(await pathExists(join(appDir, 'app')))) return empty('no-app');

  let moduleGraph, components, routeTable, orphans;
  try {
    moduleGraph = await buildModuleGraph(appDir);
    components = await scanComponents(appDir);
    routeTable = await buildRouteTable(appDir);
    orphans = await findOrphanComponents(appDir);
  } catch {
    // A malformed app the analysis cannot process degrades to no report (the
    // dev server and `webjs check` surface the real problem).
    return empty('unanalysable');
  }

  const rel = (/** @type {string} */ f) => relative(appDir, f) || f;
  const byFile = (/** @type {{ file: string }} */ a, /** @type {{ file: string }} */ b) => a.file.localeCompare(b.file);

  // The same frontier walk the dev server runs, so `emits` is exactly what the
  // boot imports in each route module's place.
  const kinds = routeModuleKinds(routeTable);
  const routeFiles = new Set(kinds.keys());
  const componentFileSet = new Set(components.map((c) => c.file));
  const frontiers = routeFrontiers([...routeFiles], moduleGraph, componentFileSet, routeFiles);
  const carriesComponent = leadsToComponent(moduleGraph, componentFileSet);
  /** @type {RouteModuleRow[]} */
  const routeRows = [];
  for (const [f, kind] of kinds) {
    /** @type {string[]} */
    let hints = [];
    try {
      hints = routeModuleBrowserHints(await readFile(f, 'utf8'), {
        file: f, appDir, isComponent: (abs) => componentFileSet.has(abs), carriesComponent,
      });
    } catch { /* unreadable: no advice */ }
    routeRows.push({
      file: rel(f),
      kind,
      emits: (frontiers.get(f) || []).map(rel).sort(),
      hints,
    });
  }
  routeRows.sort(byFile);

  /** @type {OrphanRow[]} */
  const orphanRows = orphans
    .map((o) => ({ file: rel(o.file), className: o.className }))
    .sort((a, b) => byFile(a, b) || a.className.localeCompare(b.className));

  return {
    analysed: true, skipped: null,
    routeModules: routeRows, orphans: orphanRows,
    summary: {
      routeModules: routeRows.length,
      zeroJs: routeRows.filter((r) => r.emits.length === 0).length,
      carriers: routeRows.filter((r) => r.emits.length > 0).length,
      orphans: orphanRows.length,
    },
  };
}

/**
 * The empty report, naming WHY nothing was analysed so a machine consumer can
 * tell "this is not an app" from "the analysis could not run".
 * @param {'no-app'|'unanalysable'} skipped
 * @returns {RouteReport}
 */
function empty(skipped) {
  return {
    analysed: false, skipped,
    routeModules: [], orphans: [],
    summary: { routeModules: 0, zeroJs: 0, carriers: 0, orphans: 0 },
  };
}

/** @param {string} p @returns {Promise<boolean>} */
async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}
