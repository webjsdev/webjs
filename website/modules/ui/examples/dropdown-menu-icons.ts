import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CreditCardIcon, LogOutIcon, SettingsIcon, UserIcon } from '#lib/ui/lucide.ts';

export default function DropdownMenuIcons() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content>
        <ui-dropdown-menu-item>
          ${UserIcon()}
          Profile
        </ui-dropdown-menu-item>
        <ui-dropdown-menu-item>
          ${CreditCardIcon()}
          Billing
        </ui-dropdown-menu-item>
        <ui-dropdown-menu-item>
          ${SettingsIcon()}
          Settings
        </ui-dropdown-menu-item>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-item variant="destructive">
          ${LogOutIcon()}
          Log out
        </ui-dropdown-menu-item>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
