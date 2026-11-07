import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass,
} from '#modules/ui/components/input-group.ts';

// shadcn's demo reaches for react-textarea-autosize. A plain textarea with
// field-sizing-content grows with its text in the browser, no library needed.
// Its own classes stand in for the group's, and data-slot="input-group-control"
// is what gives it the group's focus ring.
export default function InputGroupCustom() {
  return html`
    <div class="grid w-full max-w-sm gap-6">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <textarea data-slot="input-group-control" placeholder="Autoresize textarea..." aria-label="Message" class="flex field-sizing-content min-h-16 w-full resize-none rounded-md bg-transparent px-3 py-2.5 text-base transition-[color,box-shadow] outline-none md:text-sm"></textarea>
        <div role="group" data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
          <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'sm' }), 'ml-auto')}>
            Submit
          </button>
        </div>
      </div>
    </div>
  `;
}
