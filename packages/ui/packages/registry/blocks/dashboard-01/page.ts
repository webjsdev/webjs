/**
 * The dashboard-01 block's page: an inset sidebar beside a header, four
 * metric cards, an interactive area chart and a data table.
 *
 * Installed by `npx @webjsdev/ui add dashboard-01` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely: replace `dashboardData` with
 * rows from your own query. Ported from shadcn/ui's dashboard-01.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '../../components/sidebar.ts';
import { appSidebar } from './components/app-sidebar.ts';
import { chartAreaInteractive } from './components/chart-area-interactive.ts';
import { dashboardData } from './components/dashboard-data.ts';
import { dataTable } from './components/data-table.ts';
import { sectionCards } from './components/section-cards.ts';
import { siteHeader } from './components/site-header.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider class="[--header-height:calc(var(--spacing)*12)]">
      ${appSidebar({ variant: 'inset' })}
      <ui-sidebar-inset>
        ${siteHeader()}
        <div class="flex flex-1 flex-col">
          <div class="@container/main flex flex-1 flex-col gap-2">
            <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              ${sectionCards()}
              <div class="px-4 lg:px-6">${chartAreaInteractive()}</div>
              ${dataTable({ data: dashboardData })}
            </div>
          </div>
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `;
}
