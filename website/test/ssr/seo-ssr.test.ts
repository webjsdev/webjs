/**
 * SSR / metadata tests for the SEO surfaces (#985).
 *
 * Covers the new machine-readable routes (/robots.txt, /llms.txt), the
 * guides cluster, and the JSON-LD structured data emitted by the compare,
 * blog, guide, and home pages. JSON-LD lives in a page's metadata object
 * (emitted into <head> by the framework), so it is asserted at the
 * `generateMetadata` / `metadata` level rather than by scraping HTML.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from '@webjsdev/core/server';

import Robots from '#app/robots.ts';
import { GET as llmsGet } from '#app/llms.txt/route.ts';
import GuidesHub from '#app/guides/page.ts';
import { generateMetadata as guideMeta } from '#app/guides/[slug]/page.ts';
import { generateMetadata as compareMeta } from '#app/compare/[slug]/page.ts';
import * as HomeModule from '#app/page.ts';

const types = (jsonLd: any): string[] => (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).map((o) => o['@type']);

test('/robots.txt allows all and points at the sitemap', () => {
  const txt = Robots();
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, /Allow: \//);
  assert.match(txt, /Sitemap: https:\/\/[^\s]+\/sitemap\.xml/, 'references the absolute sitemap URL');
});

test('/llms.txt is a valid llmstxt.org document listing guides and comparisons', async () => {
  const res = await llmsGet();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/plain/);
  const body = await res.text();
  assert.match(body, /^# WebJs/m, 'starts with the H1 name');
  assert.match(body, /^> /m, 'has the blockquote summary');
  assert.match(body, /\/guides\/web-components-framework/, 'lists the web components guide');
  assert.match(body, /\/compare\/webjs-vs-/, 'lists at least one comparison');
  // Guides must be ENUMERATED from listGuides (each line carries the guide's
  // tagline), not a hardcoded list. Counterfactual: a hardcoded guides block
  // would drop this tagline suffix, and a newly added guide would silently
  // never appear in /llms.txt.
  assert.match(body, /\/guides\/web-components-framework\): Build your UI on the browser/, 'guide line includes the enumerated tagline');
});

test('the guides hub SSRs cards for the published guides', async () => {
  const out = await renderToString(await GuidesHub());
  assert.ok(out.includes('<main id="main"'), 'wraps content in a main landmark');
  assert.match(out, /href="\/guides\/web-components-framework"/, 'links the web components guide');
});

test('a guide page emits TechArticle + BreadcrumbList + FAQPage JSON-LD with a canonical URL', async () => {
  const m = await guideMeta({ params: { slug: 'web-components-framework' } });
  const t = types(m.jsonLd);
  assert.ok(t.includes('TechArticle'), 'has TechArticle');
  assert.ok(t.includes('BreadcrumbList'), 'has BreadcrumbList');
  assert.ok(t.includes('FAQPage'), 'has FAQPage (the guide body carries a ## FAQ section)');
  const article = (m.jsonLd as any[]).find((o) => o['@type'] === 'TechArticle');
  assert.equal(article.url, 'https://webjs.dev/guides/web-components-framework', 'canonical self URL');
  assert.equal(article.keywords, 'web components framework', 'carries the target keyword');
});

test('a compare page emits TechArticle + BreadcrumbList + FAQPage JSON-LD', async () => {
  const m = await compareMeta({ params: { slug: 'webjs-vs-nextjs' } });
  const t = types(m.jsonLd);
  assert.ok(t.includes('TechArticle'), 'has TechArticle');
  assert.ok(t.includes('BreadcrumbList'), 'has BreadcrumbList');
  assert.ok(t.includes('FAQPage'), 'has FAQPage (the compare body carries a ## FAQ section)');
});

test('a missing guide slug yields a safe not-found metadata, no JSON-LD', async () => {
  const m = await guideMeta({ params: { slug: 'does-not-exist' } });
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
