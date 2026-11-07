import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldContentClass, fieldLabelClass,
  fieldTitleClass, fieldDescriptionClass, fieldSeparatorClass, fieldSeparatorContentClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass, inputGroupTextClass,
  inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import {
  itemClass, itemMediaClass, itemContentClass, itemTitleClass, itemDescriptionClass, itemActionsClass,
} from '#modules/ui/components/item.ts';
import { labelClass } from '#modules/ui/components/label.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import { BadgeCheckIcon, ChevronRightIcon, SearchIcon } from '#lib/ui/lucide.ts';
import { IconCheck, IconInfoCircle, IconPlus, IconStar } from '#lib/ui/tabler.ts';
import { IconArrowUp, IconChevronDown, IconMinus } from './icons.ts';
import { t, type RtlLang } from './translations.ts';

/**
 * The RTL example's third column (#1666): shadcn's InputGroupDemo,
 * InputGroupButtonExample, ItemDemo and AppearanceSettings, in the chosen
 * language. The star and the GPU stepper keep their state through
 * `<example-bind>` (../example-bind.ts).
 */

export function inputGroupDemo(lang: RtlLang) {
  const s = t.inputGroupDemo[lang];
  return html`<div class="grid w-full max-w-sm gap-6">
    <div data-slot="input-group" role="group" class=${inputGroupClass()}>
      <input data-slot="input-group-control" id="rtl-ig-search" placeholder=${s.search} aria-label=${s.search} class=${inputGroupInputClass()}>
      <label data-slot="input-group-addon" data-align="inline-start" for="rtl-ig-search" class=${inputGroupAddonClass()}>${SearchIcon()}</label>
      <label data-slot="input-group-addon" data-align="inline-end" for="rtl-ig-search" class=${inputGroupAddonClass({ align: 'inline-end' })}>${s.results}</label>
    </div>
    <div data-slot="input-group" role="group" class=${inputGroupClass()}>
      <input data-slot="input-group-control" placeholder=${s.example} aria-label=${s.example} class=${inputGroupInputClass()}>
      <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
        <ui-tooltip>
          <ui-tooltip-trigger>
            <button type="button" data-slot="button" data-size="icon-xs" aria-label=${s.add} class=${cn(inputGroupButtonClass({ size: 'icon-xs' }), 'rounded-full')}>${IconInfoCircle()}</button>
          </ui-tooltip-trigger>
          <ui-tooltip-content>${s.tooltipContent}</ui-tooltip-content>
        </ui-tooltip>
      </div>
    </div>
    <div data-slot="input-group" role="group" class=${inputGroupClass()}>
      <textarea data-slot="input-group-control" placeholder=${s.askSearchChat} aria-label=${s.askSearchChat} class=${inputGroupTextareaClass()}></textarea>
      <div role="group" data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon-xs" aria-label=${s.add} class=${cn(inputGroupButtonClass({ variant: 'outline', size: 'icon-xs' }), 'rounded-full')}>${IconPlus()}</button>
        <button type="button" id="rtl-ig-mode" data-slot="button" data-variant="ghost" aria-label=${s.auto} class=${inputGroupButtonClass({ variant: 'ghost' })}>${IconChevronDown()}</button>
        <ui-dropdown-menu trigger="rtl-ig-mode" class="absolute">
          <ui-dropdown-menu-content side="top" align="start">
            <ui-dropdown-menu-item>${s.auto}</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>${s.agent}</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>${s.manual}</ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
        <span class=${cn(inputGroupTextClass(), 'ms-auto')}>${s.used}</span>
        <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass({ orientation: 'vertical' }), 'h-4!')}></div>
        <button type="button" data-slot="button" data-variant="default" data-size="icon-xs" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'icon-xs' }), 'rounded-full')}>
          ${IconArrowUp()}<span class="sr-only">${s.send}</span>
        </button>
      </div>
    </div>
    <div data-slot="input-group" role="group" class=${inputGroupClass()}>
      <input data-slot="input-group-control" placeholder="shadcn" aria-label="Username" class=${inputGroupInputClass()}>
      <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
        <div class="flex size-4 items-center justify-center rounded-full bg-primary text-foreground">${IconCheck('size-3 text-white')}</div>
      </div>
    </div>
  </div>`;
}

export function inputGroupButton(lang: RtlLang) {
  const s = t.inputGroupButton[lang];
  return html`<div class="grid w-full max-w-sm gap-6">
    <label data-slot="label" for="input-secure-rtl" class=${cn(labelClass(), 'sr-only')}>${s.inputLabel}</label>
    <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), '[--radius:9999px]')}>
      <input data-slot="input-group-control" id="input-secure-rtl" class=${cn(inputGroupInputClass(), 'pr-0.5!')}>
      <div role="group" data-slot="input-group-addon" data-align="inline-start" class=${inputGroupAddonClass()}>
        <button type="button" popovertarget="rtl-price-info" aria-haspopup="dialog" aria-expanded="false" aria-label=${s.info} data-slot="button" data-variant="secondary" data-size="icon-xs" class=${inputGroupButtonClass({ variant: 'secondary', size: 'icon-xs' })}>${IconInfoCircle()}</button>
      </div>
      <div id="rtl-price-info" popover role="dialog" aria-label=${s.info} data-slot="popover-content" data-side="bottom" data-align="end" class=${cn(popoverContentClass({ align: 'end' }), 'rounded-xl text-sm')}>
        <p class="font-medium">${s.priceInfo}</p>
        <p class="mt-1">${s.priceDescription}</p>
      </div>
      <label data-slot="input-group-addon" data-align="inline-start" for="input-secure-rtl" class=${cn(inputGroupAddonClass(), 'text-muted-foreground')}>${s.currency}</label>
      <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
        <button type="button" data-toggle data-active="false" aria-pressed="false" aria-label=${s.favorite} data-slot="button" data-size="icon-xs" class=${cn(inputGroupButtonClass({ size: 'icon-xs' }), 'group/fav')}>
          ${IconStar('group-data-[active=true]/fav:fill-primary group-data-[active=true]/fav:stroke-primary')}
        </button>
      </div>
    </div>
  </div>`;
}

