import { html, asset } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import '#components/theme-toggle.ts';
import '#components/site-nav-menu.ts';
import { DOCS_START_PATH, UI_PATH, GALLERY_URL, GH_URL, NEW_TAB } from '#lib/links.ts';
import { siteFooter } from '#lib/ui/site-footer.ts';
import { brandLockup } from '#lib/design/brand.ts';

/**
 * Chrome for the marketing site: the skip link, the glow layer, the fixed
 * header, the content wrapper and the footer.
 *
 * It lives in a route group rather than in the root layout because /ui has
 * a different header and footer. A root layout that branched on the
 * pathname would keep the wrong chrome after a soft navigation: the client
 * sends X-Webjs-Have, the server short-circuits at the root boundary and
 * never re-runs the root layout. A group layout sits INSIDE the root's
 * children range, so a navigation between `(site)` and `ui/(chrome)`
 * replaces it, header and footer included, with no full page load.
 *
 * The UI link is an ordinary link: the router loads the /ui stylesheets
 * before it swaps the page in and switches this section's sheet off as it
 * goes (#1666, #1669), so crossing sections is a soft navigation like any
 * other.
 *
 * The header is `position: fixed` (#610: sticky flickers on iOS WebKit during
 * a client-router navigation), so the content reserves its height through
 * `--header-h`, which the root layout sets on `:root`. The header is SIZED by
 * that token (`.site-top > header { height: var(--header-h) }`), so nothing
 * measures it and a navigation that swaps this header cannot leave a stale
 * offset behind (#1660).
 */

const NAV = [
  { label: 'Docs', href: DOCS_START_PATH, ext: false },
  { label: 'UI', href: UI_PATH, ext: false },
  { label: 'Blog', href: '/blog', ext: false },
  { label: 'Compare', href: '/compare', ext: false },
  { label: 'Changelog', href: '/changelog', ext: false },
  { label: 'Gallery', href: GALLERY_URL, ext: true },
  { label: 'GitHub', href: GH_URL, ext: true },
];

const navLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-2 rounded-lg transition-colors duration-[140ms] hover:text-fg hover:bg-[var(--hover-surface)]';
const panelLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-2.5 rounded-lg hover:text-fg hover:bg-[var(--hover-surface)]';

type NavItem = (typeof NAV)[number];

function navAnchor(n: NavItem, cls: string) {
  return html`<a class=${cls} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''}>${n.label}${n.ext ? NEW_TAB : ''}</a>`;
}

export default function SiteLayout({ children }: LayoutProps) {
  // The marketing stylesheet, first in this layout's markup so the framework
  // moves it into <head> and switches it off when a soft navigation leaves
  // the marketing site for /ui (#1669).
  return html`
    <link rel="stylesheet" href=${asset('/public/tailwind.css')}>
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:shadow-[var(--shadow)]">Skip to content</a>

    <div class="glow-layer" aria-hidden="true"></div>

    <div class="site-top fixed inset-x-0 top-0 z-20">
    <header class="backdrop-blur-md bg-[color-mix(in_oklch,var(--color-bg)_50%,transparent)] border-b border-border">
      <div class="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-4">
        <a class="inline-flex items-center no-underline text-fg shrink-0 transition-opacity duration-150 hover:opacity-80" href="/" aria-label="WebJs home">
          ${brandLockup('hdr', { height: 26 })}
        </a>

        <nav class="hidden md:flex items-center gap-0.5 justify-center flex-1 mx-4" aria-label="Primary">
          ${NAV.map((n) => navAnchor(n, navLink))}
        </nav>

        <div class="flex items-center gap-2.5 shrink-0">
          <theme-toggle></theme-toggle>

          <site-nav-menu class="md:hidden" label="Toggle navigation">
            ${NAV.map((n) => navAnchor(n, panelLink))}
          </site-nav-menu>
        </div>
      </div>
    </header>
    </div>

    <div class="relative z-1">
      ${children}

      ${siteFooter()}
    </div>
  `;
}
