import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldContentClass,
  fieldLabelClass, fieldDescriptionClass, fieldSeparatorClass,
} from '#modules/ui/components/field.ts';

const items = [
  { id: 'finder-pref-9k2-hard-disks-ljj', label: 'Hard disks' },
  { id: 'finder-pref-9k2-external-disks-1yg', label: 'External disks' },
  { id: 'finder-pref-9k2-cds-dvds-fzt', label: 'CDs, DVDs, and iPods' },
  { id: 'finder-pref-9k2-connected-servers-6l2', label: 'Connected servers' },
];

export default function FieldCheckbox() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'w-full max-w-xs')}>
      <fieldset data-slot="field-set" class=${fieldSetClass()}>
        <legend data-slot="field-legend" data-variant="label" class=${fieldLegendClass({ variant: 'label' })}>
          Show these items on the desktop
        </legend>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Select the items you want to show on the desktop.
        </p>
        <div data-slot="field-group" class=${cn(fieldGroupClass(), 'gap-3')}>
          ${items.map((item) => html`
            <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
              <input type="checkbox" data-slot="checkbox" id=${item.id} class=${checkboxClass()}>
              <label data-slot="field-label" for=${item.id} class=${cn(fieldLabelClass(), 'font-normal')}>
                ${item.label}
              </label>
            </div>
          `)}
        </div>
      </fieldset>
      <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="finder-pref-9k2-sync-folders-nep" checked class=${checkboxClass()}>
        <div data-slot="field-content" class=${fieldContentClass()}>
          <label data-slot="field-label" for="finder-pref-9k2-sync-folders-nep" class=${fieldLabelClass()}>
            Sync Desktop &amp; Documents folders
          </label>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            Your Desktop &amp; Documents folders are being synced with iCloud Drive.
            You can access them from other devices.
          </p>
        </div>
      </div>
    </div>
  `;
}
