/**
 * The preview-02 new milestone card: a savings goal's name, amount and date.
 * A fragment helper. Installed by `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/new-milestone.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${createGoal}>`) before you ship it.
 */
import { html, nothing } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import { cn } from '../../../lib/utils.ts';

function field(id: string, name: string, label: string, attrs: { placeholder?: string; value?: string }) {
  return html`<div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
    <label data-slot="field-label" for=${id} class=${fieldLabelClass()}>${label}</label>
    <input data-slot="input" id=${id} name=${name} placeholder=${attrs.placeholder ?? nothing} value=${attrs.value ?? nothing} class=${inputClass()}>
  </div>`;
}

export function newMilestone() {
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Set a new milestone</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Define your financial target and we'll help you pace your savings.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          ${field('goal-name', 'goal', 'Goal Name', { placeholder: 'e.g. New Car, Home Downpayment' })}
          <div class="grid grid-cols-2 gap-3">
            ${field('target-amount', 'amount', 'Target Amount', { value: '$15,000' })}
            ${field('target-date', 'date', 'Target Date', { value: 'Dec 2025' })}
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Create Goal</button>
        <button type="reset" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}>Cancel</button>
      </div>
    </form>
  `;
}
