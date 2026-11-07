import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldSetClass, fieldLegendClass, fieldDescriptionClass, fieldGroupClass, fieldClass, fieldLabelClass,
} from '#modules/ui/components/field.ts';

const items = [
  { id: 'finder-pref-9k2-hard-disks-ljj-checkbox', label: 'Hard disks', checked: true },
  { id: 'finder-pref-9k2-external-disks-1yg-checkbox', label: 'External disks', checked: true },
  { id: 'finder-pref-9k2-cds-dvds-fzt-checkbox', label: 'CDs, DVDs, and iPods', checked: false },
  { id: 'finder-pref-9k2-connected-servers-6l2-checkbox', label: 'Connected servers', checked: false },
];

export default function CheckboxGroup() {
  return html`
    <fieldset data-slot="field-set" class=${fieldSetClass()}>
      <legend data-slot="field-legend" data-variant="label" class=${fieldLegendClass({ variant: 'label' })}>
        Show these items on the desktop:
      </legend>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Select the items you want to show on the desktop.
      </p>
      <div data-slot="field-group" class=${cn(fieldGroupClass(), 'gap-3')}>
        ${items.map((item) => html`
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <input type="checkbox" data-slot="checkbox" id=${item.id} name=${item.id} ?checked=${item.checked} class=${checkboxClass()}>
            <label data-slot="field-label" for=${item.id} class=${cn(fieldLabelClass(), 'font-normal')}>${item.label}</label>
          </div>
        `)}
      </div>
    </fieldset>
  `;
}