export function itemDemo(lang: RtlLang) {
  const s = t.itemDemo[lang];
  return html`<div class="flex w-full max-w-md flex-col gap-6">
    <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
      <div data-slot="item-content" class=${itemContentClass()}>
        <div data-slot="item-title" class=${itemTitleClass()}>${s.twoFactor}</div>
        <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'text-pretty xl:hidden 2xl:block')}>${s.twoFactorDescription}</p>
      </div>
      <div data-slot="item-actions" class=${itemActionsClass()}>
        <button type="button" data-slot="button" class=${buttonClass({ size: 'sm' })}>${s.enable}</button>
      </div>
    </div>
    <div data-slot="item" data-variant="outline" data-size="sm" class=${itemClass({ variant: 'outline', size: 'sm' })}>
      <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>${BadgeCheckIcon('size-5')}</div>
      <div data-slot="item-content" class=${itemContentClass()}>
        <div data-slot="item-title" class=${itemTitleClass()}>${s.verified}</div>
      </div>
      <div data-slot="item-actions" class=${itemActionsClass()}>${ChevronRightIcon('size-4 rtl:rotate-180')}</div>
    </div>
  </div>`;
}

export function appearanceSeparator(lang: RtlLang) {
  return html`<div role="none" data-slot="field-separator" data-content="true" class=${cn(fieldSeparatorClass(), 'my-4')}>
    <span data-slot="field-separator-content" class=${fieldSeparatorContentClass()}>${t.appearance[lang].separator}</span>
  </div>`;
}

export function appearanceSettings(lang: RtlLang) {
  const s = t.appearance[lang];
  const options = [
    { value: 'kubernetes', id: 'rtl-kubernetes', title: s.kubernetes, description: s.kubernetesDescription },
    { value: 'vm', id: 'rtl-vm', title: s.virtualMachine, description: s.vmDescription },
  ];
  return html`<div>
    <fieldset data-slot="field-set" class=${fieldSetClass()}>
      <div data-slot="field-group" class=${fieldGroupClass()}>
        <fieldset data-slot="field-set" class=${fieldSetClass()}>
          <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>${s.computeEnvironment}</legend>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>${s.computeDescription}</p>
          <div role="radiogroup" aria-label=${s.computeEnvironment} data-slot="radio-group" class=${radioGroupClass()}>
            ${options.map((o) => html`<label data-slot="field-label" for=${o.id} class=${fieldLabelClass()}>
              <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                <div data-slot="field-content" class=${fieldContentClass()}>
                  <div data-slot="field-label" class=${fieldTitleClass()}>${o.title}</div>
                  <p data-slot="field-description" class=${fieldDescriptionClass()}>${o.description}</p>
                </div>
                <input type="radio" data-slot="radio" name="rtl-compute" value=${o.value} id=${o.id} ?checked=${o.value === 'kubernetes'} aria-label=${o.title} class=${radioClass()}>
              </div>
            </label>`)}
          </div>
        </fieldset>
        <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
        <div role="group" data-slot="field" data-orientation="horizontal" data-bind-group class=${fieldClass({ orientation: 'horizontal' })}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <label data-slot="field-label" for="rtl-gpu-count" class=${fieldLabelClass()}>${s.numberOfGpus}</label>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${s.gpuDescription}</p>
          </div>
          <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
            <input data-slot="input" id="rtl-gpu-count" data-step-input data-min="1" data-max="99" value="8" size="3" maxlength="3" inputmode="numeric" class=${cn(inputClass(), 'h-7 w-14! font-mono')}>
            <button type="button" data-step="-1" aria-label=${s.decrement} data-slot="button" class=${buttonClass({ variant: 'outline', size: 'icon-sm' })}>${IconMinus()}</button>
            <button type="button" data-step="1" aria-label=${s.increment} data-slot="button" class=${buttonClass({ variant: 'outline', size: 'icon-sm' })}>${IconPlus()}</button>
          </div>
        </div>
        <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <label data-slot="field-label" for="rtl-tinting" class=${fieldLabelClass()}>${s.wallpaperTinting}</label>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${s.wallpaperDescription}</p>
          </div>
          <ui-switch input-id="rtl-tinting" checked></ui-switch>
        </div>
      </div>
    </fieldset>
  </div>`;
}
