import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  avatarClass, avatarImageClass, avatarFallbackClass, avatarBadgeClass,
  avatarGroupClass, avatarGroupCountClass,
} from '#modules/ui/components/avatar.ts';

export default function AvatarDemo() {
  return html`
    <div class="flex flex-row flex-wrap items-center gap-6 md:gap-12">
      <span data-slot="avatar" data-size="default" class=${avatarClass()}>
        <img data-slot="avatar-image" src="https://github.com/shadcn.png" alt="@shadcn" class=${cn(avatarImageClass(), 'grayscale')}>
        <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>CN</span>
      </span>
      <span data-slot="avatar" data-size="default" class=${avatarClass()}>
        <img data-slot="avatar-image" src="https://github.com/evilrabbit.png" alt="@evilrabbit" class=${avatarImageClass()}>
        <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>ER</span>
        <span data-slot="avatar-badge" class=${cn(avatarBadgeClass(), 'bg-green-600 dark:bg-green-800')}></span>
      </span>
      <div data-slot="avatar-group" class=${cn(avatarGroupClass(), 'grayscale')}>
        <span data-slot="avatar" data-size="default" class=${avatarClass()}>
          <img data-slot="avatar-image" src="https://github.com/shadcn.png" alt="@shadcn" class=${avatarImageClass()}>
          <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>CN</span>
        </span>
        <span data-slot="avatar" data-size="default" class=${avatarClass()}>
          <img data-slot="avatar-image" src="https://github.com/maxleiter.png" alt="@maxleiter" class=${avatarImageClass()}>
          <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>LR</span>
        </span>
        <span data-slot="avatar" data-size="default" class=${avatarClass()}>
          <img data-slot="avatar-image" src="https://github.com/evilrabbit.png" alt="@evilrabbit" class=${avatarImageClass()}>
          <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>ER</span>
        </span>
        <div data-slot="avatar-group-count" class=${avatarGroupCountClass()}>+3</div>
      </div>
    </div>
  `;
}
