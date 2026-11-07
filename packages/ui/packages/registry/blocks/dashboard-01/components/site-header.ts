/**
 * The dashboard-01 site header: the sidebar trigger and the page title, at
 * the height the page sets through `--header-height`. A fragment helper.
 * Ported from shadcn/ui's dashboard-01.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { separatorClass } from '../../../components/separator.ts';
import '../../../components/sidebar.ts';

export function siteHeader() {
  return html`
    <header class="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <ui-sidebar-trigger class="-ml-1"></ui-sidebar-trigger>
        <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mx-2 data-[orientation=vertical]:h-4')}></div>
        <h1 class="text-base font-medium">Documents</h1>
      </div>
    </header>
  `;
}
