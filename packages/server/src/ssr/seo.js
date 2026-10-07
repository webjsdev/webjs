/**
 * Search and share defaults for page metadata (#1564).
 *
 * `applySeoDefaults()` runs once per page render, after the layout + page
 * metadata has been merged, and fills in the tags every public page should
 * carry when the author did not set them:
 *
 *   - `metadataBase` from the `SITE_URL` env var (the app's public origin), so
 *     relative canonical / og:image / og:url values become absolute;
 *   - a canonical URL (site URL + pathname, no query) when a site URL is known;
 *   - `og:title` / `og:description` from `title` / `description`, `og:type`
 *     `website`, `og:url` from the canonical;
 *   - `og:image` / `twitter:image` from an `opengraph-image` / `twitter-image`
 *     metadata route (the nearest one above the page), Next's behaviour;
 *   - `twitter:card` (`summary_large_image` when there is an image).
 *
 * Every default yields to an explicit value, and `alternates.canonical: null`
 * opts a page out of the canonical. The canonical NEVER falls back to the
 * request origin: the forwarded host is client-influenced (see forwarded.js),
 * so only a configured site URL is trusted to name the public address.
 *
 * Defaults are added only when the page has something to say (a title, a
 * description, an image or a site URL), so an app with no metadata renders the
 * same head it always did.
 */
import { basePath } from '../importmap.js';
import { withBasePath } from '../base-path.js';

/**
 * The `opengraph-image` / `twitter-image` metadata routes, as
 * `{ prefix, urlPath }` (prefix = the URL segment the route sits in). Set at
 * boot and on every route rebuild, beside the icon routes in head.js.
 * @type {{ og: Array<{ prefix: string, urlPath: string }>, tw: Array<{ prefix: string, urlPath: string }> }}
 */
let _imageRoutes = { og: [], tw: [] };

/**
 * Record the image metadata routes the app defines.
 * @param {Iterable<{ stem: string, urlPath: string }> | null | undefined} metadataRoutes
 */
export function setMetadataImageRoutes(metadataRoutes) {
  /** @type {typeof _imageRoutes} */
  const next = { og: [], tw: [] };
  for (const r of metadataRoutes || []) {
    if (!r || !r.urlPath) continue;
    const list = r.stem === 'opengraph-image' ? next.og : r.stem === 'twitter-image' ? next.tw : null;
    if (!list) continue;
    const prefix = r.urlPath.slice(0, r.urlPath.lastIndexOf('/')) || '/';
    list.push({ prefix, urlPath: r.urlPath });
  }
  // Deepest first, so the nearest route above a page wins.
  next.og.sort((a, b) => b.prefix.length - a.prefix.length);
  next.tw.sort((a, b) => b.prefix.length - a.prefix.length);
  _imageRoutes = next;
}

/**
 * The nearest image route whose segment contains `pathname`.
 * @param {Array<{ prefix: string, urlPath: string }>} list
 * @param {string} pathname
 */
function nearestImageRoute(list, pathname) {
  for (const r of list) {
    if (r.prefix === '/' || pathname === r.prefix || pathname.startsWith(r.prefix + '/')) {
      return withBasePath(r.urlPath, basePath());
    }
  }
  return null;
}

/**
 * The configured public origin of the app: `SITE_URL`, trimmed of a trailing
 * slash, or '' when unset or not an http(s) URL.
 * @returns {string}
 */
