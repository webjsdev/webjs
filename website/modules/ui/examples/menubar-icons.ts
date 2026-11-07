import { html } from '@webjsdev/core';
import {
  FileIcon, FolderIcon, HelpCircleIcon, SaveIcon, SettingsIcon, TrashIcon,
} from '#lib/ui/lucide.ts';

export default function MenubarIcons() {
  return html`
    <ui-menubar class="w-72">
      <ui-menubar-menu>
        <ui-menubar-trigger>File</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-item>
            ${FileIcon()}
            New File <ui-menubar-shortcut>⌘N</ui-menubar-shortcut>
          </ui-menubar-item>
          <ui-menubar-item>
            ${FolderIcon()}
            Open Folder
          </ui-menubar-item>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-item>
            ${SaveIcon()}
            Save <ui-menubar-shortcut>⌘S</ui-menubar-shortcut>
          </ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>More</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group>
            <ui-menubar-item>
              ${SettingsIcon()}
              Settings
            </ui-menubar-item>
            <ui-menubar-item>
              ${HelpCircleIcon()}
              Help
            </ui-menubar-item>
            <ui-menubar-separator></ui-menubar-separator>
            <ui-menubar-item variant="destructive">
              ${TrashIcon()}
              Delete
            </ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;
}
