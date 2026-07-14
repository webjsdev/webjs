import { html } from '@webjsdev/core';
import { listGuides } from '#modules/guides/queries/list-guides.server.ts';

/**
 * /guides
 *
 * The guides hub: keyword-targeted explainer pages ("what is an AI-first
 * web framework", "what is a web components framework", and so on). Thin
 * route adapter over `modules/guides/queries/list-guides.server.ts`,
 * deliberately mirroring the `/compare` hub so the two content clusters
 * read as siblings. Each card links to `/guides/<slug>`, the long-form
 * explainer where the SEO value sits.
 *
 * This hub is the single tasteful home the site chrome links to (rather
 * than dumping raw keyword phrases into the header nav), and it can rank
 * for broader "WebJs guides" queries in its own right.
 *
 * Guides exist ONLY where there is real search demand for the term. A
 * topic with no matching search intent does not belong here (it lives on
 * the home page, /why, or the blog instead).
 */

export const metadata = {
  title: 'WebJs guides: web components, no-build, and web standards · WebJs',
  description: 'Plain-English explainers on the ideas behind WebJs: what a web components framework is, building a full-stack app without a build step, and progressive enhancement on web standards.',
};

export default async function Guides() {
  const guides = await listGuides();
  return html`
    <main id="main" tabindex="-1" class="max-w-[840px] mx-auto px-6 py-12 focus:outline-none">
      <header class="mb-10">
        <p class="font-mono text-[11px] uppercase tracking-[0.15em] text-accent font-semibold mb-2">Guides</p>
        <h1 class="font-serif text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-tight text-fg mb-3">Guides</h1>
        <p class="text-fg-muted text-[15px] leading-relaxed max-w-[640px]">
          Plain-English explainers on the ideas WebJs is built on: what it means to build on web components, how a full-stack app runs with no build step, and how progressive enhancement works on web standards. Read these to understand the why before the how.
        </p>
      </header>

      ${guides.length === 0
        ? html`<p class="text-fg-subtle italic">No guides yet.</p>`
        : guides.map((g) => html`
            <article class="border border-border rounded-xl bg-bg-elev p-5 sm:p-6 mb-5 shadow-sm transition-colors hover:border-border-strong">
              <a href=${'/guides/' + g.slug} class="block no-underline text-fg">
                ${g.tags.length > 0
                  ? html`<header class="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
                      ${g.tags.map((t) => html`<span class="bg-fg-subtle/10 text-fg-subtle font-mono text-[10.5px] uppercase tracking-[0.1em] px-2 py-0.5 rounded">${t}</span>`)}
                    </header>`
                  : ''}
                <h2 class="font-serif text-[clamp(20px,3vw,26px)] leading-[1.15] tracking-tight text-fg m-0 mb-2">${g.title}</h2>
                <p class="text-fg-muted text-[14.5px] leading-relaxed m-0">${g.description || g.tagline}</p>
              </a>
            </article>
          `)}
    </main>
  `;
}
