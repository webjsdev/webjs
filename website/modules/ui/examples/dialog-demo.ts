import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass,
} from '#modules/ui/components/dialog.ts';
import { fieldGroupClass, fieldClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

export default function DialogDemo() {
  return html`
    <ui-dialog>
      <form>
        <ui-dialog-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open Dialog</button>
        </ui-dialog-trigger>
        <ui-dialog-content class="sm:max-w-sm">
          <div data-slot="dialog-header" class=${dialogHeaderClass()}>
            <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Edit profile</h2>
            <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
              Make changes to your profile here. Click save when you&apos;re
              done.
            </p>
          </div>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="label" for="name-1" class=${labelClass()}>Name</label>
              <input data-slot="input" id="name-1" name="name" value="Pedro Duarte" class=${inputClass()}>
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="label" for="username-1" class=${labelClass()}>Username</label>
              <input data-slot="input" id="username-1" name="username" value="@peduarte" class=${inputClass()}>
            </div>
          </div>
          <div data-slot="dialog-footer" class=${dialogFooterClass()}>
            <ui-dialog-close>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
            </ui-dialog-close>
            <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Save changes</button>
          </div>
        </ui-dialog-content>
      </form>
    </ui-dialog>
  `;
}
