import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass, attachmentActionsClass, attachmentActionClass,
} from '#modules/ui/components/attachment.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { DownloadIcon, FileTextIcon } from '#lib/ui/lucide.ts';

export default function MessageAttachmentDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="attachment" data-state="done" data-size="default" data-orientation="vertical" class=${attachmentClass({ orientation: 'vertical' })}>
            <div data-slot="attachment-media" data-variant="image" class=${attachmentMediaClass({ variant: 'image' })}>
              <img
                src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&auto=format&fit=crop&q=80"
                alt="Workspace"
              >
            </div>
          </div>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>
              Here's the image. Can you add it to the PDF? Use it for the
              cover page.
            </div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>
              Done. Here's the PDF with the image added as the cover page.
            </div>
          </div>
          <div data-slot="attachment" data-state="done" data-size="default" data-orientation="horizontal" class=${attachmentClass()}>
            <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
              ${FileTextIcon()}
            </div>
            <div data-slot="attachment-content" class=${attachmentContentClass()}>
              <span data-slot="attachment-title" class=${attachmentTitleClass()}>sales-dashboard.pdf</span>
              <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>PDF · 2.4 MB</span>
            </div>
            <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
              <button type="button" data-slot="attachment-action" data-variant="secondary" data-size="icon-sm" title="Download" aria-label="Download" class=${cn(buttonClass({ variant: 'secondary', size: 'icon-sm' }), attachmentActionClass())}>
                ${DownloadIcon()}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Thanks. Looks good.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
