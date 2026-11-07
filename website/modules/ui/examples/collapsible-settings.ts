import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass,
} from '#modules/ui/components/card.ts';
import {
  collapsibleClass, collapsibleTriggerClass, collapsibleContentClass,
} from '#modules/ui/components/collapsible.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { MaximizeIcon, MinimizeIcon } from '#lib/ui/lucide.ts';

const radiusField = (id: string, label: string) => html`
  <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
    <label data-slot="field-label" for=${id} class=${cn(fieldLabelClass(), 'sr-only')}>${label}</label>
    <input data-slot="input" id=${id} placeholder="0" value="0" class=${inputClass()}>
  </div>
`;

// A closed <details> shows only its <summary>, so the first row of fields sits
// outside it and the trigger is placed beside that row. The second row carries
// its own top padding, so the closed collapsible adds no row gap. The icon
// follows the native open state through group-open, with no script.
export default function CollapsibleSettings() {
  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-full max-w-xs')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radius</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Set the corner radius of the element.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="relative pe-10">
          <div data-slot="field-group" class=${cn(fieldGroupClass(), 'grid w-full grid-cols-2 gap-x-2 gap-y-0')}>
            ${radiusField('radius-x', 'Radius X')}
            ${radiusField('radius-y', 'Radius Y')}
            <details data-slot="collapsible" class=${cn(collapsibleClass(), 'col-span-full')}>
              <summary data-slot="collapsible-trigger" data-variant="outline" data-size="icon" aria-label="Toggle more radius fields" class=${cn(collapsibleTriggerClass(), buttonClass({ variant: 'outline', size: 'icon' }), 'absolute end-0 top-0 w-auto aspect-square')}>
                ${MaximizeIcon('group-open:hidden')}
                ${MinimizeIcon('hidden group-open:block')}
              </summary>
              <div data-slot="collapsible-content" class=${cn(collapsibleContentClass(), 'grid grid-cols-2 gap-2 pt-2')}>
                ${radiusField('radius-bottom-x', 'Radius X')}
                ${radiusField('radius-bottom-y', 'Radius Y')}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  `;
}
