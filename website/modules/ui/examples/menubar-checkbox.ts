import { html } from '@webjsdev/core';

export default function MenubarCheckbox() {
  return html`
    <ui-menubar class="w-72">
      <ui-menubar-menu>
        <ui-menubar-trigger>View</ui-menubar-trigger>
        <ui-menubar-content class="w-64">
          <ui-menubar-item type="checkbox">Always Show Bookmarks Bar</ui-menubar-item>
          <ui-menubar-item type="checkbox" checked>
            Always Show Full URLs
          </ui-menubar-item>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-item inset>
            Reload <ui-menubar-shortcut>⌘R</ui-menubar-shortcut>
          </ui-menubar-item>
          <ui-menubar-item data-disabled inset>
            Force Reload <ui-menubar-shortcut>⇧⌘R</ui-menubar-shortcut>
          </ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>Format</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-item type="checkbox" checked>Strikethrough</ui-menubar-item>
          <ui-menubar-item type="checkbox">Code</ui-menubar-item>
          <ui-menubar-item type="checkbox">Superscript</ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;
}
