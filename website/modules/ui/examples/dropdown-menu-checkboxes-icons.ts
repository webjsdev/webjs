import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { BellIcon, MailIcon, MessageSquareIcon } from '#lib/ui/lucide.ts';

export default function DropdownMenuCheckboxesIcons() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Notifications</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="w-48">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>Notification Preferences</ui-dropdown-menu-label>
          <ui-dropdown-menu-item type="checkbox" value="email" checked>
            ${MailIcon()}
            Email notifications
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="checkbox" value="sms">
            ${MessageSquareIcon()}
            SMS notifications
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="checkbox" value="push" checked>
            ${BellIcon()}
            Push notifications
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
