/**
 * The sidebar-15 favorites list: one link per favorite page, each with a
 * "More" menu that shows on hover, and a trailing "More" item. A fragment
 * helper; the menus are the kit's `<ui-dropdown-menu>`. Ported from
 * shadcn/ui's sidebar-15.
 *
 * Each "More" button sits right after its link, a sibling of it, because the
 * kit's styles place it with `peer-*` selectors that need exactly that. The
 * menu names it through `trigger="<id>"`, so the ids must be unique on the page.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import '../../../components/dropdown-menu.ts';
import {
  sidebarGroupClass,
  sidebarGroupLabelClass,
  sidebarMenuActionClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

export interface Favorite {
  name: string;
  url: string;
  emoji: string;
}

const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
const StarOffIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10.344 4.688 1.181-2.393a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.237 3.152"></path><path d="m17.945 17.945.43 2.505a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a8 8 0 0 0 .4-.099"></path><path d="m2 2 20 20"></path></svg>`;
const LinkIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
const ArrowUpRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>`;
const Trash2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

export function navFavorites({ favorites }: { favorites: Favorite[] }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'group-data-[collapsible=icon]:hidden')}>
      <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Favorites</div>
      <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
        ${favorites.map((item, i) => html`
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href=${item.url} title=${item.name} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
              <span>${item.emoji}</span>
              <span>${item.name}</span>
            </a>
            <button type="button" id=${`nav-favorite-more-${i}`} data-slot="sidebar-menu-action" data-sidebar="menu-action" class=${cn(sidebarMenuActionClass({ showOnHover: true }), 'aria-expanded:bg-muted')}>
              ${MoreHorizontalIcon()}
              <span class="sr-only">More</span>
            </button>
            <ui-dropdown-menu trigger=${`nav-favorite-more-${i}`}>
              <ui-dropdown-menu-content class="w-56 rounded-lg" side="right" align="start">
                <ui-dropdown-menu-item>${StarOffIcon('text-muted-foreground')}<span>Remove from Favorites</span></ui-dropdown-menu-item>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-item>${LinkIcon('text-muted-foreground')}<span>Copy Link</span></ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${ArrowUpRightIcon('text-muted-foreground')}<span>Open in New Tab</span></ui-dropdown-menu-item>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-item>${Trash2Icon('text-muted-foreground')}<span>Delete</span></ui-dropdown-menu-item>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
          </li>
        `)}
        <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
          <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'text-sidebar-foreground/70')}>
            ${MoreHorizontalIcon()}
            <span>More</span>
          </button>
        </li>
      </ul>
    </div>
  `;
}
