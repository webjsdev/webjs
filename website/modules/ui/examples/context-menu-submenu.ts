import { html } from '@webjsdev/core';

export default function ContextMenuSubmenu() {
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
            Copy
            <ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Cut
            <ui-context-menu-shortcut>⌘X</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-sub>
          <ui-context-menu-sub-trigger>More Tools</ui-context-menu-sub-trigger>
          <ui-context-menu-sub-content>
            <ui-context-menu-group>
              <ui-context-menu-item>Save Page...</ui-context-menu-item>
              <ui-context-menu-item>Create Shortcut...</ui-context-menu-item>
              <ui-context-menu-item>Name Window...</ui-context-menu-item>
            </ui-context-menu-group>
            <ui-context-menu-separator></ui-context-menu-separator>
            <ui-context-menu-group>
              <ui-context-menu-item>Developer Tools</ui-context-menu-item>
            </ui-context-menu-group>
            <ui-context-menu-separator></ui-context-menu-separator>
            <ui-context-menu-group>
              <ui-context-menu-item variant="destructive">Delete</ui-context-menu-item>
            </ui-context-menu-group>
          </ui-context-menu-sub-content>
        </ui-context-menu-sub>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
