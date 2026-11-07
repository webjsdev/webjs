import { html } from '@webjsdev/core';

export default function MenubarSubmenu() {
  return html`
    <ui-menubar class="w-72">
      <ui-menubar-menu>
        <ui-menubar-trigger>File</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-sub>
            <ui-menubar-sub-trigger>Share</ui-menubar-sub-trigger>
            <ui-menubar-sub-content>
              <ui-menubar-item>Email link</ui-menubar-item>
              <ui-menubar-item>Messages</ui-menubar-item>
              <ui-menubar-item>Notes</ui-menubar-item>
            </ui-menubar-sub-content>
          </ui-menubar-sub>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-item>
            Print... <ui-menubar-shortcut>⌘P</ui-menubar-shortcut>
          </ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>Edit</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-item>
            Undo <ui-menubar-shortcut>⌘Z</ui-menubar-shortcut>
          </ui-menubar-item>
          <ui-menubar-item>
            Redo <ui-menubar-shortcut>⇧⌘Z</ui-menubar-shortcut>
          </ui-menubar-item>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-sub>
            <ui-menubar-sub-trigger>Find</ui-menubar-sub-trigger>
            <ui-menubar-sub-content>
              <ui-menubar-item>Find...</ui-menubar-item>
              <ui-menubar-item>Find Next</ui-menubar-item>
              <ui-menubar-item>Find Previous</ui-menubar-item>
            </ui-menubar-sub-content>
          </ui-menubar-sub>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-item>Cut</ui-menubar-item>
          <ui-menubar-item>Copy</ui-menubar-item>
          <ui-menubar-item>Paste</ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;
}
