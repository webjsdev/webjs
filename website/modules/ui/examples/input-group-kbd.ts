import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { kbdClass } from '#modules/ui/components/kbd.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

export default function InputGroupKbd() {
  return html`
    <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'max-w-sm')}>
      <input data-slot="input-group-control" id="input-group-kbd" placeholder="Search..." aria-label="Search" class=${inputGroupInputClass()}>
      <label data-slot="input-group-addon" data-align="inline-start" for="input-group-kbd" class=${inputGroupAddonClass()}>
        ${SearchIcon('text-muted-foreground')}
      </label>
      <label data-slot="input-group-addon" data-align="inline-end" for="input-group-kbd" class=${inputGroupAddonClass({ align: 'inline-end' })}>
        <kbd data-slot="kbd" class=${kbdClass()}><span aria-hidden="true">⌘K</span><span class="sr-only">Command K</span></kbd>
      </label>
    </div>
  `;
}
