import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  avatarClass, avatarImageClass, avatarFallbackClass, avatarGroupClass,
} from '#modules/ui/components/avatar.ts';

export default function AvatarGroupExample() {
  return html`
    <div data-slot="avatar-group" class=${cn(avatarGroupClass(), 'grayscale')}>
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
  `;
}
