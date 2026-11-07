import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  emptyClass, emptyHeaderClass, emptyTitleClass, emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { kbdClass } from '#modules/ui/components/kbd.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

export default function EmptyInputGroup() {
  return html`
    <div data-slot="empty" class=${emptyClass()}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-title" class=${emptyTitleClass()}>404 - Not Found</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          The page you&apos;re looking for doesn&apos;t exist. Try searching for
          what you need below.
        </div>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'sm:w-3/4')}>
          <input data-slot="input-group-control" id="empty-input-group-search" placeholder="Try searching for pages..." aria-label="Search pages" class=${inputGroupInputClass()}>
          <label data-slot="input-group-addon" data-align="inline-start" for="empty-input-group-search" class=${inputGroupAddonClass()}>
            ${SearchIcon()}
          </label>
          <label data-slot="input-group-addon" data-align="inline-end" for="empty-input-group-search" class=${inputGroupAddonClass({ align: 'inline-end' })}>
            <kbd data-slot="kbd" class=${kbdClass()}>/</kbd>
          </label>
        </div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          Need help? <a href="#">Contact support</a>
        </div>
      </div>
    </div>
  `;
}
