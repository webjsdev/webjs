import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  alertDialogHeaderClass, alertDialogFooterClass, alertDialogTitleClass, alertDialogDescriptionClass,
  alertDialogMediaClass,
} from '#modules/ui/components/alert-dialog.ts';
import { CircleFadingPlusIcon } from '#lib/ui/lucide.ts';

export default function AlertDialogWithMedia() {
  return html`
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Share Project</button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content>
        <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
          <div data-slot="alert-dialog-media" aria-hidden="true" class=${alertDialogMediaClass()}>
            ${CircleFadingPlusIcon()}
          </div>
          <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>Share this project?</h2>
          <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>
            Anyone with the link will be able to view and edit this project.
          </p>
        </div>
        <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
          <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
          <ui-alert-dialog-action>Share</ui-alert-dialog-action>
        </div>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `;
}
