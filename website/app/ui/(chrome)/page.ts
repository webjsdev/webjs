import { html, asset } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { cn } from '#lib/utils/cn.ts';
import { extraStyleLinks } from '#lib/ui/style-links.ts';
import { cardsDemo } from '#modules/ui/home/cards-demo.ts';
import { announcement } from '#lib/ui/ui-page-header.ts';
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
 * is the one every /ui section page shows (lib/ui/ui-page-header.ts), shadcn's
 * current text, which names parts this kit ships too.
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

export default function UiHome({ url }: Pick<PageProps, 'url'>) {
  const { pathname } = new URL(url);
  return html`
    ${extraStyleLinks(pathname)}
    <main id="main" tabindex="-1" class="flex flex-1 flex-col">
      <section class="border-grid md:**:[.container]:pb-8 lg:**:[.container]:pb-12">
        <div class="container-wrapper">
          <div class="container flex flex-col items-center gap-2 px-6 py-8 text-center md:py-16 lg:py-20 xl:gap-4">
            ${announcement()}
            <h1 class="leading-tighter max-w-4xl text-3xl font-semibold tracking-tight text-balance text-primary lg:leading-[1.1] lg:font-semibold xl:text-5xl xl:tracking-tighter">${TITLE}</h1>
            <p class="max-w-4xl text-base text-balance text-foreground sm:text-lg">${DESCRIPTION}</p>
            <div class="style-luma flex w-full items-center justify-center gap-2 pt-2 **:data-[slot=button]:shadow-none">
              <a href="/ui/docs/installation" data-slot="button" class=${cn(buttonClass(), 'h-[35px] no-underline')}>Get Started</a>
              <a href="/ui/docs/components" data-slot="button" class=${cn(buttonClass({ variant: 'secondary' }), 'no-underline')}>View Components</a>
            </div>
          </div>
        </div>
      </section>
      <div class="container-wrapper flex-1 p-0">
        <div class="container overflow-hidden md:px-0 lg:max-w-none">
          <!-- Below md shadcn shows a picture of the grid rather than the
               grid itself, wider than the screen and cropped, in each
               theme (scripts/shoot-home-cards.mjs takes it from this page). -->
          <section class="-mx-4 w-[140vw] overflow-hidden md:hidden">
            <img src=${asset('/public/images/home-cards-light.png')} width="2560" height="2764" alt="WebJs UI components in a dashboard" class="block h-auto w-full dark:hidden">
            <img src=${asset('/public/images/home-cards-dark.png')} width="2560" height="2764" alt="WebJs UI components in a dashboard" class="hidden h-auto w-full dark:block">
          </section>
          <section class="style-rhea hidden md:block">
            ${cardsDemo()}
          </section>
        </div>
      </div>
    </main>
  `;
}
