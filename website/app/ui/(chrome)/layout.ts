import { html } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import '#components/ui-mode-switcher.ts';
import '#components/ui-mobile-nav.ts';
import '#modules/ui/components/sonner.ts';
import '#components/docs-command-menu.ts';
import { HEADER_NAV } from '#modules/ui/docs/nav.ts';
import { commandMenu } from '#lib/ui/docs/command-menu.ts';
import { GH_URL, NEW_TAB } from '#lib/links.ts';
import { githubLink } from '#lib/ui/github-link.ts';
import { mobileNavLinks } from '#lib/ui/mobile-nav-links.ts';
import { githubStars } from '#modules/ui/queries/github-stars.server.ts';
import { brandMark } from '#lib/design/brand.ts';
import { PlusSignIcon } from '#lib/ui/hugeicons.ts';
import { uiMarkdownHref } from '#lib/ui/llm-path.ts';

/**
 * The /ui chrome: header and footer, ported from shadcn/ui's site
 * (apps/v4/components/site-header.tsx and site-footer.tsx, #1666).
 *
 * It is a route GROUP so the bare iframe targets under /ui/view and
 * /ui/preview, which live outside the group, render with no chrome at all.
 * It is the counterpart of app/(site)/layout.ts, and a navigation between the
 * two sections swaps one for the other with no full page load, because both
 * sit inside the root layout's children range.
 *
 * Two deliberate departures from shadcn. The header is `position: fixed`
 * rather than sticky (#610: sticky flickers on iOS WebKit during a
 * client-router navigation), reserving its height through the same
 * --header-h token the marketing header uses, which public/ui-input.css sets
 * to this header's height (shadcn's --header-height) on a page that has it.
 * Nothing measures the header (#1660). And the identity is WebJs's (the
 * WebJs mark, the name "WebJs UI"), with one credit line in the footer.
 *
 * The link back to webjs.dev carries `data-no-router`, so leaving /ui is a
 * full load, mirroring the marketing side's UI link.
 */

// shadcn's ghost `sm` button with its nav padding (`px-2.5`), written out so
// the chrome does not depend on the kit mirror the gallery previews use.
const ghostSm =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm font-medium no-underline text-foreground outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50';
const separator = html`<div role="none" class="h-4 w-px shrink-0 bg-border"></div>`;

/**
 * Every /ui page names its markdown in the head (#1666), a
 * `<link rel="alternate" type="text/markdown">` to /ui/llm/<path>, so an
 * agent that lands on the HTML finds the text form. Metadata merges by
 * replacing a whole key, so `alternates` here REPLACES the root layout's and
 * restates its canonical, built the same way app/layout.ts builds it.
 */
export function generateMetadata(ctx: { url: string }) {
  const { origin, pathname } = new URL(ctx.url);
  const canonical = origin + (pathname === '/' ? '' : pathname.replace(/\/+$/, ''));
  const markdown = uiMarkdownHref(pathname);
  return {
    alternates: markdown ? { canonical, types: { 'text/markdown': origin + markdown } } : { canonical },
  };
}

