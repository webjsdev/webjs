import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function DropdownMenuShortcuts() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
          <ui-dropdown-menu-item>
            Profile
            <ui-dropdown-menu-shortcut>⇧⌘P</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            Billing
            <ui-dropdown-menu-shortcut>⌘B</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            Settings
            <ui-dropdown-menu-shortcut>⌘S</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-item>
          Log out
          <ui-dropdown-menu-shortcut>⇧⌘Q</ui-dropdown-menu-shortcut>
        </ui-dropdown-menu-item>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
