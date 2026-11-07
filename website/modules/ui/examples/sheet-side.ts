import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  sheetHeaderClass, sheetFooterClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';

const SHEET_SIDES = ['top', 'right', 'bottom', 'left'] as const;

export default function SheetSide() {
  return html`
    <div class="flex flex-wrap gap-2">
      ${SHEET_SIDES.map((side) => html`
        <ui-sheet>
          <ui-sheet-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'capitalize')}>
              ${side}
            </button>
          </ui-sheet-trigger>
          <ui-sheet-content side=${side} class="data-[side=bottom]:max-h-[50vh] data-[side=top]:max-h-[50vh]">
            <div data-slot="sheet-header" class=${sheetHeaderClass()}>
              <h2 data-slot="sheet-title" class=${sheetTitleClass()}>Edit profile</h2>
              <p data-slot="sheet-description" class=${sheetDescriptionClass()}>
                Make changes to your profile here. Click save when you&apos;re
                done.
              </p>
            </div>
            <div class="no-scrollbar overflow-y-auto px-4">
              ${Array.from({ length: 10 }).map(() => html`
                <p class="mb-2 leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco
                  laboris nisi ut aliquip ex ea commodo consequat. Duis aute
                  irure dolor in reprehenderit in voluptate velit esse cillum
                  dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                  cupidatat non proident, sunt in culpa qui officia deserunt
                  mollit anim id est laborum.
                </p>
              `)}
            </div>
            <div data-slot="sheet-footer" class=${sheetFooterClass()}>
              <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Save changes</button>
              <ui-sheet-close>
                <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
              </ui-sheet-close>
            </div>
          </ui-sheet-content>
        </ui-sheet>
      `)}
    </div>
  `;
}
