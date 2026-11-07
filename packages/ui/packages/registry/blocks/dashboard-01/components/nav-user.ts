/**
 * The dashboard-01 user menu: the signed-in user's avatar, name and email,
 * opening an account menu. A fragment helper; the menu is the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's dashboard-01.
 *
 * The menu items are placeholders. Make "Log out" a form that posts to your
 * sign-out action, and the others links to your account pages.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { avatarClass, avatarFallbackClass, avatarImageClass } from '../../../components/avatar.ts';
import '../../../components/dropdown-menu.ts';
import {
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';

const EllipsisVerticalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
const CircleUserRoundIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.925 20.056a6 6 0 0 0-11.851.001"></path><circle cx="12" cy="11" r="4"></circle><circle cx="12" cy="12" r="10"></circle></svg>`;
const CreditCardIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>`;
const BellIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`;
const LogOutIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path></svg>`;

function userAvatar(user: { name: string; avatar: string }) {
  return html`<span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'h-8 w-8 rounded-lg grayscale')}>
    <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'rounded-lg')}>CN</span>
    <img data-slot="avatar-image" src=${user.avatar} alt=${user.name} class=${avatarImageClass()}>
  </span>`;
}

function userText(user: { name: string; email: string }) {
  return html`<div class="grid flex-1 text-left text-sm leading-tight">
    <span class="truncate font-medium">${user.name}</span>
    <span class="truncate text-xs text-muted-foreground">${user.email}</span>
  </div>`;
}

export function navUser({ user }: { user: { name: string; email: string; avatar: string } }) {
  return html`
    <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${cn(sidebarMenuButtonClass({ size: 'lg' }), 'aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground')}>
              ${userAvatar(user)}
              ${userText(user)}
              ${EllipsisVerticalIcon('ml-auto size-4')}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content class="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side="right" align="end">
            <ui-dropdown-menu-label class="p-0 font-normal">
              <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                ${userAvatar(user)}
                ${userText(user)}
              </div>
            </ui-dropdown-menu-label>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-group>
              <ui-dropdown-menu-item>${CircleUserRoundIcon()}Account</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>${CreditCardIcon()}Billing</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>${BellIcon()}Notifications</ui-dropdown-menu-item>
            </ui-dropdown-menu-group>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item>${LogOutIcon()}Log out</ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </li>
    </ul>
  `;
}
