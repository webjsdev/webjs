import { html } from '@webjsdev/core';
import { HEADER_NAV, SECTIONS, NAV, type DocLink } from '#modules/ui/docs/nav.ts';

/**
 * What <ui-mobile-nav> (components/ui-mobile-nav.ts) slots, shadcn's MobileNav
 * panel (apps/v4/components/mobile-nav.tsx): the header links under "Menu",
 * the docs Sections, then one group per docs section, the whole tree as the
 * docs sidebar lists it (modules/ui/docs/nav.ts).
 *
 * Server markup, so the nav data never ships with the element.
 */

const LINK = 'flex items-center gap-2 text-2xl font-medium text-foreground no-underline';

function group(title: string, links: DocLink[]) {
  return html`
    <div class="flex flex-col gap-4">
      <div class="text-sm font-medium text-muted-foreground">${title}</div>
      <div class="flex flex-col gap-3">
        ${links.map((l) => html`<a class=${LINK} href=${l.href} ?data-no-router=${l.href === '/' || /\.txt$/.test(l.href)}>${l.title}</a>`)}
      </div>
    </div>`;
}

export function mobileNavLinks() {
  return html`
    ${group('Menu', HEADER_NAV)}
    ${group('Sections', SECTIONS)}
    <div class="flex flex-col gap-8">
      ${NAV.map((g) => group(g.title, g.items))}
    </div>
    ${group('WebJs', [{ title: 'webjs.dev', href: '/' }])}`;
}
