/**
 * The sidebar-16 block's page: a sticky site header across the top, and a
 * sidebar below it beside a placeholder content grid.
 *
 * Installed by `npx @webjsdev/ui add sidebar-16` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-16.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '../../components/sidebar.ts';
import { appSidebar } from './components/app-sidebar.ts';
import { siteHeader } from './components/site-header.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return html`
    <div class="[--header-height:calc(--spacing(14))]">
      <ui-sidebar-provider class="[&>[data-slot=sidebar-wrapper]]:flex-col">
        ${siteHeader()}
        <div class="flex flex-1">
          ${appSidebar()}
          <ui-sidebar-inset>
            <div class="flex flex-1 flex-col gap-4 p-4">
              <div class="grid auto-rows-min gap-4 md:grid-cols-3">
                <div class="aspect-video rounded-xl bg-muted/50"></div>
                <div class="aspect-video rounded-xl bg-muted/50"></div>
                <div class="aspect-video rounded-xl bg-muted/50"></div>
              </div>
              <div class="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min"></div>
            </div>
          </ui-sidebar-inset>
        </div>
      </ui-sidebar-provider>
    </div>
  `;
}
