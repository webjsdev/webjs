import { html } from '@webjsdev/core';

export default function ContextMenuShortcuts() {
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
          <ui-context-menu-item>
            Back
            <ui-context-menu-shortcut>⌘[</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item data-disabled>
            Forward
            <ui-context-menu-shortcut>⌘]</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Reload
            <ui-context-menu-shortcut>⌘R</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group>
          <ui-context-menu-item>
            Save
            <ui-context-menu-shortcut>⌘S</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Save As...
            <ui-context-menu-shortcut>⇧⌘S</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
