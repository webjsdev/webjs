import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass, avatarGroupClass } from '#modules/ui/components/avatar.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass, emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldLabelClass, fieldTitleClass,
  fieldDescriptionClass, fieldSeparatorClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import { AudioLinesIcon, PlusIcon } from '#lib/ui/lucide.ts';
import { t, type RtlLang } from './translations.ts';

/**
 * The RTL example's first two columns (#1666): shadcn's FieldDemo,
 * EmptyAvatarGroup, SpinnerBadge, ButtonGroupInputGroup and FieldSlider from
 * apps/v4/app/(app)/examples/rtl/components, in the chosen language. Numbers
 * are formatted with the language's locale, as shadcn's are.
 */

const nf = (locale: string, n: number, opts: Intl.NumberFormatOptions = {}) => new Intl.NumberFormat(locale, opts).format(n);
export const localeOf = (lang: RtlLang) => (lang === 'he' ? 'he-IL' : 'ar-SA');

export function fieldDemo(lang: RtlLang) {
  const s = t.fieldDemo[lang];
  const locale = localeOf(lang);
  const plain = { useGrouping: false };
  const card = [1234, 5678, 9012, 3456].map((n) => nf(locale, n, plain)).join(' ');
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: nf(locale, i + 1, { minimumIntegerDigits: 2, useGrouping: false }) }));
  const years = Array.from({ length: 6 }, (_, i) => ({ value: String(2024 + i), label: nf(locale, 2024 + i, plain) }));
  const select = (id: string, placeholder: string, items: { value: string; label: string }[]) => html`<ui-select placeholder=${placeholder}>
    <select id=${id} class=${cn(selectTriggerClass(), 'w-full')}>
      <option value="" disabled selected hidden>${placeholder}</option>
      ${items.map((m) => html`<option value=${m.value}>${m.label}</option>`)}
    </select>
  </ui-select>`;
  return html`<div class="w-full max-w-md rounded-lg border p-6">
    <form>
      <div data-slot="field-group" class=${fieldGroupClass()}>
        <fieldset data-slot="field-set" class=${fieldSetClass()}>
          <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>${s.paymentMethod}</legend>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>${s.secureEncrypted}</p>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="rtl-card-name" class=${fieldLabelClass()}>${s.nameOnCard}</label>
              <input data-slot="input" id="rtl-card-name" placeholder=${s.namePlaceholder} required class=${inputClass()}>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'col-span-2')}>
                <label data-slot="field-label" for="rtl-card-number" class=${fieldLabelClass()}>${s.cardNumber}</label>
                <input data-slot="input" id="rtl-card-number" placeholder=${card} required class=${inputClass()}>
                <p data-slot="field-description" class=${fieldDescriptionClass()}>${s.cardDescription}</p>
              </div>
              <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'col-span-1')}>
                <label data-slot="field-label" for="rtl-cvv" class=${fieldLabelClass()}>${s.cvv}</label>
                <input data-slot="input" id="rtl-cvv" placeholder=${nf(locale, 123, plain)} required class=${inputClass()}>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="rtl-exp-month" class=${fieldLabelClass()}>${s.month}</label>
                ${select('rtl-exp-month', 'MM', months)}
              </div>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="rtl-exp-year" class=${fieldLabelClass()}>${s.year}</label>
                ${select('rtl-exp-year', 'YYYY', years)}
              </div>
            </div>
          </div>
        </fieldset>
        <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
        <fieldset data-slot="field-set" class=${fieldSetClass()}>
          <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>${s.billingAddress}</legend>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>${s.billingDescription}</p>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
              <input type="checkbox" data-slot="checkbox" id="rtl-same-as-shipping" checked class=${checkboxClass()}>
              <label data-slot="field-label" for="rtl-same-as-shipping" class=${cn(fieldLabelClass(), 'font-normal')}>${s.sameAsShipping}</label>
            </div>
          </div>
        </fieldset>
        <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
        <fieldset data-slot="field-set" class=${fieldSetClass()}>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="rtl-comments" class=${fieldLabelClass()}>${s.comments}</label>
              <textarea data-slot="textarea" id="rtl-comments" placeholder=${s.commentsPlaceholder} class=${cn(textareaClass(), 'resize-none')}></textarea>
            </div>
          </div>
        </fieldset>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <button type="submit" data-slot="button" class=${buttonClass()}>${s.submit}</button>
          <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline' })}>${s.cancel}</button>
        </div>
      </div>
    </form>
  </div>`;
}

