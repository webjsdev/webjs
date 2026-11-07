import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass, inputGroupTextClass,
} from '#modules/ui/components/input-group.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import { LoaderIcon } from '#lib/ui/lucide.ts';

export default function InputGroupSpinner() {
  return html`
    <div class="grid w-full max-w-sm gap-4">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-spinner-1" placeholder="Searching..." aria-label="Search" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-spinner-1" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${spinner()}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-spinner-2" placeholder="Processing..." aria-label="Process" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-spinner-2" class=${inputGroupAddonClass()}>
          ${spinner()}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-spinner-3" placeholder="Saving changes..." aria-label="Changes" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-spinner-3" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <span class=${inputGroupTextClass()}>Saving...</span>
          ${spinner({ decorative: true })}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-spinner-4" placeholder="Refreshing data..." aria-label="Data" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-spinner-4" class=${inputGroupAddonClass()}>
          ${LoaderIcon('animate-spin')}
        </label>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-spinner-4" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <span class=${cn(inputGroupTextClass(), 'text-muted-foreground')}>
            Please wait...
          </span>
        </label>
      </div>
    </div>
  `;
}
