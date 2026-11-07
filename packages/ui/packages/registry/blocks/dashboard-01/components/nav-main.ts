/**
 * The dashboard-01 main nav: the "Quick Create" button beside an inbox
 * button, then one link per section. A fragment helper. Ported from
 * shadcn/ui's dashboard-01.
 *
 * "Quick Create" and the inbox button are placeholders: point them at your
 * own create flow and inbox route.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';
import { CirclePlusIcon, MailIcon } from '../../../lib/icons.ts';

export interface NavMainItem {
  title: string;
  url: string;
  icon?: (cls?: string) => TemplateResult;
}

export function navMain({ items }: { items: NavMainItem[] }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${cn(sidebarGroupContentClass(), 'flex flex-col gap-2')}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${cn(sidebarMenuItemClass(), 'flex items-center gap-2')}>
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground')}>
              ${CirclePlusIcon()}
              <span>Quick Create</span>
            </button>
            <button type="button" data-slot="button" data-variant="outline" data-size="icon" class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'size-8 group-data-[collapsible=icon]:opacity-0')}>
              ${MailIcon()}
              <span class="sr-only">Inbox</span>
            </button>
          </li>
        </ul>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          ${items.map((item) => html`
            <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
              <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                ${item.icon ? item.icon() : ''}
                <span>${item.title}</span>
              </a>
            </li>
          `)}
        </ul>
      </div>
    </div>
  `;
}
