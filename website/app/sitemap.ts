import { sitemap } from '@webjsdev/server';
import { listComparisons } from '#modules/compare/queries/list-comparisons.server.ts';
import { listPosts } from '#modules/blog/queries/list-posts.server.ts';
import { listGuides } from '#modules/guides/queries/list-guides.server.ts';

/**
 * /sitemap.xml
 *
 * Serialized from the live content queries so newly added comparison,
 * guide, and blog markdown is discoverable without touching this file.
 * The compare and guide pages are the SEO reason this exists: each
 * `/compare/<slug>` and `/guides/<slug>` is a canonical page we want
 * search engines to crawl and index.
 *
 * `SITE_URL` falls back to the production origin; override it per
 * deployment the same way the header/footer links are configured.
 */
const SITE_URL = ((globalThis as any).process?.env?.SITE_URL || 'https://webjs.dev').replace(/\/$/, '');

export default async function Sitemap() {
  const [comparisons, guides, posts] = await Promise.all([listComparisons(), listGuides(), listPosts()]);

  const staticRoutes = ['/', '/blog', '/compare', '/guides', '/why', '/changelog'].map((path) => ({
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

  const guideRoutes = guides.map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    lastModified: g.date || undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const blogRoutes = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.date || undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return sitemap([...staticRoutes, ...compareRoutes, ...guideRoutes, ...blogRoutes]);
}
