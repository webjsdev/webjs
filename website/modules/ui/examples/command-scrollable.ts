import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { commandDialogClass } from '#modules/ui/components/command.ts';
import {
  BellIcon, CalculatorIcon, CalendarIcon, ClipboardPasteIcon, CodeIcon, CopyIcon,
  CreditCardIcon, FileTextIcon, FolderIcon, FolderPlusIcon, HelpCircleIcon, HomeIcon,
  ImageIcon, InboxIcon, LayoutGridIcon, ListIcon, PlusIcon, ScissorsIcon, SettingsIcon,
  TrashIcon, UserIcon, ZoomInIcon, ZoomOutIcon,
} from '#lib/ui/lucide.ts';

export default function CommandManyItems() {
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
              <ui-command-group heading="Navigation">
                <ui-command-item>
                  ${HomeIcon()}
                  <span>Home</span>
                  <ui-command-shortcut>⌘H</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${InboxIcon()}
                  <span>Inbox</span>
                  <ui-command-shortcut>⌘I</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${FileTextIcon()}
                  <span>Documents</span>
                  <ui-command-shortcut>⌘D</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${FolderIcon()}
                  <span>Folders</span>
                  <ui-command-shortcut>⌘F</ui-command-shortcut>
                </ui-command-item>
              </ui-command-group>
              <ui-command-separator></ui-command-separator>
              <ui-command-group heading="Actions">
                <ui-command-item>
                  ${PlusIcon()}
                  <span>New File</span>
                  <ui-command-shortcut>⌘N</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${FolderPlusIcon()}
                  <span>New Folder</span>
                  <ui-command-shortcut>⇧⌘N</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${CopyIcon()}
                  <span>Copy</span>
                  <ui-command-shortcut>⌘C</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${ScissorsIcon()}
                  <span>Cut</span>
                  <ui-command-shortcut>⌘X</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${ClipboardPasteIcon()}
                  <span>Paste</span>
                  <ui-command-shortcut>⌘V</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${TrashIcon()}
                  <span>Delete</span>
                  <ui-command-shortcut>⌫</ui-command-shortcut>
                </ui-command-item>
              </ui-command-group>
              <ui-command-separator></ui-command-separator>
              <ui-command-group heading="View">
                <ui-command-item>
                  ${LayoutGridIcon()}
                  <span>Grid View</span>
                </ui-command-item>
                <ui-command-item>
                  ${ListIcon()}
                  <span>List View</span>
                </ui-command-item>
                <ui-command-item>
                  ${ZoomInIcon()}
                  <span>Zoom In</span>
                  <ui-command-shortcut>⌘+</ui-command-shortcut>
                </ui-command-item>
                <ui-command-item>
                  ${ZoomOutIcon()}
                  <span>Zoom Out</span>
                  <ui-command-shortcut>⌘-</ui-command-shortcut>
                </ui-command-item>
              </ui-command-group>
              <ui-command-separator></ui-command-separator>
              <ui-command-group heading="Account">
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
                <ui-command-item>
                  ${BellIcon()}
                  <span>Notifications</span>
                </ui-command-item>
                <ui-command-item>
                  ${HelpCircleIcon()}
                  <span>Help &amp; Support</span>
                </ui-command-item>
              </ui-command-group>
              <ui-command-separator></ui-command-separator>
              <ui-command-group heading="Tools">
                <ui-command-item>
                  ${CalculatorIcon()}
                  <span>Calculator</span>
                </ui-command-item>
                <ui-command-item>
                  ${CalendarIcon()}
                  <span>Calendar</span>
                </ui-command-item>
                <ui-command-item>
                  ${ImageIcon()}
                  <span>Image Editor</span>
                </ui-command-item>
                <ui-command-item>
                  ${CodeIcon()}
                  <span>Code Editor</span>
                </ui-command-item>
              </ui-command-group>
            </ui-command-list>
          </ui-command>
        </ui-dialog-content>
      </ui-dialog>
    </div>
  `;
}
