import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function DropdownMenuSubmenu() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>Team</ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>Invite users</ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-item>Email</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>Message</ui-dropdown-menu-item>
              <ui-dropdown-menu-sub>
                <ui-dropdown-menu-sub-trigger>More options</ui-dropdown-menu-sub-trigger>
                <ui-dropdown-menu-sub-content>
                  <ui-dropdown-menu-item>Calendly</ui-dropdown-menu-item>
                  <ui-dropdown-menu-item>Slack</ui-dropdown-menu-item>
                  <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                  <ui-dropdown-menu-item>Webhook</ui-dropdown-menu-item>
                </ui-dropdown-menu-sub-content>
              </ui-dropdown-menu-sub>
              <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
              <ui-dropdown-menu-item>Advanced...</ui-dropdown-menu-item>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
          <ui-dropdown-menu-item>
            New Team
            <ui-dropdown-menu-shortcut>⌘+T</ui-dropdown-menu-shortcut>
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
