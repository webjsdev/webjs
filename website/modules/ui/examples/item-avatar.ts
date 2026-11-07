import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass,
  itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { Plus } from '#lib/ui/lucide.ts';

export default function ItemAvatar() {
  return html`
    <div class="flex w-full max-w-lg flex-col gap-6">
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
          <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'size-10')}>
            <img data-slot="avatar-image" src="https://github.com/evilrabbit.png" alt="" class=${avatarImageClass()}>
            <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>ER</span>
          </span>
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Evil Rabbit</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>Last seen 5 months ago</p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="icon-sm" aria-label="Invite" class=${cn(buttonClass({ variant: 'outline', size: 'icon-sm' }), 'rounded-full')}>
            ${Plus()}
          </button>
        </div>
      </div>
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
          <div class="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:grayscale">
            <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'hidden sm:flex')}>
              <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=${avatarImageClass()}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
            </span>
            <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'hidden sm:flex')}>
              <img data-slot="avatar-image" src="https://github.com/maxleiter.png" alt="@maxleiter" class=${avatarImageClass()}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>LR</span>
            </span>
            <span data-slot="avatar" data-size="default" class=${avatarClass()}>
              <img data-slot="avatar-image" src="https://github.com/evilrabbit.png" alt="@evilrabbit" class=${avatarImageClass()}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>ER</span>
            </span>
          </div>
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>No Team Members</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            Invite your team to collaborate on this project.
          </p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
            Invite
          </button>
        </div>
      </div>
    </div>
  `;
}