export default async function UiChromeLayout({ children, url }: LayoutProps) {
  const { pathname } = new URL(url);
  const stars = await githubStars();

  return html`
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>

    <div class="site-top fixed inset-x-0 top-0 z-50">
    <header class="w-full bg-background">
      <div class="container-wrapper px-6">
        <div class="flex h-(--header-height) items-center">
          <!-- The WebJs mark is the one addition to shadcn's row (the
               identity, D1). Below lg the "Menu" trigger follows it, as
               shadcn's leads its row. -->
          <a href="/ui" class="mr-4 flex shrink-0 items-center gap-2 no-underline text-foreground lg:mr-2" aria-label="WebJs UI home">
            ${brandMark('ui-hdr', { height: 20 })}
            <span class="hidden text-sm font-semibold xl:inline">WebJs UI</span>
          </a>
          <ui-mobile-nav class="flex lg:hidden" label="Toggle Menu">${mobileNavLinks()}</ui-mobile-nav>
          <nav class="hidden items-center gap-0 lg:flex" aria-label="Main">
            ${HEADER_NAV.map((n) => html`<a class=${ghostSm} href=${n.href} aria-current=${pathname === n.href ? 'page' : null}>${n.title}</a>`)}
          </nav>
          <div class="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            ${commandMenu()}
            <div role="none" class="ml-2 hidden h-4 w-px shrink-0 bg-border lg:block"></div>
            ${githubLink(stars)}
            ${separator}
            <ui-mode-switcher></ui-mode-switcher>
            <!-- shadcn's DesignerActions on /ui/create from md: Get Code, the
                 project dialog the page holds (#create-project), opened by
                 its invoker command or, without one, by <create-customizer>.
                 shadcn's "Open in v0" beside it has no WebJs counterpart. -->
            <div class="hidden items-center gap-2 md:[body:has(#create-project)_&]:flex">
              ${separator}
              <button type="button" commandfor="create-project" command="show-modal" data-action="get-code" class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary bg-clip-padding px-2.5 text-sm font-medium whitespace-nowrap text-primary-foreground outline-none transition-all select-none hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px">Get Code</button>
            </div>
            <!-- shadcn's "+ New" button, to the configurator. Hidden on the
                 configurator itself (and the typeset builder), the pages
                 that carry data-slot="designer". -->
            <div class="flex items-center gap-2 [body:has([data-slot=designer])_&]:hidden">
              ${separator}
              <a href="/ui/create" data-new-project class="inline-flex h-[31px] shrink-0 items-center justify-center gap-1 rounded-lg border border-transparent bg-primary bg-clip-padding px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-primary-foreground no-underline outline-none transition-all select-none hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px [&_svg]:size-3.5 [&_svg]:shrink-0">${PlusSignIcon('', 2)}New</a>
            </div>
          </div>
        </div>
      </div>
    </header>
    </div>

    <!-- A page carrying data-slot="designer" (the typeset builder) fills
         exactly the viewport with no footer, shadcn's app layout rule
         (has-data-[slot=designer]:h-svh, the footer hidden). -->
    <div data-slot="layout" class="group/layout relative z-10 flex min-h-[calc(100svh-var(--header-h))] flex-col bg-background has-data-[slot=designer]:h-[calc(100svh-var(--header-h))] has-data-[slot=designer]:overflow-hidden">
      <!-- A div, not main: each page renders its one main landmark itself. -->
      <div class="flex min-h-0 flex-1 flex-col">
        ${children}
      </div>
      <!-- shadcn's SiteFooter rules: none on a designer page or a docs page
           (data-slot="docs"), the soft wash under a section-soft page. -->
      <footer class="group-has-data-[slot=designer]/layout:hidden group-has-[[data-slot=docs]]/layout:hidden group-has-[.section-soft]/layout:bg-surface/40 dark:bg-transparent dark:group-has-[.section-soft]/layout:bg-surface/40">
        <div class="container-wrapper px-4 xl:px-6">
          <div class="flex h-(--footer-height) items-center justify-between">
            <p class="m-0 w-full px-1 text-center text-xs leading-loose text-muted-foreground sm:text-sm">
              Built with <a class="font-medium text-muted-foreground underline underline-offset-4" href="/" data-no-router>WebJs</a>.
              Design and component API ported from <a class="font-medium text-muted-foreground underline underline-offset-4" href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">shadcn/ui${NEW_TAB}</a>, MIT.
              The source code is available on <a class="font-medium text-muted-foreground underline underline-offset-4" href=${GH_URL} target="_blank" rel="noopener noreferrer">GitHub${NEW_TAB}</a>.
            </p>
          </div>
        </div>
      </footer>
    </div>
    <!-- shadcn's root Toaster: one viewport for every /ui page, top center,
         so a docs demo's toast (data-toast, or toast()) has somewhere to
         show. In the new-york style, the docs chrome's. -->
    <span class="style-new-york contents"><ui-sonner position="top-center"></ui-sonner></span>
  `;
}
