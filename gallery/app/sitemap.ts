// app/sitemap.ts serves /sitemap.xml. The route receives `{ pages, siteUrl, ... }`
// and may return an ARRAY of entries, which the server serializes to spec-valid
// XML. `pages()` lists every public page of the app: each static page, each
// dynamic page that exports `generateSitemapParams()` (the params it serves,
// usually from a query), and none whose metadata says `robots: { index: false }`.
// So adding a page adds it here with no edit. URLs use SITE_URL (your public
// origin) when it is set, else the request origin. Append data-driven entries
// that are not pages (a feed, a file) to the array.
import type { MetadataRouteContext } from '@webjsdev/server';

export default async function Sitemap({ pages }: MetadataRouteContext) {
  return pages();
}
