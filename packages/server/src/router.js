import { join, relative, sep, posix } from 'node:path';
import { walk } from './fs-walk.js';

/**
 * @typedef {{
 *   pattern: RegExp,
 *   paramNames: string[],
 *   file: string,
 *   routeDir: string,
 *   layouts: string[],
 *   errors: string[],
 *   loadings: string[],
 *   metadataFiles: string[],
 *   middlewares: string[],
 *   isCatchAll: boolean
 * }} PageRoute
 *
 * @typedef {{
 *   pattern: RegExp,
 *   paramNames: string[],
 *   file: string,
 *   middlewares: string[],
 * }} ApiRoute
 *
 * @typedef {{ stem: string, file: string, urlPath: string }} MetadataRoute
 *
 * @typedef {{
 *   pages: PageRoute[],
 *   apis: ApiRoute[],
 *   notFound: string | null,
 *   notFounds: Map<string, string>,
 *   metadataRoutes: MetadataRoute[],
 *   appDir: string
 * }} RouteTable
 */

/**
 * Scan `<appDir>/app` and build a route table.
 *
 * Supported file conventions (NextJs App Router–compatible):
 *   app/page.js                     → /
 *   app/about/page.js               → /about
 *   app/blog/[slug]/page.js         → /blog/:slug
 *   app/files/[...rest]/page.js     → /files/*
 *   app/(marketing)/about/page.js   → /about   (folders in parens are route groups; not in URL)
 *   app/_internal/page.js           → ignored  (folders starting with _ are private)
 *   app/api/hello/route.js          → /api/hello
 *   app/layout.js                   → wraps every page
 *   app/error.js                    → error boundary (nested)
 *   app/loading.js                  → loading UI (auto-wraps page in Suspense)
 *   app/not-found.js                → 404 fallback (nested: nearest wins)
 *   app/[[...slug]]/page.js         → optional catch-all (matches / AND /a/b)
 *   app/sitemap.js                  → serves /sitemap.xml
 *   app/robots.js                   → serves /robots.txt
 *   app/icon.js                     → serves /icon (dynamic)
 *   app/opengraph-image.js          → serves /opengraph-image (dynamic)
 *
 * @param {string} appDir
 * @returns {Promise<RouteTable>}
 */
