/**
 * The sidebar-10 main nav: search, the assistant, home and the inbox, as
 * plain links. A fragment helper. Ported from shadcn/ui's sidebar-10.
 *
 * Mark the current page's link `data-active="true"` and `aria-current="page"`
 * (the `isActive` field below does it for the sample).
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import {
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

export interface NavMainItem {
  title: string;
  url: string;
  icon: (cls?: string) => TemplateResult;
  isActive?: boolean;
  badge?: string;
}

export function navMain({ items }: { items: NavMainItem[] }) {
  return html`
    <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
      ${items.map((item) => html`
        <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
          <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${item.isActive ? 'true' : 'false'} aria-current=${item.isActive ? 'page' : null} class=${sidebarMenuButtonClass()}>
            ${item.icon()}
            <span>${item.title}</span>
          </a>
        </li>
      `)}
    </ul>
  `;
}
