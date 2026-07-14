/**
 * /robots.txt
 *
 * Metadata route (default-exports a function returning a string, served
 * as text/plain at /robots.txt). Allows all crawlers and points them at
 * the sitemap, which enumerates every page, blog post, and comparison.
 * There is nothing private on the marketing site, so a blanket
 * allow is correct; the internal `/__webjs/*` action endpoints are POST
 * RPC routes with no crawlable GET surface, so they need no disallow.
 *
 * `SITE_URL` mirrors app/sitemap.ts so the two agree on the origin.
 */
const SITE_URL = ((globalThis as any).process?.env?.SITE_URL || 'https://webjs.dev').replace(/\/$/, '');

export default function Robots(): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}
