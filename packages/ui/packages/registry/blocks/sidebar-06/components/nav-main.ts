/**
 * The sidebar-06 main nav: one menu item per section, each opening its pages
 * as a dropdown menu beside the sidebar. A fragment helper; the menus are the
 * kit's `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-06.
 *
 * Each page is a real link inside its menu item, so a click follows it. Give
 * the item for the current page `aria-current="page"` on its link.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import '../../../components/dropdown-menu.ts';
import {
  sidebarGroupClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

export interface NavMainItem {
  title: string;
  url: string;
  icon?: (cls?: string) => TemplateResult;
  isActive?: boolean;
  items?: { title: string; url: string; isActive?: boolean }[];
}

const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;

export function navMain({ items }: { items: NavMainItem[] }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
      <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
        ${items.map((item) => html`
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <ui-dropdown-menu>
              <ui-dropdown-menu-trigger>
                <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground')}>
                  ${item.title} ${MoreHorizontalIcon('ml-auto')}
                </button>
              </ui-dropdown-menu-trigger>
              ${item.items?.length
                ? html`<ui-dropdown-menu-content class="min-w-56 rounded-lg" side="right" align="start">
                    ${item.items.map((sub) => html`
                      <ui-dropdown-menu-item>
                        <a href=${sub.url} class="flex-1 text-inherit no-underline" aria-current=${sub.isActive ? 'page' : null}>${sub.title}</a>
                      </ui-dropdown-menu-item>
                    `)}
                  </ui-dropdown-menu-content>`
                : ''}
            </ui-dropdown-menu>
          </li>
        `)}
      </ul>
    </div>
  `;
}
