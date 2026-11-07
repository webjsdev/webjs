import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputFieldgroup() {
  return html`
    <div data-slot="field-group" class=${fieldGroupClass()}>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="fieldgroup-name" class=${fieldLabelClass()}>Name</label>
        <input data-slot="input" id="fieldgroup-name" placeholder="Jordan Lee" class=${inputClass()}>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="fieldgroup-email" class=${fieldLabelClass()}>Email</label>
        <input data-slot="input" id="fieldgroup-email" type="email" placeholder="name@example.com" class=${inputClass()}>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          We&apos;ll send updates to this address.
        </p>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <button type="reset" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
          Reset
        </button>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit</button>
      </div>
    </div>
  `;
}
