import { html } from '@webjsdev/core';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { PlusIcon } from '#lib/ui/lucide.ts';

export default function EmptyAvatarGroup() {
  return html`
    <div data-slot="empty" class=${emptyClass()}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="default" class=${emptyMediaClass()}>
          <div class="flex -space-x-2 *:data-[slot=avatar]:size-12 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:grayscale">
            <span data-slot="avatar" data-size="default" class=${avatarClass()}>
              <img data-slot="avatar-image" src="/avatars/vivek.jpg" alt="@vivek" class=${avatarImageClass()}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
            </span>
            <span data-slot="avatar" data-size="default" class=${avatarClass()}>
              <img data-slot="avatar-image" src="https://github.com/maxleiter.png" alt="@maxleiter" class=${avatarImageClass()}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>LR</span>
            </span>
            <span data-slot="avatar" data-size="default" class=${avatarClass()}>
              <img data-slot="avatar-image" src="https://github.com/evilrabbit.png" alt="@evilrabbit" class=${avatarImageClass()}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>ER</span>
            </span>
          </div>
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>No Team Members</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          Invite your team to collaborate on this project.
        </div>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${buttonClass({ size: 'sm' })}>
          ${PlusIcon()}
          Invite Members
        </button>
      </div>
    </div>
  `;
}
