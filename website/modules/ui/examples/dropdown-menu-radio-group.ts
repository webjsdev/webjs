import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

// The radio set is the nearest <ui-dropdown-menu-group>, which keeps one
// item checked and names the set with its aria-label.
export default function DropdownMenuRadioGroup() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="w-32">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>Panel Position</ui-dropdown-menu-label>
          <ui-dropdown-menu-group aria-label="Panel Position">
            <ui-dropdown-menu-item type="radio" value="top">Top</ui-dropdown-menu-item>
            <ui-dropdown-menu-item type="radio" value="bottom" checked>Bottom</ui-dropdown-menu-item>
            <ui-dropdown-menu-item type="radio" value="right">Right</ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
