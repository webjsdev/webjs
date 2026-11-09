/**
 * The sidebar-16 search form: a compact search field in the site header. A
 * fragment helper, so it renders on the server and ships no JavaScript.
 * Ported from shadcn/ui's sidebar-16.
 *
 * The `<form>` has no `action` yet. Point it at your search route as a GET
 * (`<form action="/search">`), or bind a server action from a `'use server'`
 * file (`<form action=${search}>`). Until then a submit reloads the page with
 * `?q=` in the URL.
 */
import { html, nothing } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { labelClass } from '../../../components/label.ts';
import { sidebarInputClass } from '../../../components/sidebar.ts';
import { SearchIcon } from '../../../lib/icons.ts';

export function searchForm(opts: { class?: string } = {}) {
  return html`
    <form role="search" class=${opts.class ?? nothing}>
      <div class="relative">
        <label data-slot="label" for="search" class=${cn(labelClass(), 'sr-only')}>Search</label>
        <input data-slot="sidebar-input" data-sidebar="input" id="search" name="q" placeholder="Type to search..." class=${cn(sidebarInputClass(), 'h-8 pl-7')}>
        ${SearchIcon('pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none')}
      </div>
    </form>
  `;
}
