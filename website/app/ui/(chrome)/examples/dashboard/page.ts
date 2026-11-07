import { html } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { examplesShell, EXAMPLES_DESCRIPTION } from '#lib/ui/examples-shell.ts';
import { appSidebar } from '#modules/ui/example-apps/dashboard/app-sidebar.ts';
import { siteHeader } from '#modules/ui/example-apps/dashboard/site-header.ts';
import { sectionCards } from '#modules/ui/blocks/dashboard-01/components/section-cards.ts';
import { chartAreaInteractive } from '#modules/ui/blocks/dashboard-01/components/chart-area-interactive.ts';
import { dataTable } from '#modules/ui/blocks/dashboard-01/components/data-table.ts';
import { dashboardData } from '#modules/ui/blocks/dashboard-01/components/dashboard-data.ts';
// The interactive parts. A page never hydrates, so it imports the elements
// its markup uses to register them.
import '#modules/ui/components/sidebar.ts';
import '#modules/ui/components/dropdown-menu.ts';

/**
 * /ui/examples/dashboard, shadcn/ui's apps/v4/app/(app)/examples/dashboard
 * (#1666): a sidebar beside a header, four metric cards, an interactive area
 * chart and the documents table, inside the examples frame.
 *
 * Most of it is the dashboard-01 block, imported from its mirror rather than
 * copied: the metric cards, the chart, the data table and its data, and the
 * sidebar's documents, secondary and user menus. The sidebar and the header
 * are the example's own (modules/ui/example-apps/dashboard/), because the
 * example's sidebar does not collapse and its header carries Quick Create.
 * The chart and the table register their own elements when their modules
 * load. The example's cards carry no tint (the block's fade from primary/5 is
 * the block's own), so the wrapper starts their gradient at the card colour.
 */

export const metadata: Metadata = {
  title: 'Dashboard | WebJs UI',
  description: EXAMPLES_DESCRIPTION,
};

export default function DashboardExample({ url }: Pick<PageProps, 'url'>) {
  return examplesShell(new URL(url).pathname, 'dashboard', html`
    <ui-sidebar-provider class="[--header-height:calc(var(--spacing)*12+1px)]">
      ${appSidebar()}
      <ui-sidebar-inset>
        ${siteHeader()}
        <div class="flex flex-1 flex-col">
          <div class="@container/main flex flex-1 flex-col gap-2">
            <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div class="contents [&_[data-slot=card]]:from-card!">${sectionCards()}</div>
              <div class="px-4 lg:px-6">${chartAreaInteractive()}</div>
              ${dataTable({ data: dashboardData })}
            </div>
          </div>
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `);
}
