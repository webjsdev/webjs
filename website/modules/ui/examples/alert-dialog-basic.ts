import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  alertDialogHeaderClass, alertDialogFooterClass, alertDialogTitleClass, alertDialogDescriptionClass,
} from '#modules/ui/components/alert-dialog.ts';

export default function AlertDialogBasic() {
  return html`
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Show Dialog</button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content>
        <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
          <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>Are you absolutely sure?</h2>
          <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </p>
        </div>
        <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
          <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
          <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
        </div>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `;
}