const avatar = (src: string, alt: string, fallback: string, cls = '') => html`<span data-slot="avatar" data-size="default" class=${cn(avatarClass(), cls)}>
  <img data-slot="avatar-image" src=${src} alt=${alt} class=${avatarImageClass()}>
  <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>${fallback}</span>
</span>`;

export const AVATARS = [
  { src: '/avatars/vivek.jpg', alt: '@vivek', fallback: 'VK' },
  { src: 'https://github.com/maxleiter.png', alt: '@maxleiter', fallback: 'LR' },
  { src: 'https://github.com/evilrabbit.png', alt: '@evilrabbit', fallback: 'ER' },
];

export function emptyAvatarGroup(lang: RtlLang) {
  const s = t.emptyAvatarGroup[lang];
  return html`<div data-slot="empty" class=${cn(emptyClass(), 'flex-none border py-10')}>
    <div data-slot="empty-header" class=${emptyHeaderClass()}>
      <div data-slot="empty-icon" data-variant="default" class=${emptyMediaClass()}>
        <div data-slot="avatar-group" class=${cn(avatarGroupClass(), 'grayscale')}>
          ${AVATARS.map((a) => avatar(a.src, a.alt, a.fallback))}
        </div>
      </div>
      <div data-slot="empty-title" class=${emptyTitleClass()}>${s.title}</div>
      <div data-slot="empty-description" class=${emptyDescriptionClass()}>${s.description}</div>
    </div>
    <div data-slot="empty-content" class=${emptyContentClass()}>
      <button type="button" data-slot="button" class=${buttonClass({ size: 'sm' })}>${PlusIcon()} ${s.invite}</button>
    </div>
  </div>`;
}

export function spinnerBadge(lang: RtlLang) {
  const s = t.spinnerBadge[lang];
  const badge = (variant: 'default' | 'secondary' | 'outline', text: string) => html`<span data-slot="badge" data-variant=${variant} class=${badgeClass({ variant })}>${spinner({ decorative: true })} ${text}</span>`;
  return html`<div class="flex items-center gap-2">
    ${badge('default', s.syncing)}${badge('secondary', s.updating)}${badge('outline', s.loading)}
  </div>`;
}

export function buttonGroupInputGroup(lang: RtlLang) {
  const s = t.buttonGroupInputGroup[lang];
  return html`<div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <button type="button" data-slot="button" aria-label=${s.add} class=${buttonClass({ variant: 'outline', size: 'icon' })}>${PlusIcon()}</button>
    </div>
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'flex-1')}>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" placeholder=${s.messagePlaceholder} aria-label=${s.messagePlaceholder} class=${inputGroupInputClass()}>
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <ui-tooltip>
            <ui-tooltip-trigger>
              <button type="button" data-toggle data-slot="button" data-size="icon-xs" data-active="false" aria-pressed="false" aria-label=${s.voiceMode} class=${cn(inputGroupButtonClass({ size: 'icon-xs' }), 'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground')}>
                ${AudioLinesIcon()}
              </button>
            </ui-tooltip-trigger>
            <ui-tooltip-content>${s.voiceMode}</ui-tooltip-content>
          </ui-tooltip>
        </div>
      </div>
    </div>
  </div>`;
}

export function fieldSlider(lang: RtlLang) {
  const s = t.fieldSlider[lang];
  const locale = localeOf(lang);
  const value = [200, 800];
  return html`<div role="group" data-slot="field" data-orientation="vertical" data-bind-group data-locale=${locale} class=${fieldClass()}>
    <div data-slot="field-label" class=${fieldTitleClass()}>${s.title}</div>
    <p data-slot="field-description" class=${fieldDescriptionClass()}>
      ${s.description} (${s.currency}<span data-bind-value="0" class="font-medium tabular-nums">${nf(locale, value[0])}</span> -
      <span data-bind-value="1" class="font-medium tabular-nums">${nf(locale, value[1])}</span>).
    </p>
    <ui-slider class="mt-2 w-full">
      <input type="range" min="0" max="1000" step="10" value=${value[0]} aria-label=${s.ariaLabel} class=${sliderClass()}>
      <input type="range" min="0" max="1000" step="10" value=${value[1]} aria-label=${s.ariaLabel} class=${sliderClass()}>
    </ui-slider>
  </div>`;
}
