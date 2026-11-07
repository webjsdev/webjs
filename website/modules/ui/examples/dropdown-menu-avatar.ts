import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { BadgeCheckIcon, BellIcon, CreditCardIcon, LogOutIcon } from '#lib/ui/lucide.ts';

export default function DropdownMenuAvatar() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="ghost" data-size="icon" aria-label="Account menu" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'rounded-full')}>
          <span data-slot="avatar" data-size="default" class=${avatarClass()}>
            <img data-slot="avatar-image" src="https://github.com/shadcn.png" alt="shadcn" class=${avatarImageClass()}>
            <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>LR</span>
          </span>
        </button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content align="end">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>
            ${BadgeCheckIcon()}
            Account
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${CreditCardIcon()}
            Billing
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${BellIcon()}
            Notifications
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-item>
          ${LogOutIcon()}
          Sign Out
        </ui-dropdown-menu-item>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