export async function buildRouteTable(appDir) {
  const root = join(appDir, 'app');
  /** @type {PageRoute[]} */
  const pages = [];
  /** @type {ApiRoute[]} */
  const apis = [];
  /** @type {Map<string,string>} */
  const layouts = new Map();
  /** @type {Map<string,string>} */
  const errors = new Map();
  /** @type {Map<string,string>} */
  const loadings = new Map();
  /** @type {Map<string,string>} */
  const middlewares = new Map();
  /** @type {Map<string, string>} */
  const notFounds = new Map();
  let notFound = null;
  /** @type {MetadataRoute[]} */
  const metadataRoutes = [];

  /** @type {Set<string>} */
  const METADATA_STEMS = new Set(['sitemap', 'robots', 'manifest', 'icon', 'apple-icon', 'opengraph-image', 'twitter-image']);
  /** @type {Record<string,string>} */
  const METADATA_URL_MAP = {
    'sitemap': '/sitemap.xml',
    'robots': '/robots.txt',
    'manifest': '/manifest.json',
    'icon': '/icon',
    'apple-icon': '/apple-icon',
    'opengraph-image': '/opengraph-image',
    'twitter-image': '/twitter-image',
  };

  for await (const file of walk(root)) {
    const rel = relative(root, file).split(sep).join('/');
    const base = posix.basename(rel);
    const dir = posix.dirname(rel);

    // Private folders (any segment starting with _) are excluded from routing.
    if (dir !== '.' && dir.split('/').some((s) => s.startsWith('_'))) continue;

    // Match `<name>.<js|mjs|ts|mts>` conventions. Stem is the name without ext.
    const stem = stemOf(base);
    if (!stem) continue;

    if (stem === 'page') {
      const segs = dir === '.' ? [] : dir.split('/');
      const { pattern, paramNames, isCatchAll } = segmentsToPattern(segs);
      pages.push({
        pattern,
        paramNames,
        file,
        routeDir: dir,
        layouts: [],
        errors: [],
        loadings: [],
        metadataFiles: [],
        middlewares: [],
        isCatchAll,
      });
    } else if (stem === 'layout') {
      layouts.set(dir, file);
    } else if (stem === 'error') {
      errors.set(dir, file);
    } else if (stem === 'loading') {
      loadings.set(dir, file);
    } else if (stem === 'middleware') {
      middlewares.set(dir, file);
    } else if (stem === 'not-found') {
      notFounds.set(dir, file);
      if (dir === '.') notFound = file;
    } else if (METADATA_STEMS.has(stem) && (dir === '.' || dir.split('/').every(s => !s.startsWith('[')))) {
      // Metadata route: sitemap.ts, robots.ts, icon.ts, etc.
      // Only at root or static segments (no dynamic params in metadata routes).
      const urlPath = METADATA_URL_MAP[stem] || `/${stem}`;
      metadataRoutes.push({ stem, file, urlPath });
    } else if (stem === 'route') {
      // route.js / route.ts can live anywhere under app/ (matches NextJs).
      const segs = dir === '.' ? [] : dir.split('/');
      const { pattern, paramNames } = segmentsToPattern(segs);
      apis.push({ pattern, paramNames, file, routeDir: dir, middlewares: [] });
    }
  }

  // Attach nested layouts / error / loading / middleware files (outermost first).
  for (const page of pages) {
    const chainDirs = chainOf(page.routeDir);
    page.layouts = chainDirs.map((d) => layouts.get(d)).filter(Boolean);
    page.errors = chainDirs.map((d) => errors.get(d)).filter(Boolean);
    page.loadings = chainDirs.map((d) => loadings.get(d)).filter(Boolean);
    page.middlewares = chainDirs.map((d) => middlewares.get(d)).filter(Boolean);
    page.metadataFiles = [...page.layouts, page.file];
  }
  for (const api of apis) {
    /** @type any */
    const a = api;
    const chainDirs = chainOf(a.routeDir);
    a.middlewares = chainDirs.map((d) => middlewares.get(d)).filter(Boolean);
  }

  pages.sort(compareSpecificity);
  return { pages, apis, notFound, notFounds, metadataRoutes, appDir };
}

/**
 * Return the bare name of a file without the accepted JS/TS extension.
 * `page.js` / `page.mjs` / `page.ts` / `page.mts` → `page`.
 * Returns null for anything else (images, CSS, etc. don't participate in routing).
 *
 * @param {string} base
 * @returns {string | null}
 */
function stemOf(base) {
  const m = /^([A-Za-z0-9_.-]+)\.(?:m?[jt]s)$/.exec(base);
  return m ? m[1] : null;
}

/** @param {string} routeDir */
function chainOf(routeDir) {
  const segs = routeDir === '.' ? [] : routeDir.split('/');
  /** @type {string[]} */
  const dirs = ['.'];
  for (let i = 1; i <= segs.length; i++) dirs.push(segs.slice(0, i).join('/'));
  return dirs;
}

/** @param {string} seg */
function isUrlSegment(seg) {
  if (seg.startsWith('(') && seg.endsWith(')')) return false; // route group
  if (seg.startsWith('_')) return false; // private
  return true;
}

/**
 * Per-URL-segment specificity kind: 0 = static literal, 1 = dynamic `[x]`,
 * 2 = catch-all `[...x]` / `[[...x]]`. Lower is MORE specific. Checks the
 * catch-all forms before the bare `[` (a `[[...x]]` also starts with `[`).
 * @param {string} seg
 * @returns {0 | 1 | 2}
 */
function segKind(seg) {
  if (seg.startsWith('[[...') || seg.startsWith('[...')) return 2;
  if (seg.startsWith('[') && seg.endsWith(']')) return 1;
  return 0;
}

/**
 * The ordered URL segments of a route (route groups + private folders removed),
 * which is the basis for positional specificity.
 * @param {string} routeDir
 * @returns {string[]}
 */
function urlSegmentsOf(routeDir) {
  return (routeDir === '.' ? [] : routeDir.split('/')).filter(isUrlSegment);
}

