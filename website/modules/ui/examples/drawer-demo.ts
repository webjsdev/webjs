import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  drawerHeaderClass, drawerTitleClass, drawerDescriptionClass, drawerFooterClass,
} from '#modules/ui/components/drawer.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

const deliveryTimes = [
  { value: 'asap', id: 'delivery-asap', label: 'Standard delivery', description: '25–35 min · Driver assigned now', badge: 'Fastest' },
  { value: '5-00', id: 'delivery-5-00', label: '5:00 PM – 5:15 PM', description: 'Prep starts at 4:45 PM' },
  { value: '5-30', id: 'delivery-5-30', label: '5:30 PM – 5:45 PM', description: "Good if you're heading home" },
  { value: '6-00', id: 'delivery-6-00', label: '6:00 PM – 6:15 PM', description: 'Most popular · High demand' },
  { value: '6-30', id: 'delivery-6-30', label: '6:30 PM – 6:45 PM', description: 'Last slot before kitchen closes' },
];

// shadcn slides it in from the right on a desktop and up from the bottom
// on a phone; the kit reads one direction, so this uses the desktop one.
// Each slot is a card whose whole <label> picks its radio. Confirming the
// slot (shadcn closes the drawer and shows a toast) is the reader's to wire.
export default function DrawerDemo() {
  const deliveryTime = 'asap';

  return html`
    <ui-drawer>
      <ui-drawer-trigger>
        <button type="button" data-slot="button" data-variant="secondary" data-size="default" class=${buttonClass({ variant: 'secondary' })}>Open Drawer</button>
      </ui-drawer-trigger>
      <ui-drawer-content direction="right">
        <div data-slot="drawer-header" class=${drawerHeaderClass()}>
          <h2 data-slot="drawer-title" class=${drawerTitleClass()}>Pick a delivery time</h2>
          <p data-slot="drawer-description" class=${drawerDescriptionClass()}>We'll prepare your order as soon as possible.</p>
        </div>
        <div class="flex-1 scroll-fade overflow-y-auto p-4">
          <div role="radiogroup" aria-label="Delivery time" data-slot="radio-group" class=${cn(radioGroupClass(), 'gap-2')}>
            ${deliveryTimes.map((time) => html`
              <label data-slot="field-label" for=${time.id} class=${fieldLabelClass()}>
                <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                  <div data-slot="field-content" class=${fieldContentClass()}>
                    <div data-slot="field-label" class=${cn(fieldTitleClass(), 'flex items-center gap-2')}>
                      ${time.label}
                      ${time.badge ? html`<span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>${time.badge}</span>` : ''}
                    </div>
                    <p data-slot="field-description" class=${fieldDescriptionClass()}>${time.description}</p>
                  </div>
                  <input type="radio" data-slot="radio" name="delivery-time" value=${time.value} id=${time.id} ?checked=${time.value === deliveryTime} class=${radioClass()}>
                </div>
              </label>
            `)}
          </div>
        </div>
        <div data-slot="drawer-footer" class=${drawerFooterClass()}>
          <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'h-[34px]')}>Confirm Delivery Time</button>
          <ui-drawer-close>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
          </ui-drawer-close>
        </div>
      </ui-drawer-content>
    </ui-drawer>
  `;
}
