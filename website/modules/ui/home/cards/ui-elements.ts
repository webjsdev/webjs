import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { inputGroupClass, inputGroupAddonClass, inputGroupInputClass, inputGroupTextClass } from '#modules/ui/components/input-group.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { switchInputClass, switchTrackClass } from '#modules/ui/components/switch.ts';
import { alertDialogHeaderClass, alertDialogTitleClass, alertDialogDescriptionClass, alertDialogFooterClass } from '#modules/ui/components/alert-dialog.ts';
import { ArrowRight02Icon, ArrowUp01Icon, Search01Icon } from '#lib/ui/hugeicons.ts';
import { Card, CardContent, Button, Badge, FieldGroup, Field, Textarea } from '../parts.ts';

/** shadcn's UIElements card (apps/v4/app/(app)/(root)/cards/ui-elements.tsx). */
export function uiElements() {
  const toggle = (label: string, cls: string) => html`
    <label class=${cn('inline-flex items-center', cls)}>
      <input type="checkbox" role="switch" checked aria-label=${label} class=${switchInputClass()}>
      <span class=${switchTrackClass()}></span>
    </label>`;
  return Card('w-full', CardContent('flex flex-col gap-6', html`
    <div class="flex gap-2">
      ${Button({}, html`Button ${ArrowRight02Icon('', 2)}`)}
      ${Button({ variant: 'secondary' }, 'Secondary')}
      ${Button({ variant: 'outline' }, 'Outline')}
    </div>
    ${FieldGroup(html`
      ${Field('', html`
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <input data-slot="input-group-control" placeholder="Name" aria-label="Name" class=${inputGroupInputClass()}>
          <div data-slot="input-group-addon" data-align="inline-end" role="group" class=${inputGroupAddonClass({ align: 'inline-end' })}>
            <span class=${inputGroupTextClass()}>${Search01Icon('', 2)}</span>
          </div>
        </div>`)}
      ${Field('flex-1', Textarea({ placeholder: 'Message', cls: 'resize-none' }))}
    `)}
    <div class="flex items-center gap-2">
      <div class="flex gap-2">
        ${Badge('default', '', 'Badge')}
        ${Badge('secondary', '', 'Secondary')}
        ${Badge('outline', 'hidden 4xl:flex', 'Outline')}
      </div>
      <div role="radiogroup" aria-label="Fruit preference" class=${cn(radioGroupClass(), 'ml-auto flex w-fit gap-3')}>
        <input type="radio" name="home-fruit" value="apple" checked aria-label="Apple" data-slot="radio" class=${radioClass()}>
        <input type="radio" name="home-fruit" value="banana" aria-label="Banana" data-slot="radio" class=${radioClass()}>
      </div>
      <div class="flex gap-3">
        <input type="checkbox" checked aria-label="Enable email alerts" data-slot="checkbox" class=${checkboxClass()}>
        <input type="checkbox" aria-label="Enable push alerts" data-slot="checkbox" class=${cn(checkboxClass(), 'hidden 4xl:flex')}>
      </div>
      ${toggle('Enable compact notifications', 'flex 4xl:hidden')}
    </div>
    <div class="flex items-center gap-4">
      <ui-alert-dialog>
        <ui-alert-dialog-trigger>
          <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline' })}>
            <span class="hidden md:flex">Alert Dialog</span>
            <span class="flex md:hidden">Dialog</span>
          </button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content size="sm" class="theme-neutral">
          <div class=${alertDialogHeaderClass()}>
            <h2 class=${alertDialogTitleClass()}>Allow accessory to connect?</h2>
            <p class=${alertDialogDescriptionClass()}>Do you want to allow the USB accessory to connect to this device and your data?</p>
          </div>
          <div class=${alertDialogFooterClass()}>
            <ui-alert-dialog-cancel>Don't allow</ui-alert-dialog-cancel>
            <ui-alert-dialog-action>Allow</ui-alert-dialog-action>
          </div>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'ml-auto')}>
        <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline' })}>Button Group</button>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="button" aria-label="Open quick actions" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${ArrowUp01Icon('', 2)}</button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content align="end" side="top" class="w-40">
            <ui-dropdown-menu-label>Quick Actions</ui-dropdown-menu-label>
            <ui-dropdown-menu-item>Mute Conversation</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Mark as Read</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Block User</ui-dropdown-menu-item>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item variant="destructive">Delete Conversation</ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </div>
      ${toggle('Enable advanced setting', 'hidden 4xl:flex')}
    </div>
  `));
}
