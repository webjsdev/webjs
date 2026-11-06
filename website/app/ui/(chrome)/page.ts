import { html } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { cn } from '#lib/utils/cn.ts';
import { extraStyleLinks } from '#lib/ui/style-links.ts';
import { cardsDemo } from '#modules/ui/home/cards-demo.ts';
// The card grid's interactive parts. A page never hydrates, so it imports
// the elements its markup uses to register them.
import '#modules/ui/components/alert-dialog.ts';
import '#modules/ui/components/dropdown-menu.ts';
import '#modules/ui/components/select.ts';
import '#modules/ui/components/switch.ts';
import '#components/message-scroller-demo.ts';

/**
 * The /ui home page, ported from shadcn/ui's
 * apps/v4/app/(app)/(root)/page.tsx (#1666).
 *
 * The layout, type and card grid are shadcn's. The copy is true for WebJs UI
 * (D1): the headline and description hold as they are, and the announcement
 * names what this kit shipped rather than shadcn's release.
 *
 * The hero's two buttons render in shadcn's luma style and the card grid in
 * rhea, exactly as shadcn's home does, so this page links both of those
 * stylesheets (lib/ui/style-links.ts).
 */

const TITLE = 'The Foundation for your Design System';
const DESCRIPTION =
  'Composable, accessible components with thoughtful defaults. Build your own component library with code you can customize, extend, and make your own.';

export const metadata: Metadata = {
  title: `WebJs UI | ${TITLE}`,
  description: DESCRIPTION,
};

// lucide's arrow-right, which shadcn's announcement badge uses.
const arrowRight = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;

export default function UiHome({ url }: Pick<PageProps, 'url'>) {
  const { pathname } = new URL(url);
  return html`
    ${extraStyleLinks(pathname)}
    <main id="main" class="flex flex-1 flex-col">
      <section class="border-grid md:**:[.container]:pb-8 lg:**:[.container]:pb-12">
        <div class="container-wrapper">
          <div class="container flex flex-col items-center gap-2 px-6 py-8 text-center md:py-16 lg:py-20 xl:gap-4">
            <span class="style-new-york contents">
              <a href="/changelog" data-slot="badge" class=${cn(badgeClass({ variant: 'secondary' }), 'bg-muted no-underline')}>
                Sidebar, Carousel and Code Block ${arrowRight}
              </a>
            </span>
            <h1 class="leading-tighter max-w-4xl text-3xl font-semibold tracking-tight text-balance text-primary lg:leading-[1.1] lg:font-semibold xl:text-5xl xl:tracking-tighter">${TITLE}</h1>
            <p class="max-w-4xl text-base text-balance text-foreground sm:text-lg">${DESCRIPTION}</p>
            <div class="style-luma flex w-full items-center justify-center gap-2 pt-2 **:data-[slot=button]:shadow-none">
              <a href="/ui/docs" data-slot="button" class=${cn(buttonClass(), 'h-[35px] no-underline')}>Get Started</a>
              <a href="/ui/docs" data-slot="button" class=${cn(buttonClass({ variant: 'secondary' }), 'no-underline')}>View Components</a>
            </div>
          </div>
        </div>
      </section>
      <div class="container-wrapper flex-1 p-0">
        <div class="container overflow-hidden md:px-0 lg:max-w-none">
          <section class="style-rhea">
            ${cardsDemo()}
          </section>
        </div>
      </div>
    </main>
  `;
}
