/**
 * The sidebar-16 main nav: the "Platform" group, each section a link with a
 * toggle beside it that opens its pages in a submenu. A fragment helper; each
 * toggle is the `<summary>` of a native `<details>`, so the submenus open and
 * close with no JavaScript. Ported from shadcn/ui's sidebar-16.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { collapsibleClass, collapsibleContentClass } from '../../../components/collapsible.ts';
import {
  sidebarGroupClass,
  sidebarGroupLabelClass,
  sidebarMenuActionClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubButtonClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
} from '../../../components/sidebar.ts';
import { ChevronRightIcon } from '../../../lib/icons.ts';

export interface NavMainItem {
  title: string;
  url: string;
  icon: (cls?: string) => TemplateResult;
  isActive?: boolean;
  items?: { title: string; url: string }[];
}

export function navMain({ items }: { items: NavMainItem[] }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
      <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Platform</div>
      <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
        ${items.map((item) => html`
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
              ${item.icon()}
              <span>${item.title}</span>
            </a>
            ${item.items?.length
              ? html`<details data-slot="collapsible" class=${cn(collapsibleClass(), 'group/collapsible')} ?open=${!!item.isActive}>
                  <summary data-slot="sidebar-menu-action" data-sidebar="menu-action" class=${cn(sidebarMenuActionClass(), 'top-1.5 cursor-pointer list-none group-open/collapsible:rotate-90 [&::-webkit-details-marker]:hidden')}>
                    ${ChevronRightIcon()}
                    <span class="sr-only">Toggle</span>
                  </summary>
                  <div data-slot="collapsible-content" class=${collapsibleContentClass()}>
                    <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${sidebarMenuSubClass()}>
                      ${item.items.map((sub) => html`
                        <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=${sidebarMenuSubItemClass()}>
                          <a href=${sub.url} data-slot="sidebar-menu-sub-button" data-sidebar="menu-sub-button" data-size="md" class=${sidebarMenuSubButtonClass()}>
                            <span>${sub.title}</span>
                          </a>
                        </li>
                      `)}
                    </ul>
                  </div>
                </details>`
              : ''}
          </li>
        `)}
      </ul>
    </div>
  `;
}
