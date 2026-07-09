import { html, unsafeHTML, notFound } from '@webjsdev/core';
import { getComparison } from '#modules/compare/queries/get-comparison.server.ts';
import { renderPostBody } from '#modules/blog/utils/render-post.ts';
import { NEW_TAB } from '#lib/links.ts';

/**
 * /compare/[slug]
 *
 * Thin route adapter. File-reading and frontmatter parsing live in
 * `modules/compare/`. The markdown body is rendered with the blog's
 * `renderPostBody` (same typography, no need for a second renderer).
 *
 * `generateMetadata` gives each comparison its own title / description /
 * og:* tags, with a canonical URL at `/compare/<slug>`, which is what
 * makes these pages rank for "WebJs vs <framework>" queries.
 */

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await getComparison(params.slug);
  if (!c) return { title: 'Comparison not found · webjs' };
  return {
    title: `${c.title} · webjs`,
    description: c.description,
    openGraph: {
      title: c.title,
      description: c.description,
      type: 'article',
      url: `https://webjs.dev/compare/${c.slug}`,
      publishedTime: c.date,
      authors: [c.author],
      tags: c.tags,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function ComparePage({ params }: { params: { slug: string } }) {
  const c = await getComparison(params.slug);
  if (!c) notFound();

  return html`
    <main id="main" tabindex="-1" class="max-w-[840px] mx-auto px-[24px] py-[64px] focus:outline-none">
      <nav class="mb-[48px]">
        <a href="/compare" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All comparisons</a>
      </nav>

      <header class="mb-[64px]">
        <p class="font-mono text-[12px] uppercase tracking-[0.14em] text-accent font-semibold mb-[20px]">WebJs vs ${c.competitor}</p>
        <h1 class="font-serif text-[clamp(36px,6vw,56px)] leading-[1.05] tracking-tight text-fg m-0 mb-[24px]">${c.title}</h1>
        <p class="text-fg-muted text-[19px] leading-[1.55] m-0 font-serif italic">${c.tagline}</p>
        ${c.link
          ? html`<p class="mt-[20px] m-0">
              <a href=${c.link} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-[6px] font-mono text-[13px] text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors">
                Visit the ${c.competitor} site
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>${NEW_TAB}
              </a>
            </p>`
          : ''}
      </header>

      <article class="mt-[16px]">${unsafeHTML(renderPostBody(c.body))}</article>

      <footer class="mt-[104px] pt-[36px] border-t border-border flex flex-wrap gap-x-[24px] gap-y-[12px]">
        <a href="/compare" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All comparisons</a>
        <a href="/blog" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">Read the blog →</a>
      </footer>
    </main>
  `;
}
