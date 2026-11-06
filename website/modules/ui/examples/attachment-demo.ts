import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass, attachmentActionsClass, attachmentActionClass, attachmentGroupClass,
} from '#modules/ui/components/attachment.ts';
import { FileCodeIcon, XIcon } from '#lib/ui/lucide.ts';

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

export default function AttachmentDemo() {
  return html`
    <div class="mx-auto flex w-full max-w-sm flex-col gap-3 py-12">
      <div data-slot="attachment-group" class=${attachmentGroupClass()}>
        ${images.map((image) => html`
          <div data-slot="attachment" data-state="done" data-size="default" data-orientation="vertical" class=${attachmentClass({ orientation: 'vertical' })}>
            <div data-slot="attachment-media" data-variant="image" class=${attachmentMediaClass({ variant: 'image' })}>
              <img src=${image.src} alt=${image.alt}>
            </div>
            <div data-slot="attachment-content" class=${attachmentContentClass()}>
              <span data-slot="attachment-title" class=${attachmentTitleClass()}>${image.name}</span>
              <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>${image.meta}</span>
            </div>
          </div>
        `)}
      </div>
      <div data-slot="attachment" data-state="uploading" data-size="default" data-orientation="horizontal" class=${cn(attachmentClass(), 'w-full')}>
        <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
          ${spinner()}
        </div>
        <div data-slot="attachment-content" class=${attachmentContentClass()}>
          <span data-slot="attachment-title" class=${attachmentTitleClass()}>sales-dashboard.pdf</span>
          <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>Uploading · 64%</span>
        </div>
        <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
          <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label="Cancel upload" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
            ${XIcon()}
          </button>
        </div>
      </div>
      <div data-slot="attachment" data-state="done" data-size="default" data-orientation="horizontal" class=${cn(attachmentClass(), 'w-full')}>
        <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
          ${FileCodeIcon()}
        </div>
        <div data-slot="attachment-content" class=${attachmentContentClass()}>
          <span data-slot="attachment-title" class=${attachmentTitleClass()}>message-renderer.tsx</span>
          <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>TypeScript · 12 KB</span>
        </div>
        <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
          <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label="Remove message-renderer.tsx" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
            ${XIcon()}
          </button>
        </div>
      </div>
    </div>
  `;
}
