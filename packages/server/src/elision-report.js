/**
 * App-level elision report (#646, extended in #1308).
 *
 * A reporting layer over the `analyzeElision` verdict, NOT a second analysis
 * and NOT a build (WebJs is no-build; elision is the server's analysis pass,
 * run at dev-server start and re-derived after each fs.watch rebuild). It
 * builds the module graph, runs `analyzeElision` ONCE, and projects the whole
 * verdict into a sorted, app-relative, JSON-serializable object.
 *
 * It carries BOTH directions:
 *
 *   - `components`: every component module with `elided` or `shipped`, and for
 *     a shipped one the evidence that forced it plus the module that did the
 *     forcing. This is the direction where a wrong verdict silently loses
 *     interactivity in production, and before #1308 an app had no way to ask
 *     "what did you drop from my page?".
 *   - `routeModules`: every page, layout and boundary with its kind and the
 *     component frontier the boot imports in its place (`emits`). A route
 *     module never ships itself (#1686), so this is what each one costs the
 *     browser: nothing when `emits` is empty.
 *   - `orphans`: a `class X extends WebComponent` with no literal-tag
 *     registration, either because there is no registration call or because
 *     the tag is computed. The scanner never sees it (invariant 3 requires a
 *     literal tag), so it always loses its elision verdict, its tag-to-module
 *     registry entry, and its preload hint, and `static interactive = true`
 *     cannot rescue it. Whether the ELEMENT still upgrades differs by shape:
 *     with no registration call it never does, and with a computed tag only
 *     while its importing module ships WHOLE, which is the exception rather
 *     than the rule. It is the one shape the verdict cannot speak for.
 *
 * Consumed by `webjs elision` (the CLI report + `--json`), the MCP
 * `list_elision` tool, and `webjs doctor`'s two elision checks, which share
 * ONE call so the module graph is built once per doctor run. Advisory only:
 * the analyser is biased toward shipping by design (server AGENTS invariant
 * 7), so this never fails anything.
 *
 * Nothing is cached here. Every out-of-process consumer runs the analysis once
 * and exits, so a cache would never hit and would only add a staleness bug.
 */
import { readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

import { buildModuleGraph } from './module-graph.js';
import { scanComponents, findOrphanComponents } from './component-scanner.js';
import { buildRouteTable } from './router.js';
import { analyzeElision, routeModuleBrowserHints } from './component-elision.js';
import { routeFrontiers, routeModuleKinds } from './route-frontier.js';

/**
 * @typedef {'own'|'observed'|'closure'|'render'|'import'|'unreadable'} ElisionEvidence
 * @typedef {{ file: string, tags: string[], verdict: 'elided'|'shipped', evidence: ElisionEvidence|null, reason: string|null, by: string|null }} ElisionComponentRow
 * @typedef {'page'|'layout'|'error'|'loading'|'not-found'|'forbidden'|'unauthorized'|'global-not-found'} RouteModuleKind
 * @typedef {{ file: string, kind: RouteModuleKind, emits: string[], hints: string[] }} ElisionRouteModuleRow
 * @typedef {{ file: string, className: string }} ElisionOrphanRow
 * @typedef {{ components: number, elided: number, shipped: number, routeModules: number, zeroJs: number, carriers: number, orphans: number }} ElisionSummary
 * @typedef {{ analysed: boolean, skipped: 'no-app'|'unanalysable'|null, elide: boolean, components: ElisionComponentRow[], routeModules: ElisionRouteModuleRow[], orphans: ElisionOrphanRow[], summary: ElisionSummary }} ElisionReport
 */

/**
 * @param {string} appDir
 * @returns {Promise<ElisionReport>}
 */
export async function analyzeAppElision(appDir) {
  // Every path the analysis compares is absolute, so a relative app dir would
  // match nothing and report empty frontiers.
  appDir = resolve(appDir);
  // No `app/` means this is not a routable app (a bare component library, a
  // lib-only fixture); nothing ships, so there is nothing to report on.
  if (!(await pathExists(join(appDir, 'app')))) return empty('no-app');
  // Elision off ships every component; route modules still never ship, so
  // the route rows are reported either way.
  const elide = await readElideEnabled(appDir);

  let moduleGraph, components, routeTable, orphans;
  try {
    moduleGraph = await buildModuleGraph(appDir);
    components = await scanComponents(appDir);
    routeTable = await buildRouteTable(appDir);
    // Not a second elision analysis: a lexical scan for the one shape elision
    // never gets to judge, reusing what the dev server already runs.
    orphans = await findOrphanComponents(appDir);
  } catch {
    // A malformed app the analysis cannot process degrades to no report (the
    // dev server and `webjs check` surface the real problem).
    return empty('unanalysable');
  }

  const ic = routeTable.instrumentationClient;
  const { elidableComponents, componentVerdicts } = elide
    ? await analyzeElision(components, moduleGraph, (f) => readFile(f, 'utf8'), appDir, { entries: ic ? [ic] : [] })
    : { elidableComponents: new Set(), componentVerdicts: null };

  const rel = (f) => (f == null ? null : relative(appDir, f) || f);
  const byFile = (a, b) => a.file.localeCompare(b.file);

  /** @type {ElisionComponentRow[]} */
  let componentRows;
  if (componentVerdicts) {
    componentRows = [...componentVerdicts.entries()].map(([file, v]) => ({
      file: /** @type {string} */ (rel(file)),
      tags: v.tags,
      verdict: v.shipped ? 'shipped' : 'elided',
      evidence: v.shipped ? /** @type {ElisionEvidence|null} */ (v.evidence) : null,
      reason: v.shipped ? relativizeReason(v.reason, appDir) : null,
      by: v.shipped ? rel(v.by) : null,
    }));
  } else {
    // Elision off: every component ships, with no evidence to name.
    const tagsByFile = new Map();
    for (const c of components) {
      const t = tagsByFile.get(c.file) || [];
      if (!t.includes(c.tag)) t.push(c.tag);
      tagsByFile.set(c.file, t);
    }
    componentRows = [...tagsByFile].map(([file, tags]) => ({
      file: /** @type {string} */ (rel(file)), tags: tags.sort(), verdict: /** @type {const} */ ('shipped'),
      evidence: null, reason: 'elision is disabled', by: null,
    }));
  }
  componentRows.sort(byFile);

  // The same frontier walk the dev server runs, so `emits` is exactly what the
  // boot imports in each route module's place.
  const kinds = routeModuleKinds(routeTable);
  const routeFiles = new Set(kinds.keys());
  const frontiers = routeFrontiers([...routeFiles], moduleGraph,
    new Set(components.map((c) => c.file)), new Set([...elidableComponents, ...routeFiles]));
  const componentFileSet = new Set(components.map((c) => c.file));
  // A side-effect import of a barrel that leads to a component is how a route
  // module registers components, and the boot loads those in its place.
  /** @type {Map<string, boolean>} */
  const carries = new Map();
  const carriesComponent = (/** @type {string} */ abs) => {
    if (carries.has(abs)) return /** @type {boolean} */ (carries.get(abs));
    const seen = new Set([abs]);
    const work = [abs];
    let found = false;
    while (work.length && !found) {
      for (const dep of moduleGraph.get(/** @type {string} */ (work.pop())) || []) {
        if (seen.has(dep) || /\.server\.m?[jt]s$/.test(dep)) continue;
        if (componentFileSet.has(dep)) { found = true; break; }
        seen.add(dep);
        work.push(dep);
      }
    }
    carries.set(abs, found);
    return found;
  };
  /** @type {ElisionRouteModuleRow[]} */
  const routeRows = [];
  for (const [f, kind] of kinds) {
    let hints = [];
    try {
      hints = routeModuleBrowserHints(await readFile(f, 'utf8'), {
        file: f, appDir, isComponent: (abs) => componentFileSet.has(abs), carriesComponent,
      });
    } catch { /* unreadable: no advice */ }
    routeRows.push({
      file: /** @type {string} */ (rel(f)),
      kind,
      emits: (frontiers.get(f) || []).map((e) => /** @type {string} */ (rel(e))).sort(),
      hints,
    });
  }
  routeRows.sort(byFile);

  /** @type {ElisionOrphanRow[]} */
  const orphanRows = orphans
    .map((o) => ({ file: /** @type {string} */ (rel(o.file)), className: o.className }))
    .sort((a, b) => byFile(a, b) || a.className.localeCompare(b.className));

  return {
    analysed: true, skipped: null, elide,
    components: componentRows, routeModules: routeRows, orphans: orphanRows,
    summary: {
      components: componentRows.length,
      elided: componentRows.filter((c) => c.verdict === 'elided').length,
      shipped: componentRows.filter((c) => c.verdict === 'shipped').length,
      routeModules: routeRows.length,
      zeroJs: routeRows.filter((r) => r.emits.length === 0).length,
      carriers: routeRows.filter((r) => r.emits.length > 0).length,
      orphans: orphanRows.length,
    },
  };
}

/**
 * The no-verdict report, naming WHY nothing was analysed so a machine consumer
 * can tell "this is not an app" from "the analysis could not run".
 * @param {'no-app'|'unanalysable'} skipped
 * @returns {ElisionReport}
 */
function empty(skipped) {
  return {
    analysed: false, skipped, elide: false,
    components: [], routeModules: [], orphans: [],
    summary: { components: 0, elided: 0, shipped: 0, routeModules: 0, zeroJs: 0, carriers: 0, orphans: 0 },
  };
}

/**
 * `analyzeElision` bakes ABSOLUTE paths into its reason phrases (it works in
 * absolute paths throughout). No absolute filesystem path may reach the JSON
 * contract, so strip the app dir prefix wherever it appears in the sentence.
 * A plain split/join rather than a regex, so an appDir containing regex
 * metacharacters (a `(group)` directory, a `+`) is safe.
 *
 * @param {string|null} reason
 * @param {string} appDir
 * @returns {string|null}
 */
function relativizeReason(reason, appDir) {
  if (reason == null) return null;
  return reason.split(appDir.endsWith(sep) ? appDir : appDir + sep).join('');
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
