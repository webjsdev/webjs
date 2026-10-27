/**
 * The boot's shipped-module assembly, shared by the SSR render and the 103
 * Early Hints (#1644).
 *
 * For a matched route the client boot imports the page and its layouts MINUS
 * the inert ones (a module that does no client work, #170), with an
 * IMPORT-ONLY module (#605) replaced by the component frontier it exists to
 * import, and a `static lazy` component in that frontier (#1524) diverted to
 * the lazy loader instead of imported. `ssr/render.js` derived that list per
 * request, and the Node listener's `routeFor` (the 103 Early Hints) carried a
 * second copy of the same loop that had drifted: it knew nothing of lazy
 * files, so a lazy frontier component was early-hinted although the boot
 * never imports it.
 *
 * One function now owns the assembly, memoized per ROUTE OBJECT in a WeakMap
 * (the route table is rebuilt per build, so a stale entry dies with its
 * route, and a dynamic route cannot grow the memo the way a pathname key
 * would) and validated against the build epoch (the inert / import-only /
 * lazy sets are per-build inputs). The hinted url list, the same modules
 * through `withBasePath` then `withAssetHash`, is memoized beside it so a
 * warm GET costs one WeakMap lookup.
 */
import { buildEpoch } from '../build-epoch.js';
import { withBasePath } from '../base-path.js';
import { withAssetHash } from '../asset-hash.js';
import { toUrlPath } from './preloads.js';

/**
 * @typedef {object} ShippedDeps
 * @property {string} appDir
 * @property {Set<string> | undefined} inert  inert page / layout files (never shipped)
 * @property {Map<string, string[]> | undefined} importOnly  import-only module -> the component files emitted in its place
 * @property {Map<string, string[]> | undefined} lazyFiles  lazy component file -> its tags
 * @property {string | undefined} instrumentationClient  `instrumentation-client.*`, imported first when present
 */

/**
 * @typedef {object} ShippedModules
 * @property {string[]} moduleUrls  url paths the boot imports, in import order
 * @property {Record<string, string>} frontierLazy  tag -> url for lazy components diverted out of the frontier
 */

/** @type {WeakMap<object, { epoch: number, value: ShippedModules, hinted: string[] | null, hintedBasePath: string }>} */
const MEMO = new WeakMap();

/**
 * The modules the client boot imports for `route`, plus the lazy frontier it
 * registers instead. Same object back for the same route within a build.
 *
 * @param {{ file: string, layouts: string[] }} route  the matched route (its object identity is the memo key)
 * @param {ShippedDeps} deps
 * @returns {ShippedModules}
 */
export function shippedBootModules(route, deps) {
  const hit = MEMO.get(route);
  if (hit && hit.epoch === buildEpoch()) return hit.value;
  const { appDir, inert, importOnly, lazyFiles, instrumentationClient } = deps;
  /** @type {string[]} */
  const moduleUrls = [];
  /** @type {Record<string, string>} */
  const frontierLazy = {};
  const seen = new Set();
  const push = (/** @type {string} */ abs) => {
    const u = toUrlPath(abs, appDir);
    const tags = lazyFiles && lazyFiles.get(abs);
    if (tags) { for (const t of tags) frontierLazy[t] = u; return; }
    if (!seen.has(u)) { seen.add(u); moduleUrls.push(u); }
  };
  for (const f of [route.file, ...route.layouts]) {
    if (inert && inert.has(f)) continue;
    const emit = importOnly && importOnly.get(f);
    if (emit) emit.forEach(push);
    else push(f);
  }
  // instrumentation-client.{js,ts} (#848): import it FIRST in the client boot
  // so it runs before app modules (Next's instrumentation-client ordering).
  // It ships even on an otherwise-static page (the app opted into client work).
  if (instrumentationClient) {
    const u = toUrlPath(instrumentationClient, appDir);
    const i = moduleUrls.indexOf(u);
    if (i !== -1) moduleUrls.splice(i, 1);
    moduleUrls.unshift(u);
  }
  const value = { moduleUrls, frontierLazy };
  MEMO.set(route, { epoch: buildEpoch(), value, hinted: null, hintedBasePath: '' });
  return value;
}

/**
 * The 103 Early Hints url list for `route`: the SAME modules the boot
 * imports, through `withBasePath` then `withAssetHash`, so the hint warms
 * exactly the url the body requests (#243). Memoized beside the assembly.
 *
 * @param {{ file: string, layouts: string[] }} route
 * @param {ShippedDeps} deps
 * @param {string} basePath  the normalized `webjs.basePath` (`''` at a root mount)
 * @returns {string[]}
 */
export function hintedBootModules(route, deps, basePath) {
  const { moduleUrls } = shippedBootModules(route, deps);
  const entry = /** @type {NonNullable<ReturnType<typeof MEMO.get>>} */ (MEMO.get(route));
  if (entry.hinted && entry.hintedBasePath === basePath) return entry.hinted;
  const hinted = moduleUrls.map((u) => withAssetHash(withBasePath(u, basePath), basePath));
  entry.hinted = hinted;
  entry.hintedBasePath = basePath;
  return hinted;
}
