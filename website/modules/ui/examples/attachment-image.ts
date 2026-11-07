import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass, attachmentActionsClass, attachmentActionClass, attachmentTriggerClass,
  attachmentGroupClass,
} from '#modules/ui/components/attachment.ts';
import { XIcon } from '#lib/ui/lucide.ts';

const images = [
  {
    name: 'workspace.png',
    meta: 'PNG · 820 KB',
    src: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&auto=format&fit=crop&q=80',
    alt: 'Workspace',
  },
  {
    name: 'desk-reference.jpg',
    meta: 'JPG · 1.1 MB',
    src: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=900&auto=format&fit=crop&q=80',
    alt: 'Desk',
  },
  {
    name: 'office-reference.jpg',
    meta: 'JPG · 940 KB',
    src: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&auto=format&fit=crop&q=80',
    alt: 'Office',
  },
];

export default function AttachmentImage() {
  return html`
    <div class="mx-auto w-full max-w-sm py-12">
      <div data-slot="attachment-group" class=${cn(attachmentGroupClass(), 'w-full')}>
        ${images.map((image) => html`
          <div data-slot="attachment" data-state="done" data-size="default" data-orientation="vertical" class=${attachmentClass({ orientation: 'vertical' })}>
            <div data-slot="attachment-media" data-variant="image" class=${attachmentMediaClass({ variant: 'image' })}>
              <img src=${image.src} alt=${image.alt}>
            </div>
            <div data-slot="attachment-content" class=${attachmentContentClass()}>
              <span data-slot="attachment-title" class=${attachmentTitleClass()}>${image.name}</span>
              <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>${image.meta}</span>
            </div>
            <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
              <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label=${`Remove ${image.name}`} class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
                ${XIcon()}
              </button>
            </div>
            <a data-slot="attachment-trigger" href=${image.src} target="_blank" rel="noreferrer" aria-label=${`Open ${image.name}`} class=${attachmentTriggerClass()}></a>
          </div>
        `)}
      </div>
    </div>
  `;
}
