/**
 * The sidebar-16 user menu: the signed-in user's avatar, name and email,
 * opening an account menu. A fragment helper; the menu is the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-16.
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

const ChevronsUpDownIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`;
const SparklesIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg>`;
const BadgeCheckIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path><path d="m9 12 2 2 4-4"></path></svg>`;
const CreditCardIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>`;
const BellIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`;
const LogOutIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path></svg>`;

function userAvatar(user: { name: string; avatar: string }) {
  return html`<span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'h-8 w-8 rounded-lg')}>
    <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'rounded-lg')}>CN</span>
    <img data-slot="avatar-image" src=${user.avatar} alt=${user.name} class=${avatarImageClass()}>
  </span>`;
}

function userText(user: { name: string; email: string }) {
  return html`<div class="grid flex-1 text-left text-sm leading-tight">
    <span class="truncate font-medium">${user.name}</span>
    <span class="truncate text-xs">${user.email}</span>
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
              ${ChevronsUpDownIcon('ml-auto size-4')}
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
              <ui-dropdown-menu-item>${SparklesIcon()}Upgrade to Pro</ui-dropdown-menu-item>
            </ui-dropdown-menu-group>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-group>
              <ui-dropdown-menu-item>${BadgeCheckIcon()}Account</ui-dropdown-menu-item>
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
