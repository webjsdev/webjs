import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass, attachmentActionsClass, attachmentActionClass, attachmentGroupClass,
} from '#modules/ui/components/attachment.ts';
import { FileCodeIcon, FileTextIcon, TableIcon, XIcon } from '#lib/ui/lucide.ts';

type Item = {
  name: string;
  meta: string;
  icon?: (cls?: string) => unknown;
  src?: string;
};

const items: Item[] = [
  { name: 'briefing-notes.pdf', meta: 'PDF · 1.4 MB', icon: FileTextIcon },
  {
    name: 'workspace.png',
    meta: 'PNG · 820 KB',
    src: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&auto=format&fit=crop&q=80',
  },
  { name: 'customers.csv', meta: 'CSV · 18 KB', icon: TableIcon },
  { name: 'renderer.tsx', meta: 'TSX · 12 KB', icon: FileCodeIcon },
];

export default function AttachmentGroupDemo() {
  return html`
    <div class="mx-auto w-full max-w-sm py-12">
      <div data-slot="attachment-group" class=${cn(attachmentGroupClass(), 'w-full')}>
        ${items.map((item) => html`
          <div data-slot="attachment" data-state="done" data-size="default" data-orientation="horizontal" class=${cn(attachmentClass(), 'w-64')}>
            ${item.src
              ? html`<div data-slot="attachment-media" data-variant="image" class=${attachmentMediaClass({ variant: 'image' })}>
                  <img src=${item.src} alt=${item.name}>
                </div>`
              : item.icon
                ? html`<div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
                    ${item.icon()}
                  </div>`
                : ''}
            <div data-slot="attachment-content" class=${attachmentContentClass()}>
              <span data-slot="attachment-title" class=${attachmentTitleClass()}>${item.name}</span>
              <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>${item.meta}</span>
            </div>
            <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
              <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label=${`Remove ${item.name}`} class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
                ${XIcon()}
              </button>
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}
