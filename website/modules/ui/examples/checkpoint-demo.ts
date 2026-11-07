import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';

function user(text: string) {
  return html`
    <div data-slot="message" data-align="end" class=${messageClass()}>
      <div data-slot="message-content" class=${messageContentClass()}>
        <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
          <div data-slot="bubble-content" class=${bubbleContentClass()}>${text}</div>
        </div>
      </div>
    </div>
  `;
}

function agent(text: string) {
  return html`
    <div data-slot="message" data-align="start" class=${messageClass()}>
      <div data-slot="message-content" class=${messageContentClass()}>
        <p>${text}</p>
      </div>
    </div>
  `;
}

// The whole conversation. The checkpoint after the first turn offers Restore,
// since there are later turns to drop. Restoring is the reader's to wire.
export default function CheckpointDemo() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      ${user('Rename the button component to action.')}
      ${agent('Renamed Button to Action in components/ui/button.tsx.')}
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'inline-flex items-center gap-2')}>
          Button renamed
          <button type="button" aria-label="Restore to Button renamed" data-slot="button" data-variant="outline" data-size="xs" class=${buttonClass({ variant: 'outline', size: 'xs' })}>
            Restore
          </button>
        </span>
      </div>
      ${user('Update the docs to match.')}
      ${agent('Updated the Button page to say Action.')}
    </div>
  `;
}
