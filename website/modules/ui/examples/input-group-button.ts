import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { IconCopy, IconInfoCircle, IconStar } from '#lib/ui/tabler.ts';

// shadcn's demo copies the url and toggles the star with React state. Here
// the buttons are shown at rest; wire a click listener to give them work.
export default function InputGroupButtonExample() {
  const isFavorite = false;

  return html`
    <div class="grid w-full max-w-sm gap-6">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" placeholder="https://x.com/shadcn" readonly aria-label="Profile link" class=${inputGroupInputClass()}>
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button type="button" aria-label="Copy" title="Copy" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${inputGroupButtonClass({ size: 'icon-xs' })}>
            ${IconCopy()}
          </button>
        </div>
      </div>
      <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), '[--radius:9999px]')}>
        <div role="group" data-slot="input-group-addon" data-align="inline-start" class=${inputGroupAddonClass()}>
          <button type="button" popovertarget="input-group-button-info" aria-haspopup="dialog" aria-expanded="false" aria-label="Connection info" data-slot="button" data-variant="secondary" data-size="icon-xs" class=${inputGroupButtonClass({ variant: 'secondary', size: 'icon-xs' })}>
            ${IconInfoCircle()}
          </button>
        </div>
        <div id="input-group-button-info" popover role="dialog" aria-labelledby="input-group-button-info-title" data-slot="popover-content" data-side="bottom" data-align="start" class=${cn(popoverContentClass({ align: 'start' }), 'rounded-xl text-sm')}>
          <div class="flex flex-col gap-1">
            <p id="input-group-button-info-title" class="font-medium">Your connection is not secure.</p>
            <p>You should not enter any sensitive information on this site.</p>
          </div>
        </div>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-secure-19" class=${cn(inputGroupAddonClass(), 'pl-1.5 text-muted-foreground')}>
          https://
        </label>
        <input data-slot="input-group-control" id="input-secure-19" aria-label="Website" class=${inputGroupInputClass()}>
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button type="button" aria-label="Favorite" aria-pressed="false" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${inputGroupButtonClass({ size: 'icon-xs' })}>
            ${IconStar(isFavorite ? 'fill-blue-600 stroke-blue-600' : '')}
          </button>
        </div>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" placeholder="Type to search..." aria-label="Search" class=${inputGroupInputClass()}>
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button type="button" data-slot="button" data-variant="secondary" data-size="xs" class=${inputGroupButtonClass({ variant: 'secondary' })}>Search</button>
        </div>
      </div>
    </div>
  `;
}
