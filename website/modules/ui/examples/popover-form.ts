import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import {
  popoverContentClass, popoverHeaderClass, popoverTitleClass, popoverDescriptionClass,
} from '#modules/ui/components/popover.ts';

const field = (id: string, label: string, value: string) => html`
  <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
    <label data-slot="field-label" for=${id} class=${cn(fieldLabelClass(), 'w-1/2')}>${label}</label>
    <input data-slot="input" id=${id} value=${value} class=${inputClass()}>
  </div>
`;

export default function PopoverForm() {
  return html`
    <button type="button" popovertarget="popover-form" aria-haspopup="dialog" aria-expanded="false" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Open Popover</button>
    <div id="popover-form" popover role="dialog" aria-labelledby="popover-form-title" aria-describedby="popover-form-description" data-slot="popover-content" data-side="bottom" data-align="start" class=${cn(popoverContentClass({ align: 'start' }), 'w-64')}>
      <div data-slot="popover-header" class=${popoverHeaderClass()}>
        <h3 id="popover-form-title" data-slot="popover-title" class=${popoverTitleClass()}>Dimensions</h3>
        <p id="popover-form-description" data-slot="popover-description" class=${popoverDescriptionClass()}>
          Set the dimensions for the layer.
        </p>
      </div>
      <div data-slot="field-group" class=${cn(fieldGroupClass(), 'gap-4')}>
        ${field('popover-form-width', 'Width', '100%')}
        ${field('popover-form-height', 'Height', '25px')}
      </div>
    </div>
  `;
}
