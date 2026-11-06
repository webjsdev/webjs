import { html, cspNonce } from '@webjsdev/core';
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
 * The UI link carries `data-no-router`. Crossing into /ui on a soft
 * navigation would apply its stylesheet only after the swap (the router's
 * head merge is add-only and a body stylesheet is not render-blocking), so
 * the known cross-section links take a full load and never paint unstyled.
 *
 * The inline script after the header keeps `--header-h` equal to the fixed
 * header's real height (#610: fixed, not sticky, so the content reserves the
 * height through that variable, with a :root default for first paint and
 * no-JS). It lives HERE, next to the header it measures, rather than in the
 * root layout's head: a navigation into the other section swaps this header
 * out, and a ResizeObserver bound once at boot would keep watching the
 * detached node. The client router re-runs a script inside the swapped range,
 * so it rebinds to the new header every time, disconnecting the old observer
 * first. The `/ui` chrome layout carries the same script, and a test holds
 * the two copies identical. It stays inline in the layout because a page or
 * layout template is SSR output, while the same text in a `lib/` module would
 * read as client work and ship the layout to the browser.
 */

const NAV = [
  { label: 'Docs', href: DOCS_START_PATH, ext: false, full: false },
  { label: 'UI', href: UI_PATH, ext: false, full: true },
  { label: 'Blog', href: '/blog', ext: false, full: false },
  { label: 'Compare', href: '/compare', ext: false, full: false },
  { label: 'Changelog', href: '/changelog', ext: false, full: false },
  { label: 'Gallery', href: GALLERY_URL, ext: true, full: false },
  { label: 'GitHub', href: GH_URL, ext: true, full: false },
];

const navLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-2 rounded-lg transition-colors duration-[140ms] hover:text-fg hover:bg-[var(--hover-surface)]';
const panelLink = 'text-fg-muted no-underline font-medium text-sm px-3 py-2.5 rounded-lg hover:text-fg hover:bg-[var(--hover-surface)]';

type NavItem = (typeof NAV)[number];

function navAnchor(n: NavItem, cls: string) {
  return html`<a class=${cls} href=${n.href} target=${n.ext ? '_blank' : '_self'} rel=${n.ext ? 'noopener noreferrer' : ''} ?data-no-router=${n.full}>${n.label}${n.ext ? NEW_TAB : ''}</a>`;
}

export default function SiteLayout({ children }: LayoutProps) {
  const nonce = cspNonce();
  return html`
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-accent-fg focus:shadow-[var(--shadow)]">Skip to content</a>

    <div class="glow-layer" aria-hidden="true"></div>

    <div class="site-top fixed inset-x-0 top-0 z-20">
    <header class="backdrop-blur-md bg-[color-mix(in_oklch,var(--color-bg)_50%,transparent)] border-b border-border">
      <div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
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

    <div class="relative z-1">
      ${children}

      ${siteFooter()}
    </div>
  `;
}
