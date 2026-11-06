import { html } from '@webjsdev/core';

export default function MenubarDemo() {
  return html`
    <ui-menubar class="w-72">
      <ui-menubar-menu>
        <ui-menubar-trigger>File</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group>
            <ui-menubar-item>
              New Tab <ui-menubar-shortcut>⌘T</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item>
              New Window <ui-menubar-shortcut>⌘N</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item data-disabled>New Incognito Window</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>Share</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-group>
                  <ui-menubar-item>Email link</ui-menubar-item>
                  <ui-menubar-item>Messages</ui-menubar-item>
                  <ui-menubar-item>Notes</ui-menubar-item>
                </ui-menubar-group>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item>
              Print... <ui-menubar-shortcut>⌘P</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>Edit</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group>
            <ui-menubar-item>
              Undo <ui-menubar-shortcut>⌘Z</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item>
              Redo <ui-menubar-shortcut>⇧⌘Z</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>Find</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-group>
                  <ui-menubar-item>Search the web</ui-menubar-item>
                </ui-menubar-group>
                <ui-menubar-separator></ui-menubar-separator>
                <ui-menubar-group>
                  <ui-menubar-item>Find...</ui-menubar-item>
                  <ui-menubar-item>Find Next</ui-menubar-item>
                  <ui-menubar-item>Find Previous</ui-menubar-item>
                </ui-menubar-group>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item>Cut</ui-menubar-item>
            <ui-menubar-item>Copy</ui-menubar-item>
            <ui-menubar-item>Paste</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>View</ui-menubar-trigger>
        <ui-menubar-content class="w-44">
          <ui-menubar-group>
            <ui-menubar-item type="checkbox">Bookmarks Bar</ui-menubar-item>
            <ui-menubar-item type="checkbox" checked>Full URLs</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>
              Reload <ui-menubar-shortcut>⌘R</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item data-disabled inset>
              Force Reload <ui-menubar-shortcut>⇧⌘R</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>Toggle Fullscreen</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>Hide Sidebar</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>Profiles</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group>
            <ui-menubar-item type="radio" value="andy">Andy</ui-menubar-item>
            <ui-menubar-item type="radio" value="benoit" checked>Benoit</ui-menubar-item>
            <ui-menubar-item type="radio" value="Luis">Luis</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>Edit...</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>Add Profile...</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;
}
