import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { PencilIcon, ShareIcon, TrashIcon } from '#lib/ui/lucide.ts';

export default function DropdownMenuDestructive() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Actions</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>
            ${PencilIcon()}
            Edit
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${ShareIcon()}
            Share
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item variant="destructive">
            ${TrashIcon()}
            Delete
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
