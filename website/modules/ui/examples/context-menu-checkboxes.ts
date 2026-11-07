import { html } from '@webjsdev/core';

export default function ContextMenuCheckboxes() {
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
          <ui-context-menu-item type="checkbox" checked>Show Bookmarks Bar</ui-context-menu-item>
          <ui-context-menu-item type="checkbox">Show Full URLs</ui-context-menu-item>
          <ui-context-menu-item type="checkbox" checked>Show Developer Tools</ui-context-menu-item>
        </ui-context-menu-group>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
