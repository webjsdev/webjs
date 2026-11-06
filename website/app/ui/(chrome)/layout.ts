import { html, cspNonce } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import '#components/theme-toggle.ts';
import '#components/site-nav-menu.ts';
import '#components/docs-command-menu.ts';
import { HEADER_NAV } from '#modules/ui/docs/nav.ts';
import { commandMenu } from '#lib/ui/docs/command-menu.ts';
import { GH_URL, NEW_TAB } from '#lib/links.ts';
import { brandMark } from '#lib/design/brand.ts';

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
 * client-router navigation), reserving its height through the same measured
 * --header-h the marketing header uses. And the identity is WebJs's (the
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
const panelLink = 'rounded-md px-3 py-2.5 text-sm font-medium no-underline text-foreground hover:bg-accent';

const githubIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true" class="size-4 fill-current"><path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3"/></svg>`;

export default function UiChromeLayout({ children, url }: LayoutProps) {
  const nonce = cspNonce();
  const { pathname } = new URL(url);

  return html`
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>

    <div class="site-top fixed inset-x-0 top-0 z-50">
    <header class="w-full bg-background">
      <div class="container-wrapper px-6">
        <div class="flex h-(--header-height) items-center gap-2">
          <a href="/ui" class="mr-2 flex shrink-0 items-center gap-2 no-underline text-foreground" aria-label="WebJs UI home">
            ${brandMark('ui-hdr', { height: 20 })}
            <span class="hidden text-sm font-semibold sm:inline">WebJs UI</span>
          </a>
          <nav class="hidden items-center gap-0 lg:flex" aria-label="Main">
            ${HEADER_NAV.map((n) => html`<a class=${ghostSm} href=${n.href} aria-current=${pathname === n.href ? 'page' : null}>${n.title}</a>`)}
          </nav>
          <div class="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            ${commandMenu()}
            <div role="none" class="ml-2 hidden h-4 w-px shrink-0 bg-border lg:block"></div>
            <a class=${ghostSm} href=${GH_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">${githubIcon}${NEW_TAB}</a>
            ${separator}
            <theme-toggle></theme-toggle>
            ${separator}
            <a class=${ghostSm} href="/" data-no-router>webjs.dev</a>
            <site-nav-menu class="lg:hidden" label="Toggle navigation">
              ${HEADER_NAV.map((n) => html`<a class=${panelLink} href=${n.href}>${n.title}</a>`)}
            </site-nav-menu>
          </div>
        </div>
      </div>
    </header>
    </div>
    <script nonce=${nonce}>
      (function(){
        try {
          var w = window;
          if (w.__wjHeaderRO) { w.__wjHeaderRO.disconnect(); w.__wjHeaderRO = null; }
          var bars = document.querySelectorAll('.site-top');
          var bar = bars[bars.length - 1];
          if (!bar) return;
          var apply = function(){ document.documentElement.style.setProperty('--header-h', bar.offsetHeight + 'px'); };
          apply();
          if (w.ResizeObserver) { w.__wjHeaderRO = new ResizeObserver(apply); w.__wjHeaderRO.observe(bar); }
        } catch (_) {}
      })();
    </script>

    <div data-slot="layout" class="relative z-10 flex min-h-[calc(100svh-var(--header-h))] flex-col bg-background">
      <!-- A div, not main: each page renders the one main landmark, id="main",
           itself (the interim gallery's shell does it in components/docs-drawer.ts,
           and the home page wraps its own content). -->
      <div class="flex min-h-0 flex-1 flex-col">
        ${children}
      </div>
      <footer>
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
  `;
}
