/**
 * Metadata route dispatch (`app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`,
 * the image routes) and the page listing a sitemap is built from (#1564).
 *
 * A metadata route's default export is called with a context:
 *
 *   { request, url, siteUrl, pages }
 *
 * - `siteUrl` is the app's public origin: `SITE_URL` when set, else the
 *   request origin (forwarded headers applied). A sitemap must list absolute
 *   URLs, and only the request knows the host when no site URL is configured.
 * - `pages()` lists every public page as sitemap entries (see `listPages`).
 *
 * Return values: a `Response` is sent as is; a string is sent with a content
 * type picked from the URL; an ARRAY from `sitemap` is serialized with
 * `sitemap()` (relative URLs resolved against `siteUrl`); an OBJECT from
 * `robots` is serialized with `robots()`; any other object is JSON. The last
 * two are Next's `MetadataRoute.Sitemap` / `MetadataRoute.Robots` shapes, so
 * code written the Next way works unchanged.
 */
import { sitemap as sitemapXml, robots as robotsTxt } from './sitemap.js';
import { isUrlSegment } from './router.js';
import { devImportSpecifier } from './dev-import.js';
import { siteUrlFromEnv } from './ssr/seo.js';
import { basePath } from './importmap.js';
import { withBasePath } from './base-path.js';

/**
 * @typedef {{ url: string, lastModified?: string | Date, changeFrequency?: string, priority?: number }} PageEntry
 */

/**
 * Whether a page's static metadata chain (layouts, then the page; the deepest
 * `robots` wins, matching the metadata merge) asks search engines not to index.
 * Only the static `metadata` export is read: `generateMetadata` may depend on
 * the request (a session, a record), which a sitemap request does not carry.
 * @param {string[]} files
 * @param {boolean} dev
 */
async function isNoindex(files, dev) {
  /** @type {unknown} */
  let robots;
  for (const file of files) {
    try {
      const mod = await import(devImportSpecifier(file, dev));
      if (mod.metadata && typeof mod.metadata === 'object' && mod.metadata.robots !== undefined) {
        robots = mod.metadata.robots;
      }
    } catch {
      // A module that fails to load is reported when the page renders.
    }
  }
  if (typeof robots === 'string') return /\bnoindex\b|\bnone\b/i.test(robots);
  if (robots && typeof robots === 'object') return /** @type {any} */ (robots).index === false;
  return false;
}

/**
 * Fill a dynamic route's segments from one params object, or null when a
 * param is missing.
 * @param {string[]} segs URL segments (groups and private folders removed)
 * @param {Record<string, unknown>} params
 */
function fillSegments(segs, params) {
  const out = [];
  for (const seg of segs) {
    const optional = seg.startsWith('[[...') && seg.endsWith(']]');
    const rest = !optional && seg.startsWith('[...') && seg.endsWith(']');
    if (optional || rest) {
      const name = optional ? seg.slice(5, -2) : seg.slice(4, -1);
      const v = params[name];
      const parts = Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)];
      if (!parts.length && rest) return null;
      out.push(...parts.map(encodeURIComponent));
    } else if (seg.startsWith('[') && seg.endsWith(']')) {
      const v = params[seg.slice(1, -1)];
      if (v == null || v === '') return null;
      out.push(encodeURIComponent(String(v)));
    } else {
      out.push(seg);
    }
  }
  return '/' + out.join('/');
}

/**
 * List the app's public pages as sitemap entries.
 *
 * - Every static page route, with route groups and private folders removed.
 * - A dynamic route only when its page exports `generateSitemapParams()`,
 *   returning params objects (`[{ slug: 'a' }]`) or entries carrying them
 *   (`[{ params: { slug: 'a' }, lastModified }]`), typically from a query.
 * - Skipped: a page whose static metadata chain says `robots: { index: false }`
 *   (or a `noindex` string), and parallel-route slots (`@x`) / interception
 *   folders (`(.)x`), which are not addressable pages on their own.
 *
 * @param {{ pages: Array<{ file: string, routeDir: string, metadataFiles: string[] }> }} routeTable
 * @param {{ siteUrl: string, dev: boolean }} opts
 * @returns {Promise<PageEntry[]>}
 */
