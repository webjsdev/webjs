import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { HEADER_NAV, NAV, docPageExists, type DocLink } from '#modules/ui/docs/nav.ts';

/**
 * The /ui header's search, shadcn's CommandMenu
 * (apps/v4/components/command-menu.tsx): a "Search documentation..." button
 * that opens a command palette of the docs pages, in shadcn's new-york-v4
 * look (our new-york style).
 *
 * The markup is the server's: the trigger, the dialog and every item are
 * static, so they render here, in the layout, and cost the browser nothing.
 * <docs-command-menu> around them adds the keyboard shortcuts and closes the
 * dialog on a navigation (components/docs-command-menu.ts). Each item holds a
 * real link, so Enter or a click navigates through the client router.
 *
 * Like shadcn's, it is a Dialog around a Command, not a CommandDialog, with
 * the dialog content shadcn's command menu defines for itself: at 15% from
 * the top rather than centred, and with no overlay, which here means a clear
 * ::backdrop.
 *
 * The groups are shadcn's: Pages (the header nav), then the docs tree's
 * folders. Only pages that exist are offered (docPageExists), so a group is
 * left out until one of its pages lands. shadcn's Styles, colour and block
 * groups wait for those pages too.
 */

// Tabler's arrow-right, the icon shadcn's palette puts beside a page.
const arrowRight = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12l14 0"></path><path d="M13 18l6 -6"></path><path d="M13 6l6 6"></path></svg>`;
// Lucide's corner-down-left, the Enter key in the footer.
const enterKey = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4v7a4 4 0 0 1-4 4H4"></path><path d="m9 10-5 5 5 5"></path></svg>`;
// A component is marked with a dashed circle rather than the arrow.
const componentMark = html`<div class="aspect-square size-4 rounded-full border border-dashed border-muted-foreground"></div>`;

const GROUP = 'p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!';
const ITEM = 'h-9 rounded-md border border-transparent px-3! font-medium data-[selected=true]:border-input data-[selected=true]:bg-input/50';
const KBD = "pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-background px-1 font-sans text-[0.7rem] font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3";

function item(link: DocLink, value: string, keywords: string, mark: unknown) {
  return html`<ui-command-item value=${value} keywords=${keywords} class=${ITEM}><a href=${link.href} class="flex flex-1 items-center gap-2 no-underline text-inherit" tabindex="-1">${mark}${link.title}</a></ui-command-item>`;
}

export function commandMenu() {
  const groups = NAV.map((g) => ({ title: g.title, items: g.items.filter((i) => docPageExists(i.href)) }))
    .filter((g) => g.items.length);
  return html`<docs-command-menu class="style-new-york hidden w-full flex-1 md:flex md:w-auto md:flex-none [&_dialog]:backdrop:bg-transparent">
    <ui-dialog class="w-full">
    <ui-dialog-trigger>
      <button type="button" data-slot="button" class=${cn(buttonClass({ variant: 'outline' }), 'relative h-8 w-full justify-start rounded-lg border-none bg-muted pl-3 text-foreground shadow-none transition-colors hover:bg-muted/50 md:w-48 lg:w-40 xl:w-64 dark:bg-card')}>
        <span class="hidden xl:inline-flex">Search documentation...</span>
        <span class="inline-flex xl:hidden">Search...</span>
      </button>
    </ui-dialog-trigger>
    <ui-dialog-content show-close-button="false" class="top-[15%] translate-y-0 rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl ring-4 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800">
      <div class="sr-only">
        <h2 data-slot="dialog-title">Search documentation...</h2>
        <p data-slot="dialog-description">Search for a command to run...</p>
      </div>
      <ui-command label="Search documentation" class="rounded-none bg-transparent **:data-[slot=command-input]:h-9! **:data-[slot=command-input]:py-0 **:data-[slot=command-input-wrapper]:mb-0 **:data-[slot=command-input-wrapper]:h-9! **:data-[slot=command-input-wrapper]:rounded-md **:data-[slot=command-input-wrapper]:border **:data-[slot=command-input-wrapper]:border-input **:data-[slot=command-input-wrapper]:bg-input/50">
        <ui-command-input placeholder="Search documentation..."></ui-command-input>
        <ui-command-list class="no-scrollbar min-h-80 scroll-pt-2 scroll-pb-1.5">
          <ui-command-empty class="py-12 text-center text-sm text-muted-foreground">No results found.</ui-command-empty>
          <ui-command-group heading="Pages" class=${GROUP}>
            ${HEADER_NAV.map((l) => item(l, `Navigation ${l.title}`, `nav navigation ${l.title.toLowerCase()}`, arrowRight))}
          </ui-command-group>
          ${groups.map((g) => html`<ui-command-group heading=${g.title} class=${GROUP}>
            ${g.items.map((l) => {
              const isComponent = l.href.includes('/components/');
              return item(l, `${g.title} ${l.title}`, isComponent ? 'component' : '', isComponent ? componentMark : arrowRight);
            })}
          </ui-command-group>`)}
        </ui-command-list>
      </ui-command>
      <div class="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-xl border-t border-t-neutral-100 bg-neutral-50 px-4 text-xs font-medium text-muted-foreground dark:border-t-neutral-700 dark:bg-neutral-800">
        <div class="flex items-center gap-2"><kbd class=${KBD}>${enterKey}</kbd> Go to Page</div>
      </div>
    </ui-dialog-content>
    </ui-dialog>
  </docs-command-menu>`;
}
