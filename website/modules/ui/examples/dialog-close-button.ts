import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass,
} from '#modules/ui/components/dialog.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

export default function DialogCloseButton() {
  return html`
    <ui-dialog>
      <ui-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Share</button>
      </ui-dialog-trigger>
      <ui-dialog-content class="sm:max-w-md">
        <div data-slot="dialog-header" class=${dialogHeaderClass()}>
          <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Share link</h2>
          <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
            Anyone who has this link will be able to view this.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="grid flex-1 gap-2">
            <label data-slot="label" for="link" class=${cn(labelClass(), 'sr-only')}>Link</label>
            <input data-slot="input" id="link" value="https://ui.shadcn.com/docs/installation" readonly class=${inputClass()}>
          </div>
        </div>
        <div data-slot="dialog-footer" class=${cn(dialogFooterClass(), 'sm:justify-start')}>
          <ui-dialog-close>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Close</button>
          </ui-dialog-close>
        </div>
      </ui-dialog-content>
    </ui-dialog>
  `;
}
