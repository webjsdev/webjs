import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

export default function InputGroupDemo() {
  return html`
    <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'max-w-xs')}>
      <input data-slot="input-group-control" id="input-group-demo" type="text" placeholder="Search..." aria-label="Search" class=${inputGroupInputClass()}>
      <label data-slot="input-group-addon" data-align="inline-start" for="input-group-demo" class=${inputGroupAddonClass()}>
        ${SearchIcon()}
      </label>
      <label data-slot="input-group-addon" data-align="inline-end" for="input-group-demo" class=${inputGroupAddonClass({ align: 'inline-end' })}>12 results</label>
    </div>
  `;
}
