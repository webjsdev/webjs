/**
 * The sidebar-09 user menu: the signed-in user's avatar, name and email,
 * opening an account menu. A fragment helper; the menu is the kit's
 * `<ui-dropdown-menu>`. Ported from shadcn/ui's sidebar-09.
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
import { BadgeCheckIcon, BellIcon, ChevronsUpDownIcon, CreditCardIcon, LogOutIcon, SparklesIcon } from '../../../lib/icons.ts';

function userAvatar(user: { name: string; avatar: string }) {
  return html`<span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'h-8 w-8 rounded-lg')}>
    <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'rounded-lg')}>VK</span>
    <img data-slot="avatar-image" src=${user.avatar} alt="@vivek" class=${avatarImageClass()}>
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
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${cn(sidebarMenuButtonClass({ size: 'lg' }), 'aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground md:h-8 md:p-0')}>
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
