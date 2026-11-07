import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass,
} from '#modules/ui/components/attachment.ts';
import { FileTextIcon } from '#lib/ui/lucide.ts';

export default function AttachmentSizes() {
  return html`
    <div class="mx-auto flex w-full max-w-sm flex-col gap-3 py-12">
      <div data-slot="attachment" data-state="done" data-size="default" data-orientation="horizontal" class=${cn(attachmentClass({ size: 'default' }), 'w-full')}>
        <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
          ${FileTextIcon()}
        </div>
        <div data-slot="attachment-content" class=${attachmentContentClass()}>
          <span data-slot="attachment-title" class=${attachmentTitleClass()}>Default attachment</span>
          <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>PDF · 2.4 MB</span>
        </div>
      </div>
      <div data-slot="attachment" data-state="done" data-size="sm" data-orientation="horizontal" class=${cn(attachmentClass({ size: 'sm' }), 'w-full')}>
        <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
          ${FileTextIcon()}
        </div>
        <div data-slot="attachment-content" class=${attachmentContentClass()}>
          <span data-slot="attachment-title" class=${attachmentTitleClass()}>Small attachment</span>
          <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>PDF · 2.4 MB</span>
        </div>
      </div>
      <div data-slot="attachment" data-state="done" data-size="xs" data-orientation="horizontal" class=${cn(attachmentClass({ size: 'xs' }), 'w-full')}>
        <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
          ${FileTextIcon()}
        </div>
        <div data-slot="attachment-content" class=${attachmentContentClass()}>
          <span data-slot="attachment-title" class=${attachmentTitleClass()}>Extra small attachment</span>
        </div>
      </div>
    </div>
  `;
}
