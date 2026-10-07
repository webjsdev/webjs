// app/robots.ts serves /robots.txt. `robots()` from @webjsdev/server writes the
// file from Next's robots object (returning the bare object works too; the
// server runs it through the same helper). `siteUrl` is SITE_URL (your public
// origin) when set, else the request origin, so the Sitemap line is always
// absolute. Disallow signed-in areas and API paths, and mark those pages
// `robots: { index: false }` too, so a crawler that follows a link still does
// not index them.
import { robots } from '@webjsdev/server';
import type { MetadataRouteContext } from '@webjsdev/server';

export default function Robots({ siteUrl }: MetadataRouteContext) {
  return robots({
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/sitemaps`],
  });
}
