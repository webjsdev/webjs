/**
 * The sidebar-16 site header: a sticky bar across the top of the page with
 * the sidebar toggle, a breadcrumb and the search form. A fragment helper;
 * the toggle is the kit's `<ui-sidebar-trigger>`, which finds the provider it
 * sits in. Ported from shadcn/ui's sidebar-16.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbListClass,
  breadcrumbPageClass,
  breadcrumbSeparatorClass,
} from '../../../components/breadcrumb.ts';
import { separatorClass } from '../../../components/separator.ts';
import '../../../components/sidebar.ts';
import { searchForm } from './search-form.ts';
import { ChevronRightIcon } from '../../../lib/icons.ts';

export function siteHeader() {
  return html`
    <header class="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div class="flex h-(--header-height) w-full items-center gap-2 px-4">
        <ui-sidebar-trigger class="[&>button]:size-8"></ui-sidebar-trigger>
        <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mr-2 data-vertical:h-4 data-vertical:self-auto')}></div>
        <nav aria-label="breadcrumb" data-slot="breadcrumb" class="hidden sm:block">
          <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
            <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
              <a data-slot="breadcrumb-link" class=${breadcrumbLinkClass()} href="#">Build Your Application</a>
            </li>
            <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${ChevronRightIcon()}</li>
            <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
              <span data-slot="breadcrumb-page" class=${breadcrumbPageClass()} aria-current="page">Data Fetching</span>
            </li>
          </ol>
        </nav>
        ${searchForm({ class: 'w-full sm:ml-auto sm:w-auto' })}
      </div>
    </header>
  `;
}