export function siteUrlFromEnv() {
  const raw = typeof process !== 'undefined' && process.env ? process.env.SITE_URL : '';
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * `metadataBase` as a string (Next allows a URL object), or ''.
 * @param {unknown} v
 */
function baseString(v) {
  if (v instanceof URL) return v.toString();
  if (typeof v === 'string') return v;
  return '';
}

/** @param {unknown} v */
const hasImage = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

/**
 * Fill in search and share defaults on merged page metadata. Pure apart from
 * reading `SITE_URL` and the recorded image routes; never throws.
 *
 * @param {Record<string, any>} meta merged metadata (not mutated)
 * @param {{ url: string }} ctx the page render context (`url` is the request URL)
 * @returns {Record<string, any>}
 */
export function applySeoDefaults(meta, ctx) {
  /** @type {Record<string, any>} */
  const m = { ...meta };
  let pathname = '/';
  try {
    pathname = new URL(ctx.url).pathname;
  } catch {
    // keep '/'
  }

  const base = baseString(m.metadataBase) || siteUrlFromEnv();
  if (base) m.metadataBase = base;
  else delete m.metadataBase;

  // Canonical: explicit wins, `null` opts out, else site URL + pathname.
  const alternates = m.alternates && typeof m.alternates === 'object' ? { ...m.alternates } : null;
  if (alternates && alternates.canonical === null) {
    delete alternates.canonical;
    m.alternates = alternates;
  } else if (base && (!alternates || alternates.canonical === undefined)) {
    m.alternates = { ...(alternates || {}), canonical: withBasePath(pathname, basePath()) };
  }
  const canonical = m.alternates && m.alternates.canonical;

  const title = typeof m.title === 'string' ? m.title : '';
  const description = typeof m.description === 'string' ? m.description : '';
  const ogImageRoute = nearestImageRoute(_imageRoutes.og, pathname);
  const twImageRoute = nearestImageRoute(_imageRoutes.tw, pathname);

  const og = m.openGraph && typeof m.openGraph === 'object' ? { ...m.openGraph } : null;
  const tw = m.twitter && typeof m.twitter === 'object' ? { ...m.twitter } : null;
  const ogHasImage = og && (hasImage(og.images) || hasImage(og.image));
  const twHasImage = tw && (hasImage(tw.images) || hasImage(tw.image));
  const worthIt = title || description || base || og || tw || ogImageRoute || twImageRoute;
  if (!worthIt) return m;

  const o = og || {};
  if (o.title == null && title) o.title = title;
  if (o.description == null && description) o.description = description;
  if (o.url == null && canonical) o.url = canonical;
  if (o.type == null) o.type = 'website';
  if (!ogHasImage && ogImageRoute) o.images = [ogImageRoute];
  m.openGraph = o;

  const t = tw || {};
  // Without a twitter image, X reads og:image on its own; only the card type
  // needs saying, so the larger preview is used.
  if (!twHasImage && twImageRoute) t.images = [twImageRoute];
  if (t.card == null) {
    const anyImage = hasImage(t.images) || hasImage(t.image) || hasImage(o.images) || hasImage(o.image);
    t.card = anyImage ? 'summary_large_image' : 'summary';
  }
  m.twitter = t;
  return m;
}

/** camelCase -> snake_case for an Open Graph property (`siteName` -> `site_name`). */
const snake = (/** @type {string} */ k) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

/** Open Graph article fields Next exposes in camelCase, emitted as `article:*`. */
const ARTICLE_KEYS = /** @type {Record<string, string>} */ ({
  publishedTime: 'article:published_time',
  modifiedTime: 'article:modified_time',
  expirationTime: 'article:expiration_time',
  authors: 'article:author',
  section: 'article:section',
  tags: 'article:tag',
});

/** Media keys and the property they emit. */
const OG_MEDIA = /** @type {Record<string, string>} */ ({
  images: 'og:image', image: 'og:image',
  videos: 'og:video', video: 'og:video',
  audio: 'og:audio',
});

/**
 * Turn `metadata.openGraph` into `[property, value]` pairs. Accepts both the
 * Next shape (`images` as a string, URL, object or array, camelCase keys,
 * article fields) and the raw `og:<key>` shape (`image`, `site_name`,
 * `'image:width'`).
 *
 * @param {Record<string, any>} og
 * @param {(u: unknown) => string} absUrl
 * @returns {Array<[string, string]>}
 */
export function openGraphPairs(og, absUrl) {
  /** @type {Array<[string, string]>} */
  const out = [];
  for (const [k, v] of Object.entries(og)) {
    if (v == null || v === false || v === '') continue;
    if (OG_MEDIA[k]) {
      mediaPairs(out, OG_MEDIA[k], v, absUrl);
    } else if (ARTICLE_KEYS[k]) {
      for (const item of Array.isArray(v) ? v : [v]) out.push([ARTICLE_KEYS[k], item instanceof Date ? item.toISOString() : String(item)]);
    } else if (k === 'url') {
      out.push(['og:url', absUrl(v)]);
    } else if (Array.isArray(v)) {
      for (const item of v) out.push(['og:' + snake(k), String(item)]);
    } else if (typeof v !== 'object' || v instanceof URL) {
      out.push(['og:' + snake(k), String(v)]);
    }
  }
  return out;
}

/**
 * @param {Array<[string, string]>} out
 * @param {string} prop e.g. `og:image` / `twitter:image`
 * @param {unknown} v string | URL | { url, width, height, alt, type, secureUrl } | array of those
 * @param {(u: unknown) => string} absUrl
 */
function mediaPairs(out, prop, v, absUrl) {
  for (const item of Array.isArray(v) ? v : [v]) {
    if (item == null || item === '') continue;
    if (typeof item === 'string' || item instanceof URL) {
      out.push([prop, absUrl(item)]);
      continue;
    }
    if (typeof item !== 'object') continue;
    const rec = /** @type {Record<string, unknown>} */ (item);
    if (!rec.url) continue;
    out.push([prop, absUrl(rec.url)]);
    for (const [ik, iv] of Object.entries(rec)) {
      if (ik === 'url' || iv == null || iv === '') continue;
      const sub = ik === 'secureUrl' ? 'secure_url' : snake(ik);
      out.push([`${prop}:${sub}`, sub === 'secure_url' ? absUrl(iv) : String(iv)]);
    }
  }
}

/**
 * Turn `metadata.twitter` into `[name, value]` pairs (`images` -> repeated
 * `twitter:image` + `twitter:image:alt`, `siteId` -> `twitter:site:id`).
 *
 * @param {Record<string, any>} tw
 * @param {(u: unknown) => string} absUrl
 * @returns {Array<[string, string]>}
 */
export function twitterPairs(tw, absUrl) {
  /** @type {Array<[string, string]>} */
  const out = [];
  for (const [k, v] of Object.entries(tw)) {
    if (v == null || v === false || v === '') continue;
    if (k === 'images' || k === 'image') {
      for (const item of Array.isArray(v) ? v : [v]) {
        if (typeof item === 'string' || item instanceof URL) out.push(['twitter:image', absUrl(item)]);
        else if (item && typeof item === 'object' && item.url) {
          out.push(['twitter:image', absUrl(item.url)]);
          if (item.alt) out.push(['twitter:image:alt', String(item.alt)]);
        }
      }
    } else if (k === 'siteId' || k === 'creatorId') {
      out.push([`twitter:${k.slice(0, -2)}:id`, String(v)]);
    } else if (typeof v !== 'object') {
      out.push(['twitter:' + k, String(v)]);
    }
  }
  return out;
}
