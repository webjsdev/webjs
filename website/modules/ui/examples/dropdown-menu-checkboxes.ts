import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

// Each checkbox item keeps its own checked state and flips it on select,
// so the demo writes the initial state and nothing else.
export default function DropdownMenuCheckboxes() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="w-40">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-label>Appearance</ui-dropdown-menu-label>
          <ui-dropdown-menu-item type="checkbox" value="status-bar" checked>
            Status Bar
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="checkbox" value="activity-bar" data-disabled>
            Activity Bar
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item type="checkbox" value="panel">
            Panel
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
