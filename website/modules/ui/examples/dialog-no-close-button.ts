import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass,
} from '#modules/ui/components/dialog.ts';

export default function DialogNoCloseButton() {
  return html`
    <ui-dialog>
      <ui-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>No Close Button</button>
      </ui-dialog-trigger>
      <ui-dialog-content show-close-button="false">
        <div data-slot="dialog-header" class=${dialogHeaderClass()}>
          <h2 data-slot="dialog-title" class=${dialogTitleClass()}>No Close Button</h2>
          <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
            This dialog doesn&apos;t have a close button in the top-right
            corner.
          </p>
        </div>
      </ui-dialog-content>
    </ui-dialog>
  `;
}
