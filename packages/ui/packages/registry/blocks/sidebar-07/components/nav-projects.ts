/**
 * The sidebar-07 projects list: one link per project, each with a "More"
 * menu that shows on hover, and a trailing "More" item. Hidden while the
 * sidebar is collapsed to icons. A fragment helper; the menus are the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-07.
 *
 * Each "More" button sits right after its link, a sibling of it, because the
 * kit's styles place it with `peer-*` selectors that need exactly that. The
 * menu names it through `trigger="<id>"`, so the ids must be unique on the page.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
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
import { ArrowRightIcon, FolderIcon, MoreHorizontalIcon, Trash2Icon } from '../../../lib/icons.ts';

export interface NavProject {
  name: string;
  url: string;
  icon: (cls?: string) => TemplateResult;
}

export function navProjects({ projects }: { projects: NavProject[] }) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'group-data-[collapsible=icon]:hidden')}>
      <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Projects</div>
      <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
        ${projects.map((item, i) => html`
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
              ${item.icon()}
              <span>${item.name}</span>
            </a>
            <button type="button" id=${`nav-project-more-${i}`} data-slot="sidebar-menu-action" data-sidebar="menu-action" class=${cn(sidebarMenuActionClass({ showOnHover: true }), 'aria-expanded:bg-muted')}>
              ${MoreHorizontalIcon()}
              <span class="sr-only">More</span>
            </button>
            <ui-dropdown-menu trigger=${`nav-project-more-${i}`}>
              <ui-dropdown-menu-content class="w-fit" side="right" align="start">
                <ui-dropdown-menu-item>${FolderIcon()}<span>View Project</span></ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${ArrowRightIcon()}<span>Share Project</span></ui-dropdown-menu-item>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-item variant="destructive">${Trash2Icon()}<span>Delete Project</span></ui-dropdown-menu-item>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
          </li>
        `)}
        <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
          <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'text-sidebar-foreground/70')}>
            ${MoreHorizontalIcon('text-sidebar-foreground/70')}
            <span>More</span>
          </button>
        </li>
      </ul>
    </div>
  `;
}
