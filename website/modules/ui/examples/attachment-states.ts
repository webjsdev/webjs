import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import {
  attachmentClass, attachmentMediaClass, attachmentContentClass, attachmentTitleClass,
  attachmentDescriptionClass, attachmentActionsClass, attachmentActionClass,
} from '#modules/ui/components/attachment.ts';
import {
  CheckIcon, ClockIcon, FileTextIcon, FileWarningIcon, RefreshCwIcon, XIcon,
} from '#lib/ui/lucide.ts';

type State = 'idle' | 'uploading' | 'processing' | 'error' | 'done';

const action = (label: string, icon: unknown) => html`
  <button type="button" data-slot="attachment-action" data-variant="ghost" data-size="icon-xs" aria-label=${label} class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), attachmentActionClass())}>
    ${icon}
  </button>
`;

const attachment = (state: State, media: unknown, title: string, description: string, actions: unknown) => html`
  <div data-slot="attachment" data-state=${state} data-size="default" data-orientation="horizontal" class=${cn(attachmentClass(), 'w-full')}>
    <div data-slot="attachment-media" data-variant="icon" class=${attachmentMediaClass()}>
      ${media}
    </div>
    <div data-slot="attachment-content" class=${attachmentContentClass()}>
      <span data-slot="attachment-title" class=${attachmentTitleClass()}>${title}</span>
      <span data-slot="attachment-description" class=${attachmentDescriptionClass()}>${description}</span>
    </div>
    <div data-slot="attachment-actions" class=${attachmentActionsClass()}>
      ${actions}
    </div>
  </div>
`;

export default function AttachmentStates() {
  return html`
    <div class="mx-auto flex w-full max-w-sm flex-col gap-2 py-12">
      ${attachment('idle', ClockIcon(), 'selected-file.pdf', 'Ready to upload',
        action('Remove selected-file.pdf', XIcon()))}
      ${attachment('uploading', spinner(), 'design-system.zip', 'Uploading · 64%',
        action('Cancel upload', XIcon()))}
      ${attachment('processing', FileTextIcon(), 'market-research.pdf', 'Processing document',
        action('Remove market-research.pdf', XIcon()))}
      ${attachment('error', FileWarningIcon(), 'financial-model.xlsx', 'Upload failed. Try again.', html`
        ${action('Retry upload', RefreshCwIcon())}
        ${action('Remove financial-model.xlsx', XIcon())}
      `)}
      ${attachment('done', CheckIcon(), 'uploaded-report.pdf', 'Uploaded · 1.8 MB',
        action('Remove uploaded-report.pdf', XIcon()))}
    </div>
  `;
}
