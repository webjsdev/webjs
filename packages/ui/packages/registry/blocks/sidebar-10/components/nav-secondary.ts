/**
 * The sidebar-10 secondary nav: calendar, settings, templates, trash and
 * help at the bottom of the sidebar, each an optional badge. A fragment
 * helper. Ported from shadcn/ui's sidebar-10.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarMenuBadgeClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

export interface NavSecondaryItem {
  title: string;
  url: string;
  icon: (cls?: string) => TemplateResult;
  badge?: string;
}

export function navSecondary({ items, class: cls }: { items: NavSecondaryItem[]; class?: string }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), cls)}>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          ${items.map((item) => html`
            <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
              <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                ${item.icon()}
                <span>${item.title}</span>
              </a>
              ${item.badge ? html`<div data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class=${sidebarMenuBadgeClass()}>${item.badge}</div>` : ''}
            </li>
          `)}
        </ul>
      </div>
    </div>
  `;
}
