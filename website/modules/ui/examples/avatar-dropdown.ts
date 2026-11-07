import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';

export default function AvatarDropdown() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="ghost" data-size="icon" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'rounded-full')}>
          <span data-slot="avatar" data-size="default" class=${avatarClass()}>
            <img data-slot="avatar-image" src="https://github.com/shadcn.png" alt="shadcn" class=${avatarImageClass()}>
            <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>CN</span>
          </span>
        </button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="w-32">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Billing</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item variant="destructive">Log out</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
