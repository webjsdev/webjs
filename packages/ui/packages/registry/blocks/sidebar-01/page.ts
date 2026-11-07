/**
 * The sidebar-01 block's page: a docs-style sidebar with its navigation
 * grouped by section, beside a header with a breadcrumb and a placeholder
 * content grid.
 *
 * Installed by `npx @webjsdev/ui add sidebar-01` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-01.
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

export const metadata: Metadata = { title: 'Dashboard' };

const ChevronRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider>
      ${appSidebar()}
      <ui-sidebar-inset>
        <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <ui-sidebar-trigger class="-ml-1"></ui-sidebar-trigger>
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
