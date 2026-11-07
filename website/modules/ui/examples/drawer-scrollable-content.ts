import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  drawerHeaderClass, drawerTitleClass, drawerDescriptionClass, drawerFooterClass,
} from '#modules/ui/components/drawer.ts';

export default function DrawerScrollableContent() {
  return html`
    <ui-drawer>
      <ui-drawer-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Scrollable Content</button>
      </ui-drawer-trigger>
      <ui-drawer-content direction="right">
        <div data-slot="drawer-header" class=${drawerHeaderClass()}>
          <h2 data-slot="drawer-title" class=${drawerTitleClass()}>Move Goal</h2>
          <p data-slot="drawer-description" class=${drawerDescriptionClass()}>Set your daily activity goal.</p>
        </div>
        <div class="no-scrollbar overflow-y-auto px-4">
          ${Array.from({ length: 10 }).map(() => html`
            <p class="mb-4 leading-normal style-lyra:mb-2 style-lyra:leading-relaxed">
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
        <div data-slot="drawer-footer" class=${drawerFooterClass()}>
          <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit</button>
          <ui-drawer-close>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
          </ui-drawer-close>
        </div>
      </ui-drawer-content>
    </ui-drawer>
  `;
}
