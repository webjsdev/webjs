import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  alertDialogHeaderClass, alertDialogFooterClass, alertDialogTitleClass, alertDialogDescriptionClass,
  alertDialogMediaClass,
} from '#modules/ui/components/alert-dialog.ts';
import { Trash2Icon } from '#lib/ui/lucide.ts';

export default function AlertDialogDestructive() {
  return html`
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <button type="button" data-slot="button" data-variant="destructive" data-size="default" class=${buttonClass({ variant: 'destructive' })}>Delete Chat</button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content size="sm">
        <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
          <div data-slot="alert-dialog-media" aria-hidden="true" class=${cn(alertDialogMediaClass(), 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive')}>
            ${Trash2Icon()}
          </div>
          <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>Delete chat?</h2>
          <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>
            This will permanently delete this chat conversation. View
            <a href="#">Settings</a> delete any memories saved during this chat.
          </p>
        </div>
        <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
          <ui-alert-dialog-cancel variant="outline">Cancel</ui-alert-dialog-cancel>
          <ui-alert-dialog-action variant="destructive">Delete</ui-alert-dialog-action>
        </div>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `;
}
