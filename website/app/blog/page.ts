import { html } from '@webjsdev/core';
import { listPosts } from '../../modules/blog/queries/list-posts.server.ts';

/**
 * /blog
 *
 * Thin route adapter. All the file-reading and frontmatter-parsing
 * lives in `modules/blog/queries/list-posts.server.ts`. This page
 * just renders the result.
 */

export const metadata = {
  title: 'Blog · webjs',
  description: 'Long-form notes from building webjs: the design decisions, the trade-offs, the things that did not work, and what the framework looks like in production.',
};

export default async function Blog() {
  const posts = await listPosts();
  return html`
    <main id="main" tabindex="-1" class="max-w-[840px] mx-auto px-6 py-12 focus:outline-none">
      <header class="mb-10">
        <p class="font-mono text-[11px] uppercase tracking-[0.15em] text-accent font-semibold mb-2">Blog</p>
        <h1 class="font-serif text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-tight text-fg mb-3">Notes from building webjs</h1>
        <p class="text-fg-muted text-[15px] leading-relaxed max-w-[640px]">
          Long-form posts on the design decisions, the trade-offs, the things that did not work, and what the framework looks like in production.
        </p>
      </header>

      ${posts.length === 0
        ? html`<p class="text-fg-subtle italic">No posts yet.</p>`
        : posts.map((p) => html`
            <article class="border border-border rounded-xl bg-bg-elev p-5 sm:p-6 mb-5 shadow-sm transition-colors hover:border-border-strong">
              <a href=${'/blog/' + p.slug} class="block no-underline text-fg">
                <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                  <time class="font-mono text-[11.5px] text-fg-subtle tracking-tight">${p.date.slice(0, 10)}</time>
                  ${p.tags.length > 0
                    ? p.tags.map((t) => html`<span class="bg-fg-subtle/10 text-fg-subtle font-mono text-[10.5px] uppercase tracking-[0.1em] px-2 py-0.5 rounded">${t}</span>`)
                    : ''}
                </header>
                <h2 class="font-serif text-[clamp(20px,3vw,26px)] leading-[1.15] tracking-tight text-fg m-0 mb-2">${p.title}</h2>
                <p class="text-fg-muted text-[14.5px] leading-relaxed m-0">${p.description}</p>
              </a>
            </article>
          `)}
    </main>
  `;
}
