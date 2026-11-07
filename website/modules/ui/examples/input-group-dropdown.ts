import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { ChevronDownIcon, MoreHorizontal } from '#lib/ui/lucide.ts';

// Each trigger stays a direct child of its addon (the addon's spacing rules
// select a direct button child), so the menu names it with trigger="<id>".
export default function InputGroupDropdown() {
  return html`
    <div class="grid w-full max-w-sm gap-4">
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" placeholder="Enter file name" aria-label="File name" class=${inputGroupInputClass()}>
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button type="button" id="input-group-dropdown-more" aria-label="More" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${inputGroupButtonClass({ variant: 'ghost', size: 'icon-xs' })}>
            ${MoreHorizontal()}
          </button>
        </div>
      </div>
      <ui-dropdown-menu trigger="input-group-dropdown-more" class="absolute">
        <ui-dropdown-menu-content align="end">
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Copy path</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Open location</ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
      <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), '[--radius:1rem]')}>
        <input data-slot="input-group-control" placeholder="Enter search query" aria-label="Search query" class=${inputGroupInputClass()}>
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button type="button" id="input-group-dropdown-scope" data-slot="button" data-variant="ghost" data-size="xs" class=${cn(inputGroupButtonClass({ variant: 'ghost' }), 'pr-1.5! text-xs')}>
            Search In... ${ChevronDownIcon('size-3')}
          </button>
        </div>
      </div>
      <ui-dropdown-menu trigger="input-group-dropdown-scope" class="absolute">
        <ui-dropdown-menu-content align="end" class="[--radius:0.95rem]">
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-item>Documentation</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Blog Posts</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Changelog</ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    </div>
  `;
}
