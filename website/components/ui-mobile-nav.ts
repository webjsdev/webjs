import { html, ref } from '@webjsdev/core';
import { live } from '@webjsdev/core/directives';
import { SiteNavMenu } from './site-nav-menu.ts';

/**
 * `<ui-mobile-nav>`: the /ui header's mobile navigation, shadcn's MobileNav
 * (apps/v4/components/mobile-nav.tsx). Below lg it replaces the header nav
 * with a "Menu" trigger whose two bars cross into an X, opening a panel that
 * covers the page under the header: the header links, the docs Sections and
 * every docs group.
 *
 * Only the look is new. The behaviour is <site-nav-menu>'s, inherited whole:
 * a native `<details>` (so the menu opens and closes with JS off) plus the
 * dismissals a bare `<details>` lacks (an outside click, a link click,
 * Escape, a navigation, the snapshot hook). The links are slotted from
 * app/ui/(chrome)/layout.ts, so the docs nav data stays on the server and
 * this module ships nothing but the chrome.
 *
 * The bars and the panel key off `details[open]` (the `group-open/mnav`
 * variant), never the host attribute, so they are right with JS off too.
 */
export class UiMobileNav extends SiteNavMenu {
  render() {
    return html`
      <details
        class="group/mnav"
        ${ref(this._detailsRef)}
        ?open=${live(this.open)}
        @toggle=${(e: Event) => { this.open = (e.target as HTMLDetailsElement).open; }}
      >
        <summary
          class="extend-touch-target flex h-8 cursor-pointer touch-manipulation list-none items-center justify-start gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
          ${ref(this._summaryRef)}
          aria-label=${this.label}
        >
          <span class="relative flex h-8 w-4 items-center justify-center" aria-hidden="true">
            <span class="relative size-4">
              <span class="absolute top-1 left-0 block h-0.5 w-4 bg-foreground transition-all duration-100 group-open/mnav:top-[0.4rem] group-open/mnav:-rotate-45"></span>
              <span class="absolute top-2.5 left-0 block h-0.5 w-4 bg-foreground transition-all duration-100 group-open/mnav:top-[0.4rem] group-open/mnav:rotate-45"></span>
            </span>
          </span>
          <span class="flex h-8 items-center text-lg leading-none font-medium">Menu</span>
        </summary>
        <nav aria-label="Mobile" class="scrollbar-none fixed inset-x-0 top-(--header-h) bottom-0 z-50 overflow-y-auto overscroll-contain bg-background/90 backdrop-blur">
          <div class="flex flex-col gap-12 px-6 py-6">
            <slot></slot>
          </div>
        </nav>
      </details>
    `;
  }
}

UiMobileNav.register('ui-mobile-nav');
