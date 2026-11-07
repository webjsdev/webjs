import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
  inputGroupTextClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';

export default function InputGroupBlockEnd() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'max-w-sm')}>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="block-end-input" class=${fieldLabelClass()}>Input</label>
        <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'h-auto')}>
          <input data-slot="input-group-control" id="block-end-input" placeholder="Enter amount" class=${inputGroupInputClass()}>
          <label data-slot="input-group-addon" data-align="block-end" for="block-end-input" class=${inputGroupAddonClass({ align: 'block-end' })}>
            <span class=${inputGroupTextClass()}>USD</span>
          </label>
        </div>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>Footer positioned below the input.</p>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="block-end-textarea" class=${fieldLabelClass()}>Textarea</label>
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <textarea data-slot="input-group-control" id="block-end-textarea" placeholder="Write a comment..." class=${inputGroupTextareaClass()}></textarea>
          <div role="group" data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
            <span class=${inputGroupTextClass()}>0/280</span>
            <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'sm' }), 'ml-auto')}>
              Post
            </button>
          </div>
        </div>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Footer positioned below the textarea.
        </p>
      </div>
    </div>
  `;
}
