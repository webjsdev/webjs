import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass,
} from '#modules/ui/components/dialog.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass, attachmentActionsClass, attachmentActionClass, attachmentTriggerClass,
} from '#modules/ui/components/attachment.ts';
import { CopyIcon, FileSearchIcon, XIcon } from '#lib/ui/lucide.ts';

export default function AttachmentTriggerDemo() {
  return html`
    <div class="mx-auto w-full max-w-sm py-12">
      <ui-dialog>
        <div data-slot="attachment" data-state="done" data-size="default" data-orientation="horizontal" class=${cn(attachmentClass(), 'w-full')}>
          <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
            ${FileSearchIcon()}
          </div>
          <div data-slot="attachment-content" class=${attachmentContentClass()}>
            <span data-slot="attachment-title" class=${attachmentTitleClass()}>research-summary.pdf</span>
            <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>Open preview dialog</span>
          </div>
          <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
            <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label="Copy link" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
              ${CopyIcon()}
            </button>
            <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label="Remove research-summary.pdf" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
              ${XIcon()}
            </button>
          </div>
          <ui-dialog-trigger>
            <button type="button" data-slot="attachment-trigger" aria-label="Preview research-summary.pdf" class=${attachmentTriggerClass()}></button>
          </ui-dialog-trigger>
        </div>
        <ui-dialog-content class="sm:max-w-md">
          <div data-slot="dialog-header" class=${dialogHeaderClass()}>
            <h2 data-slot="dialog-title" class=${dialogTitleClass()}>research-summary.pdf</h2>
            <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
              The attachment trigger fills the card and opens the dialog, while
              the actions stay independently clickable above it.
            </p>
          </div>
        </ui-dialog-content>
      </ui-dialog>
    </div>
  `;
}
