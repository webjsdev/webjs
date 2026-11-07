/**
 * The sidebar-10 block's page: a notes-app sidebar beside a header with the
 * page title and its actions menu, over a placeholder document.
 *
 * Installed by `npx @webjsdev/ui add sidebar-10` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-10.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import { breadcrumbItemClass, breadcrumbListClass, breadcrumbPageClass } from '../../components/breadcrumb.ts';
import { separatorClass } from '../../components/separator.ts';
import '../../components/sidebar.ts';
import { appSidebar } from './components/app-sidebar.ts';
import { navActions } from './components/nav-actions.ts';

export const metadata: Metadata = { title: 'Project Management & Task Tracking' };

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider>
      ${appSidebar()}
      <ui-sidebar-inset>
        <header class="flex h-14 shrink-0 items-center gap-2">
          <div class="flex flex-1 items-center gap-2 px-3">
            <ui-sidebar-trigger></ui-sidebar-trigger>
            <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mr-2 data-vertical:h-4 data-vertical:self-auto')}></div>
            <nav aria-label="breadcrumb" data-slot="breadcrumb">
              <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
                <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                  <span data-slot="breadcrumb-page" class=${cn(breadcrumbPageClass(), 'line-clamp-1')} aria-current="page">Project Management & Task Tracking</span>
                </li>
              </ol>
            </nav>
          </div>
          <div class="ml-auto px-3">${navActions()}</div>
        </header>
        <div class="flex flex-1 flex-col gap-4 px-4 py-10">
          <div class="mx-auto h-24 w-full max-w-3xl rounded-xl bg-muted/50"></div>
          <div class="mx-auto h-full w-full max-w-3xl rounded-xl bg-muted/50"></div>
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `;
}
