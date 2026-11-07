import { html } from '@webjsdev/core';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { kbdClass } from '#modules/ui/components/kbd.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

export default function KbdInputGroup() {
  return html`
    <div class="flex w-full max-w-xs flex-col gap-6">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="kbd-input-group" placeholder="Search..." aria-label="Search" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="kbd-input-group" class=${inputGroupAddonClass()}>
          ${SearchIcon()}
        </label>
        <label data-slot="input-group-addon" data-align="inline-end" for="kbd-input-group" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <kbd data-slot="kbd" class=${kbdClass()}><span aria-hidden="true">⌘</span><span class="sr-only">Command</span></kbd>
          <kbd data-slot="kbd" class=${kbdClass()}>K</kbd>
        </label>
      </div>
    </div>
  `;
}
