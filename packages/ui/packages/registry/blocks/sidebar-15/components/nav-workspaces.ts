/**
 * The sidebar-15 workspaces list: one link per workspace with two hover
 * actions, a toggle over its emoji that opens its pages in a submenu and a
 * "+" to add a page, and a trailing "More" item. A fragment helper; each
 * toggle is the `<summary>` of a native `<details>`, so the submenus open and
 * close with no JavaScript. Ported from shadcn/ui's sidebar-15.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { collapsibleClass, collapsibleContentClass } from '../../../components/collapsible.ts';
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarMenuActionClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubButtonClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
} from '../../../components/sidebar.ts';

export interface Workspace {
  name: string;
  emoji: string;
  pages: { name: string; url: string; emoji: string }[];
}

const ChevronRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;

export function navWorkspaces({ workspaces }: { workspaces: Workspace[] }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
      <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Workspaces</div>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          ${workspaces.map((workspace) => html`
            <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
              <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                <span>${workspace.emoji}</span>
                <span>${workspace.name}</span>
              </a>
              <button type="button" data-slot="sidebar-menu-action" data-sidebar="menu-action" aria-label=${`Add a page to ${workspace.name}`} class=${sidebarMenuActionClass({ showOnHover: true })}>
                ${PlusIcon()}
              </button>
              <details data-slot="collapsible" class=${cn(collapsibleClass(), 'group/collapsible')}>
                <summary data-slot="sidebar-menu-action" data-sidebar="menu-action" aria-label=${`Show the pages of ${workspace.name}`} class=${cn(sidebarMenuActionClass({ showOnHover: true }), 'top-1.5 left-2 cursor-pointer list-none bg-sidebar-accent text-sidebar-accent-foreground group-open/collapsible:rotate-90 group-open/collapsible:opacity-100 [&::-webkit-details-marker]:hidden')}>
                  ${ChevronRightIcon()}
                </summary>
                <div data-slot="collapsible-content" class=${collapsibleContentClass()}>
                  <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${sidebarMenuSubClass()}>
                    ${workspace.pages.map((page) => html`
                      <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=${sidebarMenuSubItemClass()}>
                        <a href=${page.url} data-slot="sidebar-menu-sub-button" data-sidebar="menu-sub-button" data-size="md" class=${sidebarMenuSubButtonClass()}>
                          <span>${page.emoji}</span>
                          <span>${page.name}</span>
                        </a>
                      </li>
                    `)}
                  </ul>
                </div>
              </details>
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
    </div>
  `;
}
