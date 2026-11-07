import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass, emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldLabelClass, fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import {
  ArchiveIcon, ArrowLeftIcon, ArrowRightIcon, BotIcon, CalendarPlusIcon, ChevronDownIcon, ClockIcon,
  ListFilterIcon, MailCheckIcon, MoreHorizontalIcon, TagIcon, Trash2Icon,
} from '#lib/ui/lucide.ts';
import { localeOf } from './parts-a.ts';
import { t, type RtlLang } from './translations.ts';

/**
 * The RTL example's fourth column (#1666): shadcn's ButtonGroupDemo,
 * FieldCheckbox, ButtonGroupNested, ButtonGroupPopover, FieldHear and
 * SpinnerEmpty, in the chosen language. NotionPromptForm, the column's head,
 * is in ./notion.ts.
 */

const outline = (size: 'sm' | 'icon-sm') => buttonClass({ variant: 'outline', size });

export function buttonGroupDemo(lang: RtlLang) {
  const s = t.buttonGroupDemo[lang];
  const group = (content: unknown, cls = '') => html`<div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), cls)}>${content}</div>`;
  return html`<div>
    ${group(html`
      ${group(html`<button type="button" data-slot="button" aria-label=${s.goBack} class=${outline('icon-sm')}>${ArrowLeftIcon('rtl:rotate-180')}</button>`, 'hidden sm:flex')}
      ${group(html`<button type="button" data-slot="button" class=${outline('sm')}>${s.archive}</button><button type="button" data-slot="button" class=${outline('sm')}>${s.report}</button>`)}
      ${group(html`<button type="button" data-slot="button" class=${outline('sm')}>${s.snooze}</button><button type="button" id="rtl-bg-more" data-slot="button" aria-label=${s.moreOptions} class=${outline('icon-sm')}>${MoreHorizontalIcon()}</button>`)}
    `)}
    <ui-dropdown-menu trigger="rtl-bg-more" class="absolute">
      <ui-dropdown-menu-content align="start" class="w-44">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>${MailCheckIcon()} ${s.markAsRead}</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>${ArchiveIcon()} ${s.archive}</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>${ClockIcon()} ${s.snooze}</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>${CalendarPlusIcon()} ${s.addToCalendar}</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>${ListFilterIcon()} ${s.addToList}</ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>${TagIcon()} ${s.labelAs}</ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content side="left">
              <ui-dropdown-menu-group aria-label=${s.labelAs}>
                <ui-dropdown-menu-item type="radio" value="personal" checked>${s.personal}</ui-dropdown-menu-item>
                <ui-dropdown-menu-item type="radio" value="work">${s.work}</ui-dropdown-menu-item>
                <ui-dropdown-menu-item type="radio" value="other">${s.other}</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item variant="destructive">${Trash2Icon()} ${s.trash}</ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  </div>`;
}

export function fieldCheckbox(lang: RtlLang) {
  const s = t.fieldCheckbox[lang];
  return html`<div>
    <label data-slot="field-label" for="checkbox-demo-rtl" class=${fieldLabelClass()}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="checkbox-demo-rtl" checked class=${checkboxClass()}>
        <span data-slot="field-label" class=${cn(fieldTitleClass(), 'line-clamp-1')}>${s.terms}</span>
      </div>
    </label>
  </div>`;
}

export function buttonGroupNested(lang: RtlLang) {
  const s = t.buttonGroupNested[lang];
  const n = (v: number) => new Intl.NumberFormat(localeOf(lang)).format(v);
  return html`<div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      ${[1, 2, 3].map((v) => html`<button type="button" data-slot="button" class=${outline('sm')}>${n(v)}</button>`)}
    </div>
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <button type="button" data-slot="button" aria-label=${s.previous} class=${outline('icon-sm')}>${ArrowLeftIcon('rtl:rotate-180')}</button>
      <button type="button" data-slot="button" aria-label=${s.next} class=${outline('icon-sm')}>${ArrowRightIcon('rtl:rotate-180')}</button>
    </div>
  </div>`;
}

