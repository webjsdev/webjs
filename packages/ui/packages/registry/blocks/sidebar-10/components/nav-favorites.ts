/**
 * The sidebar-10 favorites: one link per favourite page, each with a "More"
 * menu that shows on hover, and a trailing "More" item. Hidden while the
 * sidebar is collapsed to icons. A fragment helper; the menus are the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-10.
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
import { ArrowUpRightIcon, LinkIcon, MoreHorizontalIcon, StarOffIcon, Trash2Icon } from '../../../lib/icons.ts';

export interface Favorite {
  name: string;
  url: string;
  emoji: string;
}

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
