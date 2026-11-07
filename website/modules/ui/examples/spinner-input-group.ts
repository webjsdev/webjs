import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass,
  inputGroupInputClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import { ArrowUpIcon } from '#lib/ui/lucide.ts';

export default function SpinnerInputGroup() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-4">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" placeholder="Send a message..." aria-label="Message" disabled class=${inputGroupInputClass()}>
        <div data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${spinner()}
        </div>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <textarea data-slot="input-group-control" placeholder="Send a message..." aria-label="Message" disabled class=${inputGroupTextareaClass()}></textarea>
        <div data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
          ${spinner({ decorative: true })} Validating...
          <button type="button" data-slot="button" data-variant="default" data-size="xs" class=${cn(inputGroupButtonClass({ variant: 'default' }), 'ml-auto')}>
            ${ArrowUpIcon()}
            <span class="sr-only">Send</span>
          </button>
        </div>
      </div>
    </div>
  `;
}
