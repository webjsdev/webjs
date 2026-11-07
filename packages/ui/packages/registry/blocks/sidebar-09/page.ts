/**
 * The sidebar-09 block's page: a mail layout with collapsible nested
 * sidebars, beside a header with a breadcrumb and a placeholder message list.
 *
 * Installed by `npx @webjsdev/ui add sidebar-09` at `app/dashboard/page.ts`.
 * It is app code you own, so edit it freely. Ported from shadcn/ui's
 * sidebar-09.
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

export const metadata: Metadata = { title: 'Inbox' };

export default function DashboardPage() {
  return html`
    <ui-sidebar-provider>
      ${appSidebar()}
      <ui-sidebar-inset>
        <header class="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <ui-sidebar-trigger class="-ml-1"></ui-sidebar-trigger>
          <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mr-2 data-vertical:h-4 data-vertical:self-auto')}></div>
          <nav aria-label="breadcrumb" data-slot="breadcrumb">
            <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
              <li data-slot="breadcrumb-item" class=${cn(breadcrumbItemClass(), 'hidden md:block')}>
                <a data-slot="breadcrumb-link" class=${breadcrumbLinkClass()} href="#">All Inboxes</a>
              </li>
              <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${cn(breadcrumbSeparatorClass(), 'hidden md:block')}>${ChevronRightIcon()}</li>
              <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                <span data-slot="breadcrumb-page" class=${breadcrumbPageClass()} aria-current="page">Inbox</span>
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
