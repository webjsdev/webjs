/**
 * SSR / metadata tests for the SEO surfaces (#985, #995).
 *
 * Covers the machine-readable routes (/robots.txt, /llms.txt) and the
 * JSON-LD structured data emitted by the article, compare, blog, and home
 * pages. JSON-LD lives in a page's metadata object (emitted into <head> by
 * the framework), so it is asserted at the `generateMetadata` / `metadata`
 * level rather than by scraping HTML.
 *
 * The keyword-targeted SEO explainers are evergreen articles under
 * `/articles` and carry a `## FAQ` (so each emits `FAQPage`). `/blog` is
 * dated WebJs design notes and carries no FAQ.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from '@webjsdev/core/server';

import Robots from '#app/robots.ts';
import { GET as llmsGet } from '#app/llms.txt/route.ts';
import ArticlesHub from '#app/articles/page.ts';
import { generateMetadata as articleMeta } from '#app/articles/[slug]/page.ts';
import { generateMetadata as compareMeta } from '#app/compare/[slug]/page.ts';
import { generateMetadata as blogMeta } from '#app/blog/[slug]/page.ts';
import * as HomeModule from '#app/page.ts';

const types = (jsonLd: any): string[] => (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).map((o) => o['@type']);

test('/robots.txt allows all and points at the sitemap', () => {
  const txt = Robots();
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, /Allow: \//);
  assert.match(txt, /Sitemap: https:\/\/[^\s]+\/sitemap\.xml/, 'references the absolute sitemap URL');
});

test('/llms.txt lists articles, comparisons, and posts', async () => {
  const res = await llmsGet();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/plain/);
  const body = await res.text();
  assert.match(body, /^# WebJs/m, 'starts with the H1 name');
  assert.match(body, /^> /m, 'has the blockquote summary');
  assert.match(body, /^## Articles$/m, 'has an Articles section');
  assert.match(body, /\/articles\/web-components-framework/, 'lists an article');
  assert.match(body, /\/compare\/webjs-vs-/, 'lists at least one comparison');
  assert.match(body, /\/blog\//, 'lists blog posts');
});

test('the articles hub SSRs evergreen cards (tags, no dates)', async () => {
  const out = await renderToString(await ArticlesHub());
  assert.ok(out.includes('<main id="main"'), 'wraps content in a main landmark');
  assert.match(out, /href="\/articles\/web-components-framework"/, 'links an article');
  assert.ok(out.includes('web components framework'), 'renders a keyword tag on the card');
  // Evergreen: the hub must not surface an ISO date the way a dated blog card would.
  assert.doesNotMatch(out, /\b20\d{2}-\d{2}-\d{2}\b/, 'no dates on the evergreen article cards');
});

test('an article emits TechArticle + BreadcrumbList + FAQPage JSON-LD with canonical, keyword, image', async () => {
  const m = await articleMeta({ params: { slug: 'web-components-framework' } });
  const t = types(m.jsonLd);
  assert.ok(t.includes('TechArticle'), 'has TechArticle');
  assert.ok(t.includes('BreadcrumbList'), 'has BreadcrumbList');
  assert.ok(t.includes('FAQPage'), 'has FAQPage (the article body carries a ## FAQ section)');
  const article = (m.jsonLd as any[]).find((o) => o['@type'] === 'TechArticle');
  assert.equal(article.url, 'https://webjs.dev/articles/web-components-framework', 'canonical self URL');
  assert.equal(article.keywords, 'web components framework', 'carries the target keyword');
  assert.equal(article.image, 'https://webjs.dev/public/og.png', 'Article carries an image for rich results');
});

test('a missing article slug yields a safe not-found metadata, no JSON-LD', async () => {
  const m = await articleMeta({ params: { slug: 'does-not-exist' } });
  assert.match(m.title, /not found/i);
  assert.equal((m as any).jsonLd, undefined, 'no structured data for a missing page');
});

test('a compare page emits TechArticle + BreadcrumbList + FAQPage JSON-LD with a canonical URL', async () => {
  const m = await compareMeta({ params: { slug: 'webjs-vs-nextjs' } });
  const t = types(m.jsonLd);
  assert.ok(t.includes('TechArticle'), 'has TechArticle');
  assert.ok(t.includes('BreadcrumbList'), 'has BreadcrumbList');
  assert.ok(t.includes('FAQPage'), 'has FAQPage (the compare body carries a ## FAQ section)');
  const article = (m.jsonLd as any[]).find((o) => o['@type'] === 'TechArticle');
  assert.equal(article.url, 'https://webjs.dev/compare/webjs-vs-nextjs', 'canonical self URL');
  assert.equal(article.image, 'https://webjs.dev/public/og.png', 'Article carries an image for rich results');
});

test('a blog post emits BlogPosting + BreadcrumbList JSON-LD, and no FAQPage', async () => {
  const m = await blogMeta({ params: { slug: 'why-webjs' } });
  const t = types(m.jsonLd);
  assert.ok(t.includes('BlogPosting'), 'has BlogPosting');
  assert.ok(t.includes('BreadcrumbList'), 'has BreadcrumbList');
  // Blog posts are WebJs design notes and carry no ## FAQ section, so no
  // FAQPage. The FAQPage code path is exercised by /articles and /compare.
  assert.ok(!t.includes('FAQPage'), 'blog posts carry no FAQ, so no FAQPage');
  const article = (m.jsonLd as any[]).find((o) => o['@type'] === 'BlogPosting');
  assert.equal(article.url, 'https://webjs.dev/blog/why-webjs', 'canonical self URL');
  assert.equal(article.image, 'https://webjs.dev/public/og.png', 'Article carries an image for rich results');
});

test('a missing blog slug yields a safe not-found metadata, no JSON-LD', async () => {
  const m = await blogMeta({ params: { slug: 'does-not-exist' } });
  assert.match(m.title, /not found/i);
  assert.equal((m as any).jsonLd, undefined, 'no structured data for a missing page');
});

test('the home page contributes WebSite + Organization + SoftwareApplication JSON-LD only', () => {
  const t = types(HomeModule.metadata.jsonLd);
  assert.ok(t.includes('WebSite'), 'has WebSite');
  assert.ok(t.includes('Organization'), 'has Organization');
  assert.ok(t.includes('SoftwareApplication'), 'has SoftwareApplication');
  // Counterfactual for the title-split guard: the home metadata sets no title.
  assert.equal((HomeModule.metadata as any).title, undefined, 'home metadata does not override the title');
});
