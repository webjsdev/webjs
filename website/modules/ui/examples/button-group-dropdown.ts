import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  AlertTriangleIcon, CheckIcon, ChevronDownIcon, CopyIcon, ShareIcon, TrashIcon,
  UserRoundXIcon, VolumeOffIcon,
} from '#lib/ui/lucide.ts';

export default function ButtonGroupDropdown() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Follow</button>
      <button type="button" id="button-group-dropdown-trigger" data-slot="button" data-variant="outline" data-size="default" aria-label="More options" class=${cn(buttonClass({ variant: 'outline' }), 'pl-2!')}>
        ${ChevronDownIcon()}
      </button>
    </div>
    <ui-dropdown-menu trigger="button-group-dropdown-trigger" class="absolute">
      <ui-dropdown-menu-content align="end" class="w-44">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>
            ${VolumeOffIcon()}
            Mute Conversation
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${CheckIcon()}
            Mark as Read
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${AlertTriangleIcon()}
            Report Conversation
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${UserRoundXIcon()}
            Block User
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${ShareIcon()}
            Share Conversation
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${CopyIcon()}
            Copy Conversation
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item variant="destructive">
            ${TrashIcon()}
            Delete Conversation
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