export async function listPages(routeTable, { siteUrl, dev }) {
  const bp = basePath();
  const abs = (/** @type {string} */ path) => siteUrl + withBasePath(path, bp);
  /** @type {PageEntry[]} */
  const out = [];
  const seen = new Set();
  const push = (/** @type {PageEntry} */ e) => {
    if (seen.has(e.url)) return;
    seen.add(e.url);
    out.push(e);
  };
  for (const page of routeTable.pages) {
    const dirSegs = page.routeDir === '.' ? [] : page.routeDir.split('/');
    if (dirSegs.some((s) => s.startsWith('@') || /^\(\.+\)/.test(s))) continue;
    if (await isNoindex(page.metadataFiles || [page.file], dev)) continue;
    const segs = dirSegs.filter(isUrlSegment);
    if (!segs.some((s) => s.startsWith('['))) {
      push({ url: abs(segs.length ? '/' + segs.join('/') : '/') });
      continue;
    }
    let mod;
    try {
      mod = await import(devImportSpecifier(page.file, dev));
    } catch {
      continue;
    }
    if (typeof mod.generateSitemapParams !== 'function') continue;
    const list = await mod.generateSitemapParams();
    for (const item of Array.isArray(list) ? list : []) {
      if (!item || typeof item !== 'object') continue;
      const entry = item.params && typeof item.params === 'object' ? item : { params: item };
      const path = fillSegments(segs, entry.params);
      if (!path) continue;
      /** @type {PageEntry} */
      const e = { url: abs(path) };
      if (entry.lastModified) e.lastModified = entry.lastModified;
      if (entry.changeFrequency) e.changeFrequency = entry.changeFrequency;
      if (typeof entry.priority === 'number') e.priority = entry.priority;
      push(e);
    }
  }
  return out;
}

/**
 * Resolve each entry's url against the site URL (an author may return paths).
 * @param {unknown[]} entries
 * @param {string} siteUrl
 */
function absoluteEntries(entries, siteUrl) {
  return entries.map((e) => {
    if (!e || typeof e !== 'object' || typeof (/** @type {any} */ (e).url) !== 'string') return e;
    const url = /** @type {any} */ (e).url;
    if (/^https?:\/\//i.test(url)) return e;
    try {
      return { ...e, url: new URL(url, siteUrl + '/').toString() };
    } catch {
      return e;
    }
  });
}

/**
 * Run a metadata route and turn its return value into a Response.
 * @param {{ stem: string, file: string, urlPath: string }} meta
 * @param {{ req: Request, url: URL, path: string, dev: boolean, routeTable: any }} opts
 * @returns {Promise<Response | null>} null when the module has no default export
 */
export async function runMetadataRoute(meta, { req, url, path, dev, routeTable }) {
  const mod = await import(devImportSpecifier(meta.file, dev));
  if (typeof mod.default !== 'function') return null;
  const siteUrl = siteUrlFromEnv() || url.origin;
  const ctx = {
    request: req,
    url,
    siteUrl,
    pages: () => listPages(routeTable, { siteUrl, dev }),
  };
  const result = await mod.default(ctx);
  if (result instanceof Response) return result;
  const cacheControl = dev ? 'no-cache' : 'public, max-age=3600';
  if (meta.stem === 'sitemap' && Array.isArray(result)) {
    return new Response(sitemapXml(/** @type {any} */ (absoluteEntries(result, siteUrl))), {
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': cacheControl },
    });
  }
  if (meta.stem === 'robots' && result && typeof result === 'object') {
    return new Response(robotsTxt(/** @type {any} */ (result)), {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': cacheControl },
    });
  }
  const ct = path.endsWith('.xml') ? 'application/xml; charset=utf-8'
    : path.endsWith('.txt') ? 'text/plain; charset=utf-8'
    : path.endsWith('.json') ? 'application/json; charset=utf-8'
    : 'application/octet-stream';
  return new Response(typeof result === 'string' ? result : JSON.stringify(result), {
    headers: { 'content-type': ct, 'cache-control': cacheControl },
  });
}
