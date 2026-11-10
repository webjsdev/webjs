import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarFallbackClass, avatarImageClass } from '#modules/ui/components/avatar.ts';
import { bubbleClass, bubbleContentClass, bubbleGroupClass } from '#modules/ui/components/bubble.ts';
import { messageClass, messageAvatarClass, messageContentClass } from '#modules/ui/components/message.ts';

// The fallback fills the circle and the image paints over it, so a missing
// image leaves the initials.
const avatar = (src: string, fallback: string) => html`
  <span data-slot="avatar" data-size="default" class=${avatarClass()}>
    <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'absolute inset-0')}>${fallback}</span>
    <img data-slot="avatar-image" src=${src} alt="@avatar" class=${cn(avatarImageClass(), 'relative')}>
  </span>
`;

export default function MessageAvatarDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-6 py-12">
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/03.png', 'R')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>
              The build failed during dependency installation.
            </div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/10.png', 'R')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Can you share the exact error?</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/03.png', 'R')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble-group" class=${bubbleGroupClass()}>
            <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=${bubbleContentClass()}>Here's the error from the logs</div>
            </div>
            <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=${bubbleContentClass()}>
                Something went wrong with the build. The libraries are not
                installed correctly. Try running the build again.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
