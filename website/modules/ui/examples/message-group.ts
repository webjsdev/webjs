import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarFallbackClass, avatarImageClass } from '#modules/ui/components/avatar.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import {
  messageClass, messageAvatarClass, messageContentClass, messageGroupClass,
} from '#modules/ui/components/message.ts';

export default function MessageGroupDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-6 py-12">
      <div data-slot="message-group" class=${messageGroupClass()}>
        <div data-slot="message" data-align="start" class=${messageClass()}>
          <div data-slot="message-avatar" class=${messageAvatarClass()}></div>
          <div data-slot="message-content" class=${messageContentClass()}>
            <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=${bubbleContentClass()}>I checked the registry addresses.</div>
            </div>
          </div>
        </div>
        <div data-slot="message" data-align="start" class=${messageClass()}>
          <div data-slot="message-avatar" class=${messageAvatarClass()}>
            <span data-slot="avatar" data-size="default" class=${avatarClass()}>
              <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'absolute inset-0')}>CN</span>
              <img data-slot="avatar-image" src="/public/avatars/02.png" alt="@avatar" class=${cn(avatarImageClass(), 'relative')}>
            </span>
          </div>
          <div data-slot="message-content" class=${messageContentClass()}>
            <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=${bubbleContentClass()}>
                The component and example JSON now live under the UI registry.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
