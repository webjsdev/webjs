/**
 * The sidebar-07 team switcher: the active team's logo, name and plan,
 * opening a menu of the teams. A fragment helper; the menu is the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-07.
 *
 * It renders the first team as the active one. shadcn keeps the choice in
 * React state; in your app the active team is server data (a session value or
 * a route segment), so render the right one on the server and make each item
 * a link or a form that switches it.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import '../../../components/dropdown-menu.ts';
import {
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

export interface Team {
  name: string;
  logo: (cls?: string) => TemplateResult;
  plan: string;
}

const ChevronsUpDownIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`;
const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;

export function teamSwitcher({ teams }: { teams: Team[] }) {
  const active = teams[0];
  if (!active) return '';
  return html`
    <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${cn(sidebarMenuButtonClass({ size: 'lg' }), 'aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground')}>
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                ${active.logo()}
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">${active.name}</span>
                <span class="truncate text-xs">${active.plan}</span>
              </div>
              ${ChevronsUpDownIcon('ml-auto')}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content class="w-fit" side="right" align="start">
            <ui-dropdown-menu-label class="text-xs text-muted-foreground">Teams</ui-dropdown-menu-label>
            ${teams.map((team, index) => html`
              <ui-dropdown-menu-item class="gap-2 p-2">
                <div class="flex size-6 items-center justify-center rounded-md border">${team.logo()}</div>
                ${team.name}
                <ui-dropdown-menu-shortcut>⌘${index + 1}</ui-dropdown-menu-shortcut>
              </ui-dropdown-menu-item>
            `)}
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item class="gap-2 p-2">
              <div class="flex size-6 items-center justify-center rounded-md border bg-transparent">${PlusIcon('size-4')}</div>
              <div class="font-medium text-muted-foreground">Add team</div>
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </li>
    </ul>
  `;
}
