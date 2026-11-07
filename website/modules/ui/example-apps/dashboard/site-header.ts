import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { IconCirclePlusFilled } from './app-sidebar.ts';

/**
 * The /ui/examples/dashboard header, shadcn/ui's
 * apps/v4/app/(app)/examples/dashboard/components/site-header.tsx (#1666):
 * the page title and the Quick Create button. The example's sidebar does not
 * collapse, so unlike the dashboard-01 block's header it has no trigger.
 */
export function siteHeader() {
  return html`
    <header class="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/90 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <h1 class="text-base font-medium">Documents</h1>
        <div class="ml-auto flex items-center gap-2">
          <button type="button" data-slot="button" class=${cn(buttonClass({ size: 'sm' }), 'hidden h-7 sm:flex')}>
            ${IconCirclePlusFilled()}
            <span>Quick Create</span>
          </button>
        </div>
      </div>
    </header>
  `;
}
