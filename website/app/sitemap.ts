import { sitemap } from '@webjsdev/server';
import { listComparisons } from '#modules/compare/queries/list-comparisons.server.ts';
import { listPosts } from '#modules/blog/queries/list-posts.server.ts';

/**
 * /sitemap.xml
 *
 * Serialized from the live content queries so newly added comparison and
 * blog markdown is discoverable without touching this file. The compare
 * pages are the SEO reason this exists: each `/compare/<slug>` is a
 * canonical head-to-head we want search engines to crawl and index.
 *
 * `SITE_URL` falls back to the production origin; override it per
 * deployment the same way the header/footer links are configured.
 */
const SITE_URL = ((globalThis as any).process?.env?.SITE_URL || 'https://webjs.dev').replace(/\/$/, '');

export default async function Sitemap() {
  const [comparisons, posts] = await Promise.all([listComparisons(), listPosts()]);

  const staticRoutes = ['/', '/blog', '/compare', '/changelog'].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '/' ? 1.0 : 0.7,
  }));

  const compareRoutes = comparisons.map((c) => ({
    url: `${SITE_URL}/compare/${c.slug}`,
    lastModified: c.date || undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const blogRoutes = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.date || undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return sitemap([...staticRoutes, ...compareRoutes, ...blogRoutes]);
}
