/**
 * Sitemap helpers (issue #276). Two pure functions that turn an array of
 * entries into spec-valid XML, so an author of `app/sitemap.{js,ts}` does not
 * hand-roll the `<urlset>` string (escaping URLs, formatting lastmod dates) and
 * has a built-in path to shard a large site via a `<sitemapindex>`.
 *
 * Both are OPTIONAL and tiny. The dev server serves a STRING returned from a
 * `sitemap.{js,ts}` default export as `application/xml`, so the author returns
 * `sitemap([...])` from that function. They can still return a raw Response or a
 * hand-built string, so this is thin XML serialization, not a sitemap framework.
 *
 * Reference: the sitemaps.org 0.9 protocol; Next.js `sitemap.ts` (a typed array
 * serialized to XML) and `generateSitemaps()` (the index for sharding).
 */

/** Per-URL entry for {@link sitemap}.
 * @typedef {object} SitemapEntry
 * @property {string} url Absolute URL (REQUIRED). XML-escaped on emit.
 * @property {string|Date} [lastModified] Last-modified time, formatted as W3C
 *   datetime (ISO 8601). A Date is `toISOString()`'d; a string passes through.
 * @property {'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never'} [changeFrequency]
 *   How often the page changes. An invalid value is dropped (not emitted).
 * @property {number} [priority] Priority 0.0..1.0. Out-of-range / non-numeric
 *   is dropped.
 */

/** Child-sitemap entry for {@link sitemapIndex}.
 * @typedef {object} SitemapIndexEntry
 * @property {string} url Absolute URL of a child sitemap (REQUIRED).
 * @property {string|Date} [lastModified] Last-modified time (W3C datetime).
 */

const VALID_CHANGEFREQ = new Set([
  'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never',
]);

const MAX_URLS = 50000;

/**
 * XML-escape text destined for an element body. This is the security-critical
 * part: a url derived from author data or a DB can contain `&` or `<`, which
 * would break the XML document or allow injection if emitted raw. The five
 * predefined XML entities are replaced (`&` first, so the entities the other
 * replacements introduce are not double-escaped).
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a `lastModified` value as a W3C datetime (ISO 8601) string. A Date
 * becomes its `toISOString()`; a non-empty string passes through verbatim (the
 * spec accepts both `YYYY-MM-DD` and a full timestamp). Anything else yields
 * null so the `<lastmod>` element is omitted rather than emitted broken.
 * @param {string|Date|undefined} value
 * @returns {string|null}
 */
function formatLastmod(value) {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) return null;
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

/**
 * Validate + format a `priority` to one decimal in the 0.0..1.0 range. Returns
 * null (so the element is dropped) for a non-number or an out-of-range value.
 * @param {number|undefined} value
 * @returns {string|null}
 */
function formatPriority(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value < 0 || value > 1) return null;
  return value.toFixed(1);
}

/**
 * Serialize an array of {@link SitemapEntry} into a complete `<urlset>` XML
 * document. Element order per the protocol is loc, lastmod, changefreq,
 * priority. A malformed entry (missing / non-string / empty `url`) is skipped so
 * it cannot produce broken XML. Output is deterministic.
 * @param {SitemapEntry[]} entries
 * @returns {string} a `<?xml ?>` + `<urlset>` document
 */
export function sitemap(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length > MAX_URLS) {
    console.warn(
      `[webjs] sitemap() received ${list.length} URLs, over the ${MAX_URLS} per-file limit. ` +
      'Shard the site with sitemapIndex() instead. Emitting all URLs anyway.'
    );
  }
  const urls = [];
  for (const entry of list) {
    if (!entry || typeof entry.url !== 'string' || entry.url.trim() === '') {
      console.warn('[webjs] sitemap(): skipping an entry with a missing or invalid url');
      continue;
    }
    const parts = [`    <loc>${escapeXml(entry.url.trim())}</loc>`];
    const lastmod = formatLastmod(entry.lastModified);
    if (lastmod !== null) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
    if (typeof entry.changeFrequency === 'string' && VALID_CHANGEFREQ.has(entry.changeFrequency)) {
      parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    }
    const priority = formatPriority(entry.priority);
    if (priority !== null) parts.push(`    <priority>${priority}</priority>`);
    urls.push(`  <url>\n${parts.join('\n')}\n  </url>`);
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (urls.length ? urls.join('\n') + '\n' : '') +
    '</urlset>\n'
  );
}

/**
 * Serialize an array of {@link SitemapIndexEntry} into a `<sitemapindex>` XML
 * document, one `<sitemap>` per child sitemap URL. Same escaping + lastmod rules
 * and same skip-malformed-entry behavior as {@link sitemap}. Use it from the
 * root `app/sitemap.{js,ts}` to point at sharded child sitemaps served by
 * `route.{js,ts}` handlers.
 * @param {SitemapIndexEntry[]} sitemaps
 * @returns {string} a `<?xml ?>` + `<sitemapindex>` document
 */
export function sitemapIndex(sitemaps) {
  const list = Array.isArray(sitemaps) ? sitemaps : [];
  const items = [];
  for (const entry of list) {
    if (!entry || typeof entry.url !== 'string' || entry.url.trim() === '') {
      console.warn('[webjs] sitemapIndex(): skipping an entry with a missing or invalid url');
      continue;
    }
    const parts = [`    <loc>${escapeXml(entry.url.trim())}</loc>`];
    const lastmod = formatLastmod(entry.lastModified);
    if (lastmod !== null) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
    items.push(`  <sitemap>\n${parts.join('\n')}\n  </sitemap>`);
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (items.length ? items.join('\n') + '\n' : '') +
    '</sitemapindex>\n'
  );
}
