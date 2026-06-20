/**
 * App-level elision report (#646).
 *
 * A reporting layer over the `analyzeElision` verdict, NOT a second analysis
 * and NOT a build (webjs is no-build; elision is the server's analysis pass,
 * run at dev-server start and re-derived after each fs.watch rebuild). It
 * builds the module graph, runs `analyzeElision`, and returns the page / layout
 * route modules that SHIP WHOLE to the browser, each with the first
 * client-effecting blocker that pins it (or its own signal when the module
 * itself is the cause).
 *
 * Consumed by `webjs doctor` to ADVISE why a page/layout is not elided (an
 * import-only #605 / inert #179 carrier stays out of the browser; a module that
 * ships whole does not). Advisory only: a page legitimately MAY ship, and the
 * analyser is biased toward shipping by design (server AGENTS invariant 7), so
 * this never fails anything.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { buildModuleGraph } from './module-graph.js';
import { scanComponents } from './component-scanner.js';
import { buildRouteTable } from './router.js';
import { analyzeElision } from './component-elision.js';

/**
 * @param {string} appDir
 * @returns {Promise<{ analysed: boolean, shipped: Array<{ file: string, blocker: string|null, reason: string }> }>}
 */
export async function analyzeAppElision(appDir) {
  // No `app/` means this is not a routable app (a bare component library, a
  // lib-only fixture); nothing ships, so there is nothing to advise on.
  if (!(await pathExists(join(appDir, 'app')))) return { analysed: false, shipped: [] };
  // Elision off (opt-out) ships everything by design, so the advisory is moot.
  if (!(await readElideEnabled(appDir))) return { analysed: false, shipped: [] };

  let moduleGraph, components, routeTable;
  try {
    moduleGraph = await buildModuleGraph(appDir);
    components = await scanComponents(appDir);
    routeTable = await buildRouteTable(appDir);
  } catch {
    // A malformed app the analysis cannot process degrades to no advice (the
    // dev server and `webjs check` surface the real problem).
    return { analysed: false, shipped: [] };
  }

  // Exactly the page + layout set the dev server feeds to analyzeElision, so
  // the verdict matches (error / loading / not-found modules always ship and
  // are never elision candidates, so they are not in scope here).
  const routeModuleSet = new Set();
  for (const page of routeTable.pages || []) {
    if (page.file) routeModuleSet.add(page.file);
    for (const f of page.layouts || []) routeModuleSet.add(f);
  }

  const { shippedRouteModules } = await analyzeElision(
    components, [...routeModuleSet], moduleGraph, (f) => readFile(f, 'utf8'), appDir,
  );

  const shipped = [...shippedRouteModules.entries()].map(([file, v]) => ({
    file,
    blocker: v.blocker,
    reason: v.reason,
  }));
  return { analysed: true, shipped };
}

/** Mirror of the dev server's elide flag: WEBJS_ELIDE override, then webjs.elide. */
async function readElideEnabled(appDir) {
  const raw = process.env.WEBJS_ELIDE;
  if (raw != null) {
    const v = raw.trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  }
  try {
    const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
    if (pkg && pkg.webjs && pkg.webjs.elide === false) return false;
  } catch {
    // No package.json, malformed JSON, or unreadable: keep the default (on).
  }
  return true;
}

/** @param {string} p @returns {Promise<boolean>} */
async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}
