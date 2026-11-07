/**
 * The sidebar-15 block's page: a collapsible sidebar on the left and a
 * calendar sidebar on the right, around a sticky header and a document-like
 * content column.
 *
 * Installed by `npx @webjsdev/ui add sidebar-15` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-15.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import { breadcrumbItemClass, breadcrumbListClass, breadcrumbPageClass } from '../../components/breadcrumb.ts';
import { separatorClass } from '../../components/separator.ts';
import '../../components/sidebar.ts';
import { sidebarLeft } from './components/sidebar-left.ts';
import { sidebarRight } from './components/sidebar-right.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider>
      ${sidebarLeft()}
      <ui-sidebar-inset>
        <header class="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
          <div class="flex flex-1 items-center gap-2 px-3">
            <ui-sidebar-trigger></ui-sidebar-trigger>
            <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mr-2 data-vertical:h-4 data-vertical:self-auto')}></div>
            <nav aria-label="breadcrumb" data-slot="breadcrumb">
              <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
                <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                  <span data-slot="breadcrumb-page" class=${cn(breadcrumbPageClass(), 'line-clamp-1')} aria-current="page">Project Management &amp; Task Tracking</span>
                </li>
              </ol>
            </nav>
          </div>
        </header>
        <div class="flex flex-1 flex-col gap-4 p-4">
          <div class="mx-auto h-24 w-full max-w-3xl rounded-xl bg-muted/50"></div>
          <div class="mx-auto h-screen w-full max-w-3xl rounded-xl bg-muted/50"></div>
        </div>
      </ui-sidebar-inset>
      ${sidebarRight()}
    </ui-sidebar-provider>
  `;
}