export function buttonGroupPopover(lang: RtlLang) {
  const s = t.buttonGroupPopover[lang];
  return html`<div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
    <button type="button" data-slot="button" class=${outline('sm')}>${BotIcon()} ${s.copilot}</button>
    <button type="button" popovertarget="rtl-copilot" aria-haspopup="dialog" aria-expanded="false" aria-label=${s.openPopover} data-slot="button" class=${outline('icon-sm')}>${ChevronDownIcon()}</button>
  </div>
  <div id="rtl-copilot" popover role="dialog" aria-labelledby="rtl-copilot-title" data-slot="popover-content" data-side="bottom" data-align="start" class=${cn(popoverContentClass({ align: 'start' }), 'p-0')}>
    <div class="px-4 py-3"><div id="rtl-copilot-title" class="text-sm font-medium">${s.agentTasks}</div></div>
    <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
    <div class="p-4 text-sm *:[p:not(:last-child)]:mb-2">
      <textarea data-slot="textarea" aria-label=${s.agentTasks} placeholder=${s.placeholder} class=${cn(textareaClass(), 'mb-4 resize-none')}></textarea>
      <p class="font-medium">${s.startTask}</p>
      <p class="text-muted-foreground">${s.description}</p>
    </div>
  </div>`;
}

export function fieldHear(lang: RtlLang) {
  const s = t.fieldHear[lang];
  const options = [
    { label: s.socialMedia, value: 'social-media' },
    { label: s.searchEngine, value: 'search-engine' },
    { label: s.referral, value: 'referral' },
    { label: s.other, value: 'other' },
  ];
  return html`<div>
    <div data-slot="card" class=${cn(cardClass(), 'border-0 py-4 shadow-none')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'px-4')}>
        <form>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <fieldset data-slot="field-set" class=${cn(fieldSetClass(), 'gap-4')}>
              <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>${s.legend}</legend>
              <p data-slot="field-description" class=${cn(fieldDescriptionClass(), 'line-clamp-1')}>${s.description}</p>
              <div data-slot="field-group" class=${cn(fieldGroupClass(), 'flex flex-row flex-wrap gap-2 [--radius:9999rem]')}>
                ${options.map((o) => html`<label data-slot="field-label" for=${`rtl-${o.value}`} class=${cn(fieldLabelClass(), 'w-fit!')}>
                  <div role="group" data-slot="field" data-orientation="horizontal" class=${cn(fieldClass({ orientation: 'horizontal' }), 'gap-1.5 overflow-hidden px-3! py-1.5! transition-all duration-100 ease-linear group-has-checked/field-label:px-2!')}>
                    <input type="checkbox" data-slot="checkbox" value=${o.value} id=${`rtl-${o.value}`} ?checked=${o.value === 'social-media'} class=${cn(checkboxClass(), '-ms-6 translate-x-1 rounded-full transition-all duration-100 ease-linear checked:ms-0 checked:translate-x-0')}>
                    <span data-slot="field-label" class=${fieldTitleClass()}>${o.label}</span>
                  </div>
                </label>`)}
              </div>
            </fieldset>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

export function spinnerEmpty(lang: RtlLang) {
  const s = t.spinnerEmpty[lang];
  return html`<div data-slot="empty" class=${cn(emptyClass(), 'w-full border md:p-6')}>
    <div data-slot="empty-header" class=${emptyHeaderClass()}>
      <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${spinner()}</div>
      <div data-slot="empty-title" class=${emptyTitleClass()}>${s.title}</div>
      <div data-slot="empty-description" class=${emptyDescriptionClass()}>${s.description}</div>
    </div>
    <div data-slot="empty-content" class=${emptyContentClass()}>
      <button type="button" data-slot="button" class=${outline('sm')}>${s.cancel}</button>
    </div>
  </div>`;
}
