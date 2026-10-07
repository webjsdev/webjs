// A child sitemap built by hand with `sitemap(entries)`: for URLs that are not
// pages (a feed, a downloadable file), which `pages()` in app/sitemap.ts cannot
// know about. Each entry is { url, lastModified?, changeFrequency?, priority? };
// the helper escapes every URL and drops a malformed entry instead of emitting
// broken XML.
import { sitemap } from '@webjsdev/server';

export async function GET(req: Request) {
  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  return new Response(
    sitemap([{ url: `${site}/manifest.json`, changeFrequency: 'yearly', priority: 0.1 }]),
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
}
