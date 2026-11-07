import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  sheetHeaderClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';

export default function SheetNoCloseButton() {
  return html`
    <ui-sheet>
      <ui-sheet-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open Sheet</button>
      </ui-sheet-trigger>
      <ui-sheet-content show-close-button="false">
        <div data-slot="sheet-header" class=${sheetHeaderClass()}>
          <h2 data-slot="sheet-title" class=${sheetTitleClass()}>No Close Button</h2>
          <p data-slot="sheet-description" class=${sheetDescriptionClass()}>
            This sheet doesn&apos;t have a close button in the top-right corner.
            Click outside to close.
          </p>
        </div>
      </ui-sheet-content>
    </ui-sheet>
  `;
}
