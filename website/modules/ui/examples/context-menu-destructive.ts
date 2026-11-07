import { html } from '@webjsdev/core';
import { PencilIcon, ShareIcon, TrashIcon } from '#lib/ui/lucide.ts';

export default function ContextMenuDestructive() {
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
            ${PencilIcon()}
            Edit
          </ui-context-menu-item>
          <ui-context-menu-item>
            ${ShareIcon()}
            Share
          </ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group>
          <ui-context-menu-item variant="destructive">
            ${TrashIcon()}
            Delete
          </ui-context-menu-item>
        </ui-context-menu-group>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
