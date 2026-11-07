import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass,
} from '#modules/ui/components/dialog.ts';

export default function DialogStickyFooter() {
  return html`
    <ui-dialog>
      <ui-dialog-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Sticky Footer</button>
      </ui-dialog-trigger>
      <ui-dialog-content>
        <div data-slot="dialog-header" class=${dialogHeaderClass()}>
          <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Sticky Footer</h2>
          <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
            This dialog has a sticky footer that stays visible while the content
            scrolls.
          </p>
        </div>
        <div class="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4">
          ${Array.from({ length: 10 }).map(() => html`
            <p class="mb-4 leading-normal">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          `)}
        </div>
        <div data-slot="dialog-footer" class=${dialogFooterClass()}>
          <ui-dialog-close>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Close</button>
          </ui-dialog-close>
        </div>
      </ui-dialog-content>
    </ui-dialog>
  `;
}
