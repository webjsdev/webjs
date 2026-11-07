import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { LANGUAGES, type RtlLang } from './translations.ts';
import { fieldDemo, emptyAvatarGroup, spinnerBadge, buttonGroupInputGroup, fieldSlider } from './parts-a.ts';
import { inputGroupDemo, inputGroupButton, itemDemo, appearanceSeparator, appearanceSettings } from './parts-b.ts';
import { buttonGroupDemo, fieldCheckbox, buttonGroupNested, buttonGroupPopover, fieldHear, spinnerEmpty } from './parts-c.ts';
import { notionPromptForm } from './notion.ts';

/**
 * shadcn's RTL example (apps/v4/app/(app)/examples/rtl/components/index.tsx,
 * #1666): sixteen kit compositions in four columns, right to left, in Arabic
 * or Hebrew. shadcn wraps them in a DirectionProvider; here the provider is
 * the `dir="rtl"` attribute on the grid, and every component lays itself out
 * from it with logical properties.
 *
 * The language is the `?lang=` query string, so the selector is a GET form:
 * with JavaScript off its button submits it, and with JavaScript on
 * `<example-bind>` submits it as soon as the choice changes. Every string is
 * rendered on the server in the chosen language.
 */

function languageSelector(lang: RtlLang) {
  return html`<form method="get" class="absolute -top-12 right-0 hidden items-center gap-2 lg:flex" dir="ltr">
    <label for="rtl-language" class="sr-only">Language</label>
    <ui-select size="sm">
      <select id="rtl-language" name="lang" data-autosubmit data-name="language-selector" class=${cn(selectTriggerClass(), 'h-8 w-36')}>
        ${LANGUAGES.map((l) => html`<option value=${l.value} ?selected=${l.value === lang}>${l.label}</option>`)}
      </select>
    </ui-select>
    <noscript><button type="submit" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Apply</button></noscript>
  </form>`;
}

const column = (content: unknown, cls = '') => html`<div class=${cn('flex flex-col gap-6 *:[div]:w-full *:[div]:max-w-full', cls)}>${content}</div>`;

export function rtlComponents(lang: RtlLang) {
  return html`<example-bind class="block">
    <div class="relative grid gap-8 p-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6 2xl:gap-8" dir="rtl" lang=${lang} data-lang=${lang} data-slot="rtl-components">
      ${languageSelector(lang)}
      ${column(fieldDemo(lang))}
      ${column(html`${emptyAvatarGroup(lang)}${spinnerBadge(lang)}${buttonGroupInputGroup(lang)}${fieldSlider(lang)}${inputGroupDemo(lang)}`)}
      ${column(html`${inputGroupButton(lang)}${itemDemo(lang)}${appearanceSeparator(lang)}${appearanceSettings(lang)}`)}
      ${column(html`
        ${notionPromptForm(lang)}
        ${buttonGroupDemo(lang)}
        ${fieldCheckbox(lang)}
        <div class="flex justify-between gap-4">${buttonGroupNested(lang)}${buttonGroupPopover(lang)}</div>
        ${fieldHear(lang)}
        ${spinnerEmpty(lang)}
      `, 'order-first lg:hidden xl:order-last xl:flex')}
    </div>
  </example-bind>`;
}
