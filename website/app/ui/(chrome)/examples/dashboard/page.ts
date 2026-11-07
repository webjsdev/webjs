import { html } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { examplesShell, EXAMPLES_DESCRIPTION } from '#lib/ui/examples-shell.ts';
import { appSidebar } from '#modules/ui/blocks/dashboard-01/components/app-sidebar.ts';
import { siteHeader } from '#modules/ui/blocks/dashboard-01/components/site-header.ts';
import { data, IconInnerShadowTop, IconCirclePlusFilled } from '#modules/ui/example-apps/dashboard/data.ts';
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
 * All of it is the dashboard-01 block, imported from its mirror rather than
 * copied, with the options that give it the example's shape: a sidebar that
 * does not collapse, with a "Home" group and no Quick Create row, and a sticky
 * header with no trigger and Quick Create at its end. The example's Tabler
 * icons and nav data are modules/ui/example-apps/dashboard/data.ts.
 * The chart opens as shadcn's example does on a wide screen: on the last 7
 * days, with the tooltip on the last day. shadcn passes Recharts
 * `defaultIndex={isMobile ? -1 : 10}`, and Recharts draws an index past the
 * end (the 7-day series has 8 points) at the last point, so the kit chart
 * takes that point, 7. Below md the shell shows the example's picture rather
 * than the example, as shadcn's page does, so the phone case never renders.
 */

export const metadata: Metadata = {
  title: 'Dashboard | WebJs UI',
  description: EXAMPLES_DESCRIPTION,
};

export default function DashboardExample({ url }: Pick<PageProps, 'url'>) {
  return examplesShell(new URL(url).pathname, 'dashboard', html`
    <ui-sidebar-provider class="[--header-height:calc(var(--spacing)*12+1px)]">
      ${appSidebar({
        collapsible: 'none',
        class: 'h-auto border-r [--sidebar-width:calc(var(--spacing)*64)]',
        headerClass: 'border-b',
        logo: IconInnerShadowTop('size-5!'),
        mainLabel: 'Home',
        quickCreate: false,
        data,
      })}
      <ui-sidebar-inset>
        ${siteHeader({ trigger: false, quickCreate: true, quickCreateIcon: IconCirclePlusFilled(), sticky: true })}
        <div class="flex flex-1 flex-col">
          <div class="@container/main flex flex-1 flex-col gap-2">
            <div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div class="contents [&_[data-slot=card]]:from-card!">${sectionCards()}</div>
              <div class="px-4 lg:px-6">${chartAreaInteractive({ range: '7d', tooltipIndex: 7 })}</div>
              ${dataTable({ data: dashboardData })}
            </div>
          </div>
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `);
}
