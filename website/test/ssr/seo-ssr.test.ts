/**
 * SSR / metadata tests for the SEO surfaces (#985).
 *
 * Covers the machine-readable routes (/robots.txt, /llms.txt) and the
 * JSON-LD structured data emitted by the compare, blog, and home pages.
 * JSON-LD lives in a page's metadata object (emitted into <head> by the
 * framework), so it is asserted at the `generateMetadata` / `metadata`
 * level rather than by scraping HTML.
 *
 * The keyword-targeted SEO explainer articles live under /blog (there is
 * no separate /guides section); a blog post that carries a `## FAQ`
 * section gets a FAQPage block on top of the usual BlogPosting.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import Robots from '#app/robots.ts';
import { GET as llmsGet } from '#app/llms.txt/route.ts';
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

test('/llms.txt is a valid llmstxt.org document listing comparisons and posts', async () => {
  const res = await llmsGet();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/plain/);
  const body = await res.text();
  assert.match(body, /^# WebJs/m, 'starts with the H1 name');
  assert.match(body, /^> /m, 'has the blockquote summary');
  assert.match(body, /\/compare\/webjs-vs-/, 'lists at least one comparison');
  assert.match(body, /\/blog\//, 'lists blog posts');
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
  const m = await blogMeta({ params: { slug: 'web-components-framework' } });
  const t = types(m.jsonLd);
  assert.ok(t.includes('BlogPosting'), 'has BlogPosting');
  assert.ok(t.includes('BreadcrumbList'), 'has BreadcrumbList');
  // Blog posts do not carry a ## FAQ section (that reads as SEO-marketing and
  // is not the author's style), so no FAQPage is emitted. The FAQPage code
  // path is still exercised by the /compare pages, which do carry FAQs.
  assert.ok(!t.includes('FAQPage'), 'blog posts carry no FAQ, so no FAQPage');
  const article = (m.jsonLd as any[]).find((o) => o['@type'] === 'BlogPosting');
  assert.equal(article.url, 'https://webjs.dev/blog/web-components-framework', 'canonical self URL');
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