/**
 * Deterministic route specificity ordering (#750). Replaces the old coarse
 * 3-bucket score (static=1 / dynamic=2 / catch-all=3) whose same-bucket ties
 * resolved by filesystem walk order, so two overlapping dynamic routes
 * (`/[org]/[repo]` vs `/[user]/settings`) could match the WRONG page depending
 * on traversal order. The contract, most specific first:
 *   1. A catch-all route (`[...x]` / `[[...x]]`) is always LEAST specific.
 *   2. Otherwise compare segment by segment: a static literal outranks a
 *      dynamic `[x]` at the same position (so `/[user]/settings` beats
 *      `/[org]/[repo]`).
 *   3. With an identical kind prefix, more segments rank first (more
 *      constraints); anchored non-overlapping patterns are order-independent
 *      anyway, so this only makes the order stable.
 *   4. A genuine tie (identical kinds + length, e.g. `/[a]/[b]` vs `/[c]/[d]`)
 *      resolves by an alphabetical `routeDir` key, NOT walk order, so the match
 *      is deterministic across environments.
 * @param {PageRoute} a
 * @param {PageRoute} b
 * @returns {number}
 */
export function compareSpecificity(a, b) {
  if (a.isCatchAll !== b.isCatchAll) return a.isCatchAll ? 1 : -1;
  const sa = urlSegmentsOf(a.routeDir).map(segKind);
  const sb = urlSegmentsOf(b.routeDir).map(segKind);
  const n = Math.min(sa.length, sb.length);
  for (let i = 0; i < n; i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
  if (sa.length !== sb.length) return sb.length - sa.length;
  return a.routeDir < b.routeDir ? -1 : a.routeDir > b.routeDir ? 1 : 0;
}

/**
 * @param {string[]} segments
 * @param {string} [prefix]
 */
function segmentsToPattern(segments, prefix = '') {
  const paramNames = [];
  let isCatchAll = false;
  let isOptionalCatchAll = false;
  const parts = segments
    .filter(isUrlSegment)
    .map((seg) => {
      // Optional catch-all: [[...slug]] matches with AND without params
      if (seg.startsWith('[[...') && seg.endsWith(']]')) {
        paramNames.push(seg.slice(5, -2));
        isCatchAll = true;
        isOptionalCatchAll = true;
        return '(.*)';
      }
      if (seg.startsWith('[...') && seg.endsWith(']')) {
        paramNames.push(seg.slice(4, -1));
        isCatchAll = true;
        return '(.*)';
      }
      if (seg.startsWith('[') && seg.endsWith(']')) {
        paramNames.push(seg.slice(1, -1));
        return '([^/]+)';
      }
      return escapeRe(seg);
    });
  const body = parts.length ? '/' + parts.join('/') : '';
  // Optional catch-all: also matches the base path without any trailing segments.
  // e.g., /docs/[[...slug]] matches both /docs and /docs/a/b/c
  const suffix = isOptionalCatchAll ? '(?:/(.*))?/?' : '/?';
  const regexBody = isOptionalCatchAll
    ? body.replace(/\/\(\.\*\)$/, '')  // remove the trailing (.*): we add it as optional
    : body;
  const pattern = new RegExp(`^${escapeRe(prefix)}${regexBody}${isOptionalCatchAll ? suffix : '/?$'}`);
  if (!isOptionalCatchAll) {
    // Standard pattern needs end anchor
    return { pattern: new RegExp(`^${escapeRe(prefix)}${body}/?$`), paramNames, isCatchAll };
  }
  return { pattern, paramNames, isCatchAll };
}

/** @param {string} s */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {RouteTable} table
 * @param {string} pathname
 */
export function matchPage(table, pathname) {
  for (const route of table.pages) {
    const m = route.pattern.exec(pathname);
    if (!m) continue;
    /** @type {Record<string,string>} */
    const params = {};
    route.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1] || '')));
    return { route, params };
  }
  return null;
}

/**
 * @param {RouteTable} table
 * @param {string} pathname
 */
export function matchApi(table, pathname) {
  for (const route of table.apis) {
    const m = route.pattern.exec(pathname);
    if (!m) continue;
    /** @type {Record<string,string>} */
    const params = {};
    route.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1] || '')));
    return { route, params };
  }
  return null;
}
