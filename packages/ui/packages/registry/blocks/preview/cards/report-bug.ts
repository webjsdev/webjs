/**
 * The preview block's bug report card: a title, severity and component
 * pickers, and the steps to reproduce. A fragment helper, rendered by the
 * server, with the kit's `<ui-select>` around native selects. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/report-bug.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${reportBug}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
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
import { selectTriggerClass } from '../../../components/select.ts';
import { textareaClass } from '../../../components/textarea.ts';

const select = (id: string, name: string, label: string, options: Array<[string, string]>, selected: string) => html`
  <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
    <label data-slot="field-label" for=${id} class=${fieldLabelClass()}>${label}</label>
    <ui-select>
      <select id=${id} name=${name} class=${cn(selectTriggerClass(), 'w-full')}>
        ${options.map(([value, text]) => html`<option value=${value} ?selected=${value === selected}>${text}</option>`)}
      </select>
    </ui-select>
  </div>
`;

export function reportBug() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Report Bug</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Help us fix issues faster.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <form id="report-bug-form">
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="bug-title" class=${fieldLabelClass()}>Title</label>
              <input data-slot="input" id="bug-title" name="title" placeholder="Brief description of the issue" class=${inputClass()}>
            </div>
            <div class="grid grid-cols-2 gap-3">
              ${select('bug-severity', 'severity', 'Severity', [['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], 'medium')}
              ${select('bug-component', 'component', 'Component', [['dashboard', 'Dashboard'], ['auth', 'Auth'], ['api', 'API'], ['billing', 'Billing']], 'dashboard')}
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="bug-steps" class=${fieldLabelClass()}>Steps to reproduce</label>
              <textarea data-slot="textarea" id="bug-steps" name="steps" placeholder=${'1. Go to\n2. Click on\n3. Observe...'} class=${cn(textareaClass(), 'min-h-24 resize-none')}></textarea>
            </div>
          </div>
        </form>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${cn(fieldClass({ orientation: 'horizontal' }), 'justify-end style-sera:justify-center')}>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'style-sera:flex-1')}>Attach File</button>
          <button type="submit" form="report-bug-form" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'style-sera:flex-1')}>Submit Bug</button>
        </div>
      </div>
    </div>
  `;
}
