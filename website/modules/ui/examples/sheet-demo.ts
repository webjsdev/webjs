import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';
import {
  sheetHeaderClass, sheetFooterClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';

export default function SheetDemo() {
  return html`
    <ui-sheet>
      <ui-sheet-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-sheet-trigger>
      <ui-sheet-content side="right">
        <div data-slot="sheet-header" class=${sheetHeaderClass()}>
          <h2 data-slot="sheet-title" class=${sheetTitleClass()}>Edit profile</h2>
          <p data-slot="sheet-description" class=${sheetDescriptionClass()}>
            Make changes to your profile here. Click save when you&apos;re done.
          </p>
        </div>
        <div class="grid flex-1 auto-rows-min gap-6 px-4">
          <div class="grid gap-3">
            <label data-slot="label" for="sheet-demo-name" class=${labelClass()}>Name</label>
            <input data-slot="input" id="sheet-demo-name" value="Pedro Duarte" class=${inputClass()}>
          </div>
          <div class="grid gap-3">
            <label data-slot="label" for="sheet-demo-username" class=${labelClass()}>Username</label>
            <input data-slot="input" id="sheet-demo-username" value="@peduarte" class=${inputClass()}>
          </div>
        </div>
        <div data-slot="sheet-footer" class=${sheetFooterClass()}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Save changes</button>
          <ui-sheet-close>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Close</button>
          </ui-sheet-close>
        </div>
      </ui-sheet-content>
    </ui-sheet>
  `;
}
