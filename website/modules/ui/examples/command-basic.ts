import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { commandDialogClass } from '#modules/ui/components/command.ts';

// shadcn's CommandDialog is a Dialog around a Command, so the button opens a
// <ui-dialog> whose content holds the command, with the title and the
// description for screen readers only.
export default function CommandBasic() {
  return html`
    <div class="flex flex-col gap-4">
      <ui-dialog>
        <ui-dialog-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-fit')}>Open Menu</button>
        </ui-dialog-trigger>
        <ui-dialog-content show-close-button="false" class=${commandDialogClass()}>
          <div data-slot="dialog-header" class="sr-only">
            <h2 data-slot="dialog-title">Command Palette</h2>
            <p data-slot="dialog-description">Search for a command to run...</p>
          </div>
          <ui-command label="Command Palette">
            <ui-command-input placeholder="Type a command or search..."></ui-command-input>
            <ui-command-list>
              <ui-command-empty>No results found.</ui-command-empty>
              <ui-command-group heading="Suggestions">
                <ui-command-item>Calendar</ui-command-item>
                <ui-command-item>Search Emoji</ui-command-item>
                <ui-command-item>Calculator</ui-command-item>
              </ui-command-group>
            </ui-command-list>
          </ui-command>
        </ui-dialog-content>
      </ui-dialog>
    </div>
  `;
}
