import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass, fieldErrorClass } from '#modules/ui/components/field.ts';

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro'];

// The input part renders its own input and does not pass aria-invalid on to
// it yet, so the invalid state is carried by the field around it:
// data-invalid on the field, and the error below the control.
export default function ComboboxInvalid() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" data-invalid="true" class=${cn(fieldClass(), 'w-full max-w-xs')}>
      <label data-slot="field-label" for="combobox-invalid" class=${fieldLabelClass()}>Framework</label>
      <ui-combobox>
        <ui-combobox-input input-id="combobox-invalid" placeholder="Select a framework"></ui-combobox-input>
        <ui-combobox-content>
          <ui-combobox-empty>No items found.</ui-combobox-empty>
          <ui-combobox-list>
            ${frameworks.map((item) => html`<ui-combobox-item value=${item}>${item}</ui-combobox-item>`)}
          </ui-combobox-list>
        </ui-combobox-content>
      </ui-combobox>
      <div role="alert" data-slot="field-error" class=${fieldErrorClass()}>Please select a framework.</div>
    </div>
  `;
}
