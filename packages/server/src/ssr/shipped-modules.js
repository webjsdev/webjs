/**
 * The boot's shipped-module assembly, shared by the SSR render and the 103
 * Early Hints (#1644).
 *
 * For a matched route the client boot imports the component FRONTIER of each
 * of its route modules (layouts, loading templates, the page), never a route
 * module itself (#1686, `route-frontier.js`), with a `static lazy` component
 * in that frontier (#1524) diverted to the lazy loader instead of imported.
 * `ssr/render.js` derived that list per
 * request, and the Node listener's `routeFor` (the 103 Early Hints) carried a
 * second copy of the same loop that had drifted: it knew nothing of lazy
 * files, so a lazy frontier component was early-hinted although the boot
 * never imports it.
 *
 * One function now owns the assembly, memoized per ROUTE OBJECT in a WeakMap
 * (the route table is rebuilt per build, so a stale entry dies with its
 * route, and a dynamic route cannot grow the memo the way a pathname key
 * would) and validated against the build epoch (the frontiers and the lazy
 * set are per-build inputs). The hinted url list, the same modules
 * through `withBasePath` then `withAssetHash`, is memoized beside it so a
 * warm GET costs one WeakMap lookup.
 */
import { buildEpoch } from '../build-epoch.js';
import { withBasePath } from '../base-path.js';
import { withAssetHash, assetHashMisses } from '../asset-hash.js';
import { toUrlPath } from './preloads.js';

/**
 * @typedef {object} ShippedDeps
 * @property {string} appDir
 * @property {Map<string, string[]> | undefined} frontiers  route module -> the component files the boot imports in its place
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
 * @param {{ file: string, layouts: string[], loadings?: string[] }} route  the matched route (its object identity is the memo key)
 * @param {ShippedDeps} deps
 * @returns {ShippedModules}
 */
export function shippedBootModules(route, deps) {
  const hit = MEMO.get(route);
  if (hit && hit.epoch === buildEpoch()) return hit.value;
  // Nesting order, outermost layout first and the page last, so an ancestor's
  // elements are defined before a descendant's. A context provider in a layout
  // then exists when a page component's context request fires on upgrade; with
  // the page first, that one-shot request went unanswered and the consumer
  // silently got no value. A loading template renders before the page streams
  // in, so a component only it renders must register too.
  const value = assembleBootModules([...route.layouts, ...(route.loadings || []), route.file], deps);
  MEMO.set(route, { epoch: buildEpoch(), value, hinted: null, hintedBasePath: '' });
  return value;
}

/**
 * The assembly itself, un-memoized: the one loop behind `shippedBootModules`
 * (a matched page and its layouts) and the boundary render in `ssr/render.js`
 * (an error / not-found / forbidden / unauthorized file and the layouts it is
 * wrapped in, a per-render list with no stable object to key a memo on). One
 * function so the two cannot drift, which is how the 103 Early Hints lost the
 * lazy-frontier rule before #1644.
 *
 * @param {string[]} files  the route modules in import order (page or boundary first, then its layouts)
 * @param {ShippedDeps} deps
 * @returns {ShippedModules}
 */
export function assembleBootModules(files, deps) {
  const { appDir, frontiers, lazyFiles, instrumentationClient } = deps;
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
  // A route module never ships: only its component frontier does. A file with
  // no frontier entry (none computed yet, in the pre-warm window) emits
  // nothing, never the file itself.
  for (const f of files) {
    const emit = frontiers && frontiers.get(f);
    if (emit) emit.forEach(push);
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
  return { moduleUrls, frontierLazy };
}

/**
 * The 103 Early Hints `Link` values for the boot's modules: a plain
 * `rel=preload; as=script; crossorigin=anonymous` per url, NEVER
 * `rel=modulepreload`.
 *
 * A module hint in a 103 arrives before the document, so it is processed
 * before the page's `<script type="importmap">` can be parsed. Firefox treats
 * a modulepreload as the start of module loading and then refuses the import
 * map ("Import maps are not allowed after a module load or preload has
 * started"), so every bare `@webjsdev/core` import failed and no script ran on
 * a Node-served page. The HTML spec gives modulepreload no early-hint
 * behaviour at all (its "process a link header" steps do nothing), and
 * Chromium acts only on preload and preconnect there, so the modulepreload
 * hint was a no-op in Chromium and fatal in Firefox.
 *
 * A plain preload only puts the bytes in the preload cache: it creates no
 * module script, resolves no specifier and fetches no descendants, so it
 * cannot run ahead of the import map on any engine. `as=script` with
 * `crossorigin=anonymous` is a CORS fetch with same-origin credentials,
 * which is exactly the request a module script makes, so the body's
 * `<link rel="modulepreload">` and the boot's import reuse the response
 * instead of fetching it again.
 *
 * @param {string[]} urls  the hinted boot module urls (`hintedBootModules`)
 * @returns {string[]}
 */
export function earlyHintLinks(urls) {
  return urls.map((u) => `<${u}>; rel=preload; as=script; crossorigin=anonymous`);
}

/**
 * The 103 Early Hints url list for `route`: the SAME modules the boot
 * imports, through `withBasePath` then `withAssetHash`, so the hint warms
 * exactly the url the body requests (#243). Memoized beside the assembly.
 *
 * @param {{ file: string, layouts: string[], loadings?: string[] }} route
 * @param {ShippedDeps} deps
 * @param {string} basePath  the normalized `webjs.basePath` (`''` at a root mount)
 * @returns {string[]}
 */
export function hintedBootModules(route, deps, basePath) {
  const { moduleUrls } = shippedBootModules(route, deps);
  const entry = /** @type {NonNullable<ReturnType<typeof MEMO.get>>} */ (MEMO.get(route));
  if (entry.hinted && entry.hintedBasePath === basePath) return entry.hinted;
  // Not stored when a hash read failed transiently while computing it
  // (`assetHashMisses` moved): the list is served with the un-fingerprinted
  // url, and the next request re-attempts the read (see `asset-hash.js`).
  const missesBefore = assetHashMisses();
  const hinted = moduleUrls.map((u) => withAssetHash(withBasePath(u, basePath), basePath));
  if (assetHashMisses() === missesBefore) {
    entry.hinted = hinted;
    entry.hintedBasePath = basePath;
  }
  return hinted;
}
