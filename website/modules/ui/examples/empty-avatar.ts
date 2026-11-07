import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';

export default function EmptyAvatar() {
  return html`
    <div data-slot="empty" class=${emptyClass()}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="default" class=${emptyMediaClass({ variant: 'default' })}>
          <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'size-12')}>
            <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="" class=${cn(avatarImageClass(), 'grayscale')}>
            <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
          </span>
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>User Offline</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          This user is currently offline. You can leave a message to notify them
          or try again later.
        </div>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${buttonClass({ size: 'sm' })}>Leave Message</button>
      </div>
    </div>
  `;
}
