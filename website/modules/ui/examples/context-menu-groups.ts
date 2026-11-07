import { html } from '@webjsdev/core';

export default function ContextMenuGroups() {
  return html`
    <ui-context-menu class="w-full max-w-xs">
      <ui-context-menu-trigger>
        <div tabindex="0" class="flex aspect-video w-full max-w-xs items-center justify-center rounded-xl border border-dashed text-sm">
          <span class="hidden pointer-fine:inline-block">Right click here</span>
          <span class="hidden pointer-coarse:inline-block">Long press here</span>
        </div>
      </ui-context-menu-trigger>
      <ui-context-menu-content>
        <ui-context-menu-group>
          <ui-context-menu-label>File</ui-context-menu-label>
          <ui-context-menu-item>
            New File
            <ui-context-menu-shortcut>⌘N</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Open File
            <ui-context-menu-shortcut>⌘O</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Save
            <ui-context-menu-shortcut>⌘S</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group>
          <ui-context-menu-label>Edit</ui-context-menu-label>
          <ui-context-menu-item>
            Undo
            <ui-context-menu-shortcut>⌘Z</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Redo
            <ui-context-menu-shortcut>⇧⌘Z</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group>
          <ui-context-menu-item>
            Cut
            <ui-context-menu-shortcut>⌘X</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Copy
            <ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Paste
            <ui-context-menu-shortcut>⌘V</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group>
          <ui-context-menu-item variant="destructive">
            Delete
            <ui-context-menu-shortcut>⌫</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
