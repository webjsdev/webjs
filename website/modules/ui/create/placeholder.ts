import { html } from '@webjsdev/core';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '#modules/ui/components/card.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';
import {
  itemActionsClass,
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemGroupClass,
  itemMediaClass,
  itemTitleClass,
} from '#modules/ui/components/item.ts';
import { BellIcon, ChartBarIcon, ChevronRightIcon, PlusIcon, SettingsIcon, UserIcon } from '#lib/utils/icons.ts';

/**
 * What /ui/preview/<name> shows while a preview block is not in the registry
 * yet (#1666): a small board of the kit's own components, in base form, so
 * every choice the configurator makes is visible on it. The style decides
 * their shape, the theme their colors, the chart color the bars, the radius
 * the corners, the fonts the text. The real preview blocks replace it as
 * soon as they land, with no change here.
 */
export function previewPlaceholder(name: string) {
  return html`<div data-placeholder=${name} class="mx-auto grid w-full max-w-5xl gap-6 p-6 md:grid-cols-2 md:p-10">
    <div class=${cardClass()}>
      <div class=${cardHeaderClass()}>
        <h2 class=${`${cardTitleClass()} cn-font-heading`}>Create an account</h2>
        <p class=${cardDescriptionClass()}>Enter your email below to create your account.</p>
      </div>
      <div class=${`${cardContentClass()} grid gap-4`}>
        <div class="grid gap-2">
          <label class=${labelClass()} for="preview-email">Email</label>
          <input class=${inputClass()} id="preview-email" type="email" placeholder="m@example.com">
        </div>
        <div class="flex flex-wrap gap-2">
          <span class=${badgeClass()}>Badge</span>
          <span class=${badgeClass({ variant: 'secondary' })}>Secondary</span>
          <span class=${badgeClass({ variant: 'outline' })}>Outline</span>
        </div>
      </div>
      <div class=${`${cardFooterClass()} flex gap-2`}>
        <button type="button" class=${buttonClass()}>${PlusIcon()} Create account</button>
        <button type="button" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
      </div>
    </div>
    <div class="grid gap-6">
      <div class=${cardClass()}>
        <div class=${cardHeaderClass()}>
          <h2 class=${`${cardTitleClass()} cn-font-heading`}>Revenue</h2>
          <p class=${cardDescriptionClass()}>January to June</p>
        </div>
        <div class=${`${cardContentClass()} flex h-32 items-end gap-3`} aria-hidden="true">
          ${[1, 2, 3, 4, 5].map((n, i) => html`<div class="flex-1 rounded-t-md" style=${`height: ${[55, 80, 65, 95, 70][i]}%; background: var(--chart-${n})`}></div>`)}
        </div>
      </div>
      <div class=${itemGroupClass()}>
        ${[
          { icon: UserIcon, title: 'Profile', description: 'Your name and photo' },
          { icon: BellIcon, title: 'Notifications', description: 'What you hear about' },
          { icon: SettingsIcon, title: 'Settings', description: 'Everything else' },
        ].map((row) => html`<a href="#" class=${itemClass({ variant: 'outline', size: 'sm' })}>
          <div class=${itemMediaClass({ variant: 'icon' })}>${row.icon()}</div>
          <div class=${itemContentClass()}>
            <div class=${itemTitleClass()}>${row.title}</div>
            <p class=${itemDescriptionClass()}>${row.description}</p>
          </div>
          <div class=${itemActionsClass()}>${ChevronRightIcon('size-4')}</div>
        </a>`)}
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class=${buttonClass({ variant: 'secondary' })}>${ChartBarIcon()} Reports</button>
        <button type="button" class=${buttonClass({ variant: 'ghost' })}>Ghost</button>
        <button type="button" class=${buttonClass({ variant: 'destructive' })}>Delete</button>
      </div>
    </div>
  </div>`;
}
