import { html, asset } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { extraStyleLinks } from '#lib/ui/style-links.ts';
import { audienceAnalytics } from '#modules/ui/sera/audience-analytics.ts';
import { articleDirectory } from '#modules/ui/sera/article-directory.ts';
import { emptyState } from '#modules/ui/sera/empty-state.ts';
import { editArticle } from '#modules/ui/sera/edit-article.ts';
import { mediaLibrary } from '#modules/ui/sera/media-library.ts';
import { mediaLibraryTable } from '#modules/ui/sera/media-library-table.ts';

/**
 * /ui/sera, shadcn/ui's Sera style showcase (#1666), apps/v4/app/(app)/
 * (styles)/sera: the header with its Create link, the six preview screens in
 * the sera style and the taupe theme (modules/ui/sera/), and, below md, the
 * screenshots shadcn shows instead of the previews (public/images/).
 *
 * shadcn loads the five lower screens lazily, client-side, because each is a
 * React tree. Here every screen is server markup, so all six render at once
 * and read with JavaScript off; `content-visibility: auto` on each preview,
 * from shadcn's style.css, keeps the off-screen ones cheap to paint. The
 * theme switcher shadcn's page leaves commented out is left out.
 *
 * The previews' fonts are shadcn's, Noto Sans for text and Playfair Display
 * for headings, self-hosted and declared in public/sera-fonts.css, which only
 * this page links.
 */

const TITLE = 'Introducing Sera';
const DESCRIPTION = 'Minimal. Editorial. Typographic. Underline Controls and Uppercase Headings. Shaped by Print Design Principles.';

export const metadata: Metadata = {
  title: `${TITLE} | WebJs UI`,
  description: DESCRIPTION,
};

// lucide's arrow-right, carrying the data-icon the sera button pads for.
const arrowRight = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon="inline-end"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;

// shadcn's style.css for the page's previews: the fonts, radius 0 (its
// theme-taupe carries it, ours does not), and content-visibility so the
// screens below the fold skip their paint until scrolled to.
const PREVIEWS = "[--font-sans:'Noto_Sans',ui-sans-serif,system-ui,sans-serif] [--font-heading:'Playfair_Display',Georgia,serif] [--radius:0] **:[.preview]:[contain-intrinsic-size:auto_900px] **:[.preview]:[content-visibility:auto]";

/** shadcn's ImagePreview: the screenshots shown below md in place of the previews. */
function imagePreview() {
  return html`<div class="mt-8 flex flex-col overflow-hidden md:hidden">
    ${['sera-01', 'sera-03', 'sera-02', 'sera-06'].map((name) => html`
      <div class="theme-taupe overflow-hidden bg-muted px-4 py-2 first:pt-4 last:pb-4">
        <img src=${`/public/images/${name}-light.png`} alt=${name} width="1440" height="900" loading="lazy" class="h-auto w-full dark:hidden">
        <img src=${`/public/images/${name}-dark.png`} alt=${name} width="1440" height="900" loading="lazy" class="hidden h-auto w-full dark:block">
      </div>`)}
  </div>`;
}

export default function SeraPage() {
  return html`
    ${extraStyleLinks('/ui/sera')}
    <link rel="stylesheet" href=${asset('/public/sera-fonts.css')}>
    <main id="main" tabindex="-1" class="style-sera flex flex-1 flex-col">
      <section class="border-grid">
        <div class="container-wrapper">
          <div class="container flex flex-col items-center gap-2 px-6 py-8 text-center md:py-16 lg:py-20 xl:gap-4">
            <h1 class="leading-tighter max-w-3xl font-heading text-[2.875rem] [--font-heading:'Playfair_Display',Georgia,serif] font-semibold tracking-tight! text-balance text-primary lg:leading-[1.1] lg:font-semibold xl:tracking-tighter">${TITLE}</h1>
            <p class="max-w-2xl text-base text-pretty text-foreground sm:text-lg md:text-balance">${DESCRIPTION}</p>
            <div class="flex w-full items-center justify-center gap-2 pt-2 **:data-[slot=button]:shadow-none **:[.container]:justify-start">
              <a href="/ui/create?preset=b4xFeBLg4O" data-slot="button" data-variant="default" data-size="sm" class=${cn(buttonClass({ size: 'sm' }), 'no-underline')}>
                Open in Create ${arrowRight()}
              </a>
            </div>
          </div>
        </div>
      </section>
      ${imagePreview()}
      <div class=${cn('container-wrapper hidden flex-1 flex-col section-soft px-0 md:flex md:px-2 md:py-12', PREVIEWS)}>
        <div class="container flex flex-1 flex-col gap-10 px-0 3xl:max-w-[2000px] md:px-6">
          ${audienceAnalytics()}
          ${articleDirectory()}
          ${emptyState()}
          ${editArticle()}
          ${mediaLibrary()}
          ${mediaLibraryTable()}
        </div>
      </div>
    </main>
  `;
}
