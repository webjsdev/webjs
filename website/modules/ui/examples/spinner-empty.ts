import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function SpinnerEmpty() {
  return html`
    <div data-slot="empty" class=${cn(emptyClass(), 'w-full')}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>
          ${spinner()}
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>Processing your request</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          Please wait while we process your request. Do not refresh the page.
        </div>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
          Cancel
        </button>
      </div>
    </div>
  `;
}
