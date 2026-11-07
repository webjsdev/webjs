/**
 * The sidebar-02 block's page: a docs-style sidebar with collapsible
 * sections, beside a sticky header with a breadcrumb and a long placeholder
 * list that scrolls under it.
 *
 * Installed by `npx @webjsdev/ui add sidebar-02` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-02.
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
        <header class="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
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
          ${Array.from({ length: 24 }, () => html`<div class="aspect-video h-12 w-full rounded-lg bg-muted/50"></div>`)}
        </div>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `;
}
