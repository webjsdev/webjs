import { html } from '@webjsdev/core';
import {
  CalculatorIcon, CalendarIcon, CreditCardIcon, SettingsIcon, SmileIcon, UserIcon,
} from '#lib/ui/lucide.ts';

export default function CommandDemo() {
  return html`
    <ui-command label="Command menu" class="max-w-sm rounded-lg border">
      <ui-command-input placeholder="Type a command or search..."></ui-command-input>
      <ui-command-list>
        <ui-command-empty>No results found.</ui-command-empty>
        <ui-command-group heading="Suggestions">
          <ui-command-item>
            ${CalendarIcon()}
            <span>Calendar</span>
          </ui-command-item>
          <ui-command-item>
            ${SmileIcon()}
            <span>Search Emoji</span>
          </ui-command-item>
          <ui-command-item disabled>
            ${CalculatorIcon()}
            <span>Calculator</span>
          </ui-command-item>
        </ui-command-group>
        <ui-command-separator></ui-command-separator>
        <ui-command-group heading="Settings">
          <ui-command-item>
            ${UserIcon()}
            <span>Profile</span>
            <ui-command-shortcut>⌘P</ui-command-shortcut>
          </ui-command-item>
          <ui-command-item>
            ${CreditCardIcon()}
            <span>Billing</span>
            <ui-command-shortcut>⌘B</ui-command-shortcut>
          </ui-command-item>
          <ui-command-item>
            ${SettingsIcon()}
            <span>Settings</span>
            <ui-command-shortcut>⌘S</ui-command-shortcut>
          </ui-command-item>
        </ui-command-group>
      </ui-command-list>
    </ui-command>
  `;
}
