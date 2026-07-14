import { html, unsafeHTML, notFound } from '@webjsdev/core';
import { getGuide } from '#modules/guides/queries/get-guide.server.ts';
import { renderPostBody } from '#modules/blog/utils/render-post.ts';
import { parseFaq, faqJsonLd } from '#lib/faq.ts';

/**
 * /guides/[slug]
 *
 * Thin route adapter over `modules/guides/`. The markdown body is
 * rendered with the blog's `renderPostBody` (same typography), and the
 * FAQ at the end of the body is BOTH rendered (as normal `##`/`###`
 * markdown) and parsed into a `FAQPage` JSON-LD block, so the structured
 * data always matches what a visitor sees.
 *
 * `generateMetadata` gives each guide its own title / description / og:*
 * tags, a canonical URL at `/guides/<slug>`, and JSON-LD (`TechArticle`
 * + `BreadcrumbList` + optional `FAQPage`), which is what makes these
 * pages eligible for rich results and AI-answer-engine extraction.
 *
 * Deliberately mirrors `app/compare/[slug]/page.ts`.
 */

const SITE_URL = 'https://webjs.dev';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const g = await getGuide(params.slug);
  if (!g) return { title: 'Guide not found · WebJs' };

  const canonical = `${SITE_URL}/guides/${g.slug}`;
  const faq = faqJsonLd(parseFaq(g.body));

  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: g.title,
      description: g.description,
      author: { '@type': 'Person', name: g.author },
      publisher: { '@type': 'Organization', name: 'WebJs', url: SITE_URL },
      datePublished: g.date || undefined,
      mainEntityOfPage: canonical,
      url: canonical,
      keywords: g.keyword,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guides', item: `${SITE_URL}/guides` },
        { '@type': 'ListItem', position: 2, name: g.title, item: canonical },
      ],
    },
  ];
  if (faq) jsonLd.push(faq);

  return {
    title: `${g.title} · WebJs`,
    description: g.description,
    openGraph: {
      title: g.title,
      description: g.description,
      type: 'article',
      url: canonical,
      publishedTime: g.date,
      authors: [g.author],
      tags: g.tags,
    },
    twitter: { card: 'summary_large_image' },
    jsonLd,
  };
}

export default async function GuidePage({ params }: { params: { slug: string } }) {
  const g = await getGuide(params.slug);
  if (!g) notFound();

  return html`
    <main id="main" tabindex="-1" class="max-w-[840px] mx-auto px-[24px] py-[64px] focus:outline-none">
      <nav class="mb-[48px]">
        <a href="/guides" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All guides</a>
      </nav>

      <header class="mb-[64px]">
        <p class="font-mono text-[12px] uppercase tracking-[0.14em] text-accent font-semibold mb-[20px]">Guide</p>
        <h1 class="font-serif text-[clamp(36px,6vw,56px)] leading-[1.05] tracking-tight text-fg m-0 mb-[24px]">${g.title}</h1>
        <p class="text-fg-muted text-[19px] leading-[1.55] m-0 font-serif italic">${g.tagline}</p>
      </header>

      <article class="mt-[16px]">${unsafeHTML(renderPostBody(g.body))}</article>

      <footer class="mt-[104px] pt-[36px] border-t border-border flex flex-wrap gap-x-[24px] gap-y-[12px]">
        <a href="/guides" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All guides</a>
        <a href="/compare" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">Compare WebJs →</a>
      </footer>
    </main>
  `;
}
