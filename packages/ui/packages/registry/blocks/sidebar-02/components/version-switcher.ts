/**
 * The sidebar-02 version switcher: the docs logo with the current version,
 * opening a menu of the versions. A fragment helper; the menu is the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-02.
 *
 * It renders `defaultVersion` as the selected one. shadcn keeps the choice in
 * React state; in your app the version is server data (a route segment or a
 * cookie), so render the right one on the server and make each item a link
 * to that version.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import '../../../components/dropdown-menu.ts';
import {
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

const GalleryVerticalEndIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2h10"></path><path d="M5 6h14"></path><rect width="18" height="12" x="3" y="10" rx="2"></rect></svg>`;
const ChevronsUpDownIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`;
const CheckIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;

export function versionSwitcher({ versions, defaultVersion }: { versions: string[]; defaultVersion: string }) {
  const selected = defaultVersion;
  return html`
    <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${cn(sidebarMenuButtonClass({ size: 'lg' }), 'aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground')}>
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                ${GalleryVerticalEndIcon('size-4')}
              </div>
              <div class="flex flex-col gap-0.5 leading-none">
                <span class="font-medium">Documentation</span>
                <span>v${selected}</span>
              </div>
              ${ChevronsUpDownIcon('ml-auto')}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content class="w-(--radix-dropdown-menu-trigger-width)" align="start">
            ${versions.map((version) => html`
              <ui-dropdown-menu-item>
                v${version} ${version === selected ? CheckIcon('ml-auto') : ''}
              </ui-dropdown-menu-item>
            `)}
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </li>
    </ul>
  `;
}
