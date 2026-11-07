import { html } from '@webjsdev/core';

// Each group is one radio set: checking an item unchecks the others in its
// group, so the two groups keep their own choice.
export default function ContextMenuRadio() {
  return html`
    <ui-context-menu class="w-full max-w-xs">
      <ui-context-menu-trigger>
        <div tabindex="0" class="flex aspect-video w-full max-w-xs items-center justify-center rounded-xl border border-dashed text-sm">
          <span class="hidden pointer-fine:inline-block">Right click here</span>
          <span class="hidden pointer-coarse:inline-block">Long press here</span>
        </div>
      </ui-context-menu-trigger>
      <ui-context-menu-content>
        <ui-context-menu-group aria-label="People">
          <ui-context-menu-label>People</ui-context-menu-label>
          <ui-context-menu-item type="radio" value="pedro" checked>Pedro Duarte</ui-context-menu-item>
          <ui-context-menu-item type="radio" value="colm">Colm Tuite</ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group aria-label="Theme">
          <ui-context-menu-label>Theme</ui-context-menu-label>
          <ui-context-menu-item type="radio" value="light" checked>Light</ui-context-menu-item>
          <ui-context-menu-item type="radio" value="dark">Dark</ui-context-menu-item>
          <ui-context-menu-item type="radio" value="system">System</ui-context-menu-item>
        </ui-context-menu-group>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
