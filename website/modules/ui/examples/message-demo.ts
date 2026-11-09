import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarFallbackClass, avatarImageClass } from '#modules/ui/components/avatar.ts';
import {
  bubbleClass, bubbleContentClass, bubbleGroupClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';
import {
  messageClass, messageAvatarClass, messageContentClass, messageFooterClass,
} from '#modules/ui/components/message.ts';

// Radix's Avatar shows the image once it loads and the fallback otherwise.
// With no script the two are stacked instead: the fallback fills the circle
// and the image paints over it, so a missing image leaves the initials.
const avatar = (src: string, fallback: string) => html`
  <span data-slot="avatar" data-size="default" class=${avatarClass()}>
    <span data-slot="avatar-fallback" class=${cn(avatarFallbackClass(), 'absolute inset-0')}>${fallback}</span>
    <img data-slot="avatar-image" src=${src} alt="" class=${cn(avatarImageClass(), 'relative')}>
  </span>
`;

export default function MessageDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-6 py-12">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/10.png', 'ME')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Deploying to prod real quick.</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/02.png', 'R')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>It's 4:55 PM. On a Friday.</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/10.png', 'ME')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>It's a one-line change.</div>
          </div>
          <div data-slot="message-footer" class=${messageFooterClass()}>Delivered</div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-avatar" class=${messageAvatarClass()}>
          ${avatar('/avatars/02.png', 'R')}
        </div>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble-group" class=${bubbleGroupClass()}>
            <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=${bubbleContentClass()}>
                It's always a one-line change 😭.
              </div>
            </div>
            <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=${bubbleContentClass()}>Alright, let me take a look.</div>
              <div data-slot="bubble-reactions" data-align="end" data-side="bottom" aria-label="Reactions: thumbs up" class=${bubbleReactionsClass()}>
                <span>👍</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div data-slot="marker" data-variant="default" role="status" class=${markerClass()}>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'shimmer')}>
          <span class="font-medium">Oliver</span> is typing...
        </span>
      </div>
    </div>
  `;
}
