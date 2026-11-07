import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function DropdownMenuBasic() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
          <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Billing</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-item>GitHub</ui-dropdown-menu-item>
        <ui-dropdown-menu-item>Support</ui-dropdown-menu-item>
        <ui-dropdown-menu-item data-disabled>API</ui-dropdown-menu-item>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
