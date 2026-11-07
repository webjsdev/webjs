/**
 * The sidebar-12 block's page: a sidebar with a calendar and a list of
 * calendars, beside a sticky header and a grid of day placeholders.
 *
 * Installed by `npx @webjsdev/ui add sidebar-12` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-12.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import { breadcrumbItemClass, breadcrumbListClass, breadcrumbPageClass } from '../../components/breadcrumb.ts';
import { separatorClass } from '../../components/separator.ts';
import '../../components/sidebar.ts';
import { appSidebar } from './components/app-sidebar.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider>
      ${appSidebar()}
      <ui-sidebar-inset>
        <header class="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <ui-sidebar-trigger class="-ml-1"></ui-sidebar-trigger>
          <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mr-2 data-vertical:h-4 data-vertical:self-auto')}></div>
          <nav aria-label="breadcrumb" data-slot="breadcrumb">
            <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
              <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                <span data-slot="breadcrumb-page" class=${breadcrumbPageClass()} aria-current="page">October 2024</span>
              </li>
            </ol>
          </nav>
        </header>
        <div class="flex flex-1 flex-col gap-4 p-4">
          <div class="grid auto-rows-min gap-4 md:grid-cols-5">
            ${Array.from({ length: 20 }, () => html`<div class="aspect-square rounded-xl bg-muted/50"></div>`)}
          </div>
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `;
}
