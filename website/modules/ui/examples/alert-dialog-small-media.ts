import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  alertDialogHeaderClass, alertDialogFooterClass, alertDialogTitleClass, alertDialogDescriptionClass,
  alertDialogMediaClass,
} from '#modules/ui/components/alert-dialog.ts';
import { BluetoothIcon } from '#lib/ui/lucide.ts';

export default function AlertDialogSmallWithMedia() {
  return html`
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Show Dialog</button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content size="sm">
        <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
          <div data-slot="alert-dialog-media" aria-hidden="true" class=${alertDialogMediaClass()}>
            ${BluetoothIcon()}
          </div>
          <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>Allow accessory to connect?</h2>
          <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>
            Do you want to allow the USB accessory to connect to this device?
          </p>
        </div>
        <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
          <ui-alert-dialog-cancel>Don't allow</ui-alert-dialog-cancel>
          <ui-alert-dialog-action>Allow</ui-alert-dialog-action>
        </div>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `;
}
