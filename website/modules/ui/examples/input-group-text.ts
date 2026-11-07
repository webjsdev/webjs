import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
  inputGroupTextClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';

export default function InputGroupTextExample() {
  return html`
    <div class="grid w-full max-w-sm gap-6">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-text-price" class=${inputGroupAddonClass()}>
          <span class=${inputGroupTextClass()}>$</span>
        </label>
        <input data-slot="input-group-control" id="input-group-text-price" placeholder="0.00" aria-label="Price" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-text-price" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <span class=${inputGroupTextClass()}>USD</span>
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-text-url" class=${inputGroupAddonClass()}>
          <span class=${inputGroupTextClass()}>https://</span>
        </label>
        <input data-slot="input-group-control" id="input-group-text-url" placeholder="example.com" aria-label="Website" class=${cn(inputGroupInputClass(), 'pl-0.5!')}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-text-url" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <span class=${inputGroupTextClass()}>.com</span>
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-text-username" placeholder="Enter your username" aria-label="Username" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-text-username" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <span class=${inputGroupTextClass()}>@company.com</span>
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <textarea data-slot="input-group-control" id="input-group-text-message" placeholder="Enter your message" aria-label="Message" class=${inputGroupTextareaClass()}></textarea>
        <label data-slot="input-group-addon" data-align="block-end" for="input-group-text-message" class=${inputGroupAddonClass({ align: 'block-end' })}>
          <span class=${cn(inputGroupTextClass(), 'text-xs text-muted-foreground')}>
            120 characters left
          </span>
        </label>
      </div>
    </div>
  `;
}
