// A sitemap INDEX: for a large site split across several sitemaps, this points
// crawlers at each child sitemap. `sitemapIndex(sitemaps)` (from @webjsdev/server)
// serializes the spec-valid <sitemapindex> XML; `sitemap(entries)` serializes one
// child. app/sitemap.ts (the pages) is one child; ./files/route.ts (URLs that are
// not pages) is another. In a real app the children would be sharded (posts,
// products, ...). Build absolute URLs from SITE_URL, your public origin.
import { sitemapIndex } from '@webjsdev/server';

export async function GET(req: Request) {
  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  return new Response(
    sitemapIndex([
      { url: `${site}/sitemap.xml` },
      { url: `${site}/sitemaps/files` },
    ]),
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
}
