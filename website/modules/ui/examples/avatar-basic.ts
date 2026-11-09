import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';

export default function AvatarDemo() {
  return html`
    <span data-slot="avatar" data-size="default" class=${avatarClass()}>
      <img data-slot="avatar-image" src="/avatars/vivek.jpg" alt="@vivek" class=${cn(avatarImageClass(), 'grayscale')}>
      <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
    </span>
  `;
}
