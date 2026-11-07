import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
  inputGroupTextClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { CopyIcon, FileCodeIcon } from '#lib/ui/lucide.ts';

export default function InputGroupBlockStart() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'max-w-sm')}>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="block-start-input" class=${fieldLabelClass()}>Input</label>
        <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'h-auto')}>
          <input data-slot="input-group-control" id="block-start-input" placeholder="Enter your name" class=${inputGroupInputClass()}>
          <label data-slot="input-group-addon" data-align="block-start" for="block-start-input" class=${inputGroupAddonClass({ align: 'block-start' })}>
            <span class=${inputGroupTextClass()}>Full Name</span>
          </label>
        </div>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>Header positioned above the input.</p>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="block-start-textarea" class=${fieldLabelClass()}>Textarea</label>
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <textarea data-slot="input-group-control" id="block-start-textarea" placeholder="console.log('Hello, world!');" class=${cn(inputGroupTextareaClass(), 'font-mono text-sm')}></textarea>
          <div role="group" data-slot="input-group-addon" data-align="block-start" class=${inputGroupAddonClass({ align: 'block-start' })}>
            ${FileCodeIcon('text-muted-foreground')}
            <span class=${cn(inputGroupTextClass(), 'font-mono')}>script.js</span>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${cn(inputGroupButtonClass({ size: 'icon-xs' }), 'ml-auto')}>
              ${CopyIcon()}
              <span class="sr-only">Copy</span>
            </button>
          </div>
        </div>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Header positioned above the textarea.
        </p>
      </div>
    </div>
  `;
}
