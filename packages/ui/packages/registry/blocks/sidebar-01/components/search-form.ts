/**
 * The sidebar-01 search form: a search field at the top of the sidebar. A
 * fragment helper, so it renders on the server and ships no JavaScript.
 * Ported from shadcn/ui's sidebar-01.
 *
 * The `<form>` has no `action` yet. Point it at your search route as a GET
 * (`<form action="/search">`), or bind a server action from a `'use server'`
 * file (`<form action=${search}>`). Until then a submit reloads the page with
 * `?q=` in the URL.
 */
import { html, nothing } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { labelClass } from '../../../components/label.ts';
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarInputClass,
} from '../../../components/sidebar.ts';
import { SearchIcon } from '../../../lib/icons.ts';

export function searchForm(opts: { class?: string } = {}) {
  return html`
    <form role="search" class=${opts.class ?? nothing}>
      <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'py-0')}>
        <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${cn(sidebarGroupContentClass(), 'relative')}>
          <label data-slot="label" for="search" class=${cn(labelClass(), 'sr-only')}>Search</label>
          <input data-slot="sidebar-input" data-sidebar="input" id="search" name="q" placeholder="Search the docs..." class=${cn(sidebarInputClass(), 'pl-8')}>
          ${SearchIcon('pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none')}
        </div>
      </div>
    </form>
  `;
}
