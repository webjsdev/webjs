import { listComparisons } from '#modules/compare/queries/list-comparisons.server.ts';
import { listPosts } from '#modules/blog/queries/list-posts.server.ts';

/**
 * GET /llms.txt
 *
 * A machine-readable overview of WebJs for LLMs and AI coding agents,
 * following the llmstxt.org convention (an H1 name, a `>` blockquote
 * summary, then `##` link sections). On-brand for an AI-first framework:
 * the same agents the framework is built for get a canonical, curated
 * entry point instead of scraping the rendered HTML.
 *
 * A route handler (not a metadata route) because `/llms.txt` is not one
 * of the framework's metadata stems. It is server-only, so it imports the
 * content queries directly and lists every live comparison + recent post.
 *
 * `SITE_URL` mirrors app/sitemap.ts and app/robots.ts so all three agree
 * on the origin. `DOCS_URL` points at the separate docs site.
 */
const env = (globalThis as any).process?.env ?? {};
const SITE_URL = (env.SITE_URL || 'https://webjs.dev').replace(/\/$/, '');
const DOCS_URL = (env.DOCS_URL || 'https://docs.webjs.dev').replace(/\/$/, '');

export async function GET(): Promise<Response> {
  const [comparisons, posts] = await Promise.all([listComparisons(), listPosts()]);

  const lines: string[] = [
    '# WebJs',
    '',
    '> An AI-first, web-components-first full-stack web framework with no build step. Pages are server-rendered and progressively enhanced; components are native custom elements that hydrate as islands. Server actions give typed client-to-server RPC. Runs on Node 24+ or Bun.',
    '',
    'WebJs is inspired by Next.js, Lit, and Rails, but ships its own no-build runtime: TypeScript is stripped at load, ES modules are served directly, and the view layer is web components rather than React. It is designed to be read end to end by AI coding agents.',
    '',
    '## Docs',
    `- [Getting started](${DOCS_URL}/docs/getting-started): install, scaffold, and run your first app`,
    `- [Documentation](${DOCS_URL}/docs): the full reference`,
    '',
    '## Comparisons',
    ...comparisons.map((c) => `- [WebJs vs ${c.competitor}](${SITE_URL}/compare/${c.slug}): ${c.tagline}`),
    '',
    '## Blog',
    ...posts.slice(0, 20).map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug})`),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
