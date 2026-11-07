/**
 * The sidebar-03 block's page: a docs-style sidebar with each section's
 * pages in a submenu, beside a header with a breadcrumb and a placeholder
 * content grid.
 *
 * Installed by `npx @webjsdev/ui add sidebar-03` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-03.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbListClass,
  breadcrumbPageClass,
  breadcrumbSeparatorClass,
} from '../../components/breadcrumb.ts';
import { separatorClass } from '../../components/separator.ts';
import '../../components/sidebar.ts';
import { appSidebar } from './components/app-sidebar.ts';
import { ChevronRightIcon } from '../../lib/icons.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider>
      ${appSidebar()}
      <ui-sidebar-inset>
        <header class="flex h-16 shrink-0 items-center gap-2 border-b">
          <div class="flex items-center gap-2 px-3">
            <ui-sidebar-trigger></ui-sidebar-trigger>
            <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mr-2 data-vertical:h-4 data-vertical:self-auto')}></div>
            <nav aria-label="breadcrumb" data-slot="breadcrumb">
              <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
                <li data-slot="breadcrumb-item" class=${cn(breadcrumbItemClass(), 'hidden md:block')}>
                  <a data-slot="breadcrumb-link" class=${breadcrumbLinkClass()} href="#">Build Your Application</a>
                </li>
                <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${cn(breadcrumbSeparatorClass(), 'hidden md:block')}>${ChevronRightIcon()}</li>
                <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                  <span data-slot="breadcrumb-page" class=${breadcrumbPageClass()} aria-current="page">Data Fetching</span>
                </li>
              </ol>
            </nav>
          </div>
        </header>
        <div class="flex flex-1 flex-col gap-4 p-4">
          <div class="grid auto-rows-min gap-4 md:grid-cols-3">
            <div class="aspect-video rounded-xl bg-muted/50"></div>
            <div class="aspect-video rounded-xl bg-muted/50"></div>
            <div class="aspect-video rounded-xl bg-muted/50"></div>
          </div>
          <div class="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min"></div>
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `;
}
