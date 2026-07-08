import { html, unsafeHTML, notFound } from '@webjsdev/core';
import { getPost } from '#modules/blog/queries/get-post.server.ts';
import { renderPostBody } from '#modules/blog/utils/render-post.ts';

/**
 * /blog/[slug]
 *
 * Thin route adapter. File-reading, frontmatter parsing, and markdown
 * rendering live in `modules/blog/`. This page composes them.
 *
 * `generateMetadata` derives <head> from the post's frontmatter so
 * each post gets its own title / description / og:* tags for SEO.
 * Canonical URL per post at `/blog/<slug>`.
 */

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) return { title: 'Post not found · webjs' };
  return {
    title: `${post.title} · WebJs blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: `https://webjs.dev/blog/${post.slug}`,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  return html`
    <main id="main" tabindex="-1" class="max-w-[840px] mx-auto px-[24px] py-[64px] focus:outline-none">
      <nav class="mb-[48px]">
        <a href="/blog" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All posts</a>
      </nav>

      <header class="mb-[64px]">
        <div class="flex flex-wrap items-center gap-x-[12px] gap-y-[8px] mb-[24px]">
          <time class="font-mono text-[12.5px] text-fg-subtle tracking-tight">${post.date.slice(0, 10)}</time>
          <span class="text-fg-subtle/40 text-[12px]">·</span>
          <span class="font-mono text-[12.5px] text-fg-subtle">By ${post.author}</span>
          ${post.tags.length > 0 ? html`<span class="text-fg-subtle/40 text-[12px]">·</span>` : ''}
          ${post.tags.map((t) => html`<span class="bg-fg-subtle/10 text-fg-subtle font-mono text-[10.5px] uppercase tracking-[0.12em] px-[8px] py-[2px] rounded">${t}</span>`)}
        </div>
        <h1 class="font-serif text-[clamp(36px,6vw,56px)] leading-[1.05] tracking-tight text-fg m-0 mb-[24px]">${post.title}</h1>
        <p class="text-fg-muted text-[19px] leading-[1.55] m-0 font-serif italic">${post.description}</p>
      </header>

      <article class="mt-[16px]">${unsafeHTML(renderPostBody(post.body))}</article>

      <footer class="mt-[104px] pt-[36px] border-t border-border">
        <a href="/blog" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All posts</a>
      </footer>
    </main>
  `;
}
