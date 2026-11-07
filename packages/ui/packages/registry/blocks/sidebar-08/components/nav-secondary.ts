/**
 * The sidebar-08 secondary nav: small links (support, feedback) at the bottom
 * of the sidebar content. A fragment helper. Ported from shadcn/ui's
 * sidebar-08.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

export interface NavSecondaryItem {
  title: string;
  url: string;
  icon: (cls?: string) => TemplateResult;
}

export function navSecondary({ items, class: cls }: { items: NavSecondaryItem[]; class?: string }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), cls)}>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          ${items.map((item) => html`
            <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
              <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="sm" class=${sidebarMenuButtonClass({ size: 'sm' })}>
                ${item.icon()}
                <span>${item.title}</span>
              </a>
            </li>
          `)}
        </ul>
      </div>
    </div>
  `;
}
