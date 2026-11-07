/**
 * The preview block's UI elements card: buttons, an item, a slider, an input
 * group and a textarea, badges, radios, checkboxes, an alert dialog, a button
 * group with a menu, and a switch. A fragment helper, rendered by the server,
 * with the kit's elements for the parts that need behaviour. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/ui-elements.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * The menu's trigger stays a direct child of the button group (its corner
 * rules select direct children), so the menu names it by id. The id must be
 * unique on the page.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  alertDialogDescriptionClass,
  alertDialogFooterClass,
  alertDialogHeaderClass,
  alertDialogTitleClass,
} from '../../../components/alert-dialog.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import { buttonGroupClass } from '../../../components/button-group.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import { checkboxClass } from '../../../components/checkbox.ts';
import '../../../components/dropdown-menu.ts';
import { fieldClass, fieldGroupClass } from '../../../components/field.ts';
import {
  inputGroupAddonClass,
  inputGroupClass,
  inputGroupInputClass,
  inputGroupTextClass,
} from '../../../components/input-group.ts';
import {
  itemActionsClass,
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { radioClass, radioGroupClass } from '../../../components/radio-group.ts';
import { sliderClass } from '../../../components/slider.ts';
import '../../../components/switch.ts';
import { textareaClass } from '../../../components/textarea.ts';
import { ChevronUpIcon, SearchIcon } from '../../../lib/icons.ts';

/**
 * `id` names this copy, since shadcn renders the card twice on the board (one
 * copy per breakpoint): it prefixes the menu trigger id and the radio group
 * name, which must not repeat on a page.
 */
export function uiElements(opts: { id?: string } = {}) {
  const id = opts.id ?? 'ui-elements';
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-6')}>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Button</button>
            <button type="button" data-slot="button" data-variant="secondary" data-size="default" class=${buttonClass({ variant: 'secondary' })}>Secondary</button>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Outline</button>
            <button type="button" data-slot="button" data-variant="ghost" data-size="default" class=${buttonClass({ variant: 'ghost' })}>Ghost</button>
          </div>
          <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
            <div data-slot="item-content" class=${itemContentClass()}>
              <div data-slot="item-title" class=${itemTitleClass()}>Two-factor authentication</div>
              <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'text-pretty xl:hidden 2xl:block')}>
                Verify via email or phone number.
              </p>
            </div>
            <div data-slot="item-actions" class=${cn(itemActionsClass(), 'hidden md:flex')}>
              <button type="button" data-slot="button" data-variant="secondary" data-size="sm" class=${buttonClass({ variant: 'secondary', size: 'sm' })}>Enable</button>
            </div>
          </div>
        </div>
        <ui-slider class="flex-1">
          <input type="range" min="0" max="1000" step="10" value="500" aria-label="Slider" class=${sliderClass()}>
        </ui-slider>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <input data-slot="input-group-control" placeholder="Name" aria-label="Name" class=${inputGroupInputClass()}>
              <div data-slot="input-group-addon" data-align="inline-end" role="group" class=${inputGroupAddonClass({ align: 'inline-end' })}>
                <span class=${inputGroupTextClass()}>${SearchIcon()}</span>
              </div>
            </div>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'flex-1')}>
            <textarea data-slot="textarea" placeholder="Message" aria-label="Message" class=${cn(textareaClass(), 'resize-none')}></textarea>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex gap-2">
            <span data-slot="badge" data-variant="default" class=${badgeClass()}>Badge</span>
            <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>Secondary</span>
            <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>Outline</span>
          </div>
          <div role="radiogroup" aria-label="Fruit" data-slot="radio-group" class=${cn(radioGroupClass(), 'ml-auto flex w-fit gap-3')}>
            <input type="radio" name=${`${id}-fruit`} value="apple" checked aria-label="Apple" data-slot="radio" class=${radioClass()}>
            <input type="radio" name=${`${id}-fruit`} value="banana" aria-label="Banana" data-slot="radio" class=${radioClass()}>
          </div>
          <div class="flex gap-3">
            <input type="checkbox" checked aria-label="First option" data-slot="checkbox" class=${checkboxClass()}>
            <input type="checkbox" aria-label="Second option" data-slot="checkbox" class=${checkboxClass()}>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <ui-alert-dialog>
            <ui-alert-dialog-trigger>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
                <span class="hidden md:flex style-sera:md:hidden">Alert Dialog</span>
                <span class="flex md:hidden style-sera:md:flex">Dialog</span>
              </button>
            </ui-alert-dialog-trigger>
            <ui-alert-dialog-content size="sm">
              <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
                <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>Allow accessory to connect?</h2>
                <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>
                  Do you want to allow the USB accessory to connect to this
                  device and your data?
                </p>
              </div>
              <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
                <ui-alert-dialog-cancel>Don't allow</ui-alert-dialog-cancel>
                <ui-alert-dialog-action>Allow</ui-alert-dialog-action>
              </div>
            </ui-alert-dialog-content>
          </ui-alert-dialog>
          <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
              <span class="style-sera:hidden">Button Group</span>
              <span class="hidden style-sera:block">Group</span>
            </button>
            <button type="button" id=${`${id}-quick-actions`} data-slot="button" data-variant="outline" data-size="icon" aria-label="Quick actions" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
              ${ChevronUpIcon()}
            </button>
          </div>
          <ui-dropdown-menu trigger=${`${id}-quick-actions`} class="absolute">
            <ui-dropdown-menu-content align="end" side="top" class="w-fit">
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-label>Quick Actions</ui-dropdown-menu-label>
                <ui-dropdown-menu-item>Mute Conversation</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Mark as Read</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Block User</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
              <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-label>Conversation</ui-dropdown-menu-label>
                <ui-dropdown-menu-item>Share Conversation</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Copy Conversation</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Report Conversation</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
              <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-item variant="destructive">Delete Conversation</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-content>
          </ui-dropdown-menu>
          <ui-switch checked aria-label="Enable" class="ml-auto"></ui-switch>
        </div>
      </div>
    </div>
  `;
}
