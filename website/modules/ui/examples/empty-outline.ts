import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { IconCloud } from '#lib/ui/tabler.ts';

export default function EmptyOutline() {
  return html`
    <div data-slot="empty" class=${cn(emptyClass(), 'border border-dashed')}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>
          ${IconCloud()}
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>Cloud Storage Empty</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          Upload files to your cloud storage to access them anywhere.
        </div>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
          Upload Files
        </button>
      </div>
    </div>
  `;
}
